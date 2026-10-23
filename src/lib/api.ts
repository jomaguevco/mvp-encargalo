import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type {
  Aviso,
  Calificacion,
  ConfigItem,
  ConfirmacionVencida,
  CuentaAdmin,
  CuentaParecida,
  DesglosePrecio,
  DisputaAbierta,
  EntradaBitacora,
  EstadoPedido,
  EventoPedido,
  FichaCuenta,
  FiltroCuentas,
  FiltroVerificaciones,
  Mensaje,
  MetodoPago,
  Oferta,
  OfertaConReputacion,
  OfertaEnviada,
  Pago,
  PagoAdmin,
  PagoPendiente,
  Pedido,
  PedidoAdmin,
  Perfil,
  PersonaReniec,
  Reputacion,
  Resena,
  ResultadoDni,
  ResultadoIa,
  ResumenAdmin,
  VerificacionHistorial,
  VerificacionPendiente,
} from './tipos';

/** Convierte el error de PostgREST en algo que se le pueda mostrar a una persona. */
function revienta(error: { message: string } | null): never | void {
  if (!error) return;
  const m = error.message ?? 'Ocurrió un error';
  // Restricciones únicas: el mensaje crudo de Postgres no le dice nada a nadie
  if (m.includes('profiles_dni_unico')) {
    throw new Error('Ese DNI ya está registrado en otra cuenta de Encárgalo.');
  }
  if (m.includes('duplicate key')) throw new Error('Ese dato ya está registrado.');
  // Los raise exception de Postgres llegan con este prefijo
  throw new Error(m.replace(/^.*?(?:ERROR:\s*)?/, '').trim() || m);
}

// ---------------------------------------------------------------- perfil
export async function miPerfil(): Promise<Perfil | null> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', sesion.user.id)
    .maybeSingle();
  revienta(error);
  return data as Perfil | null;
}

export async function actualizarPerfil(cambios: Partial<Perfil>) {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error('No hay sesión activa');
  const { error } = await supabase
    .from('profiles')
    .update(cambios)
    .eq('id', sesion.user.id);
  revienta(error);
}

/**
 * Envía DNI y selfie a verificación.
 * Las imágenes van al bucket privado `documentos`, en la carpeta del propio
 * usuario: las políticas de storage impiden que alguien lea la de otro.
 *
 * Después pide a la Edge Function `validar-dni` que contraste el DNI y el nombre
 * con RENIEC, y a `verificar-identidad` que compare la selfie con la foto del DNI
 * y lea lo impreso. Esta última puede aprobar o rechazar en el acto; si algo
 * queda dudoso o un servicio no responde (null), la solicitud sigue en revisión
 * y la resuelve el equipo igual que antes.
 */
export async function enviarVerificacion(opts: {
  dni: string;
  dniFrenteUri: string;
  selfieUri: string;
}): Promise<{ dni: ResultadoDni | null; identidad: ResultadoIa | null }> {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('No hay sesión activa');

  if (!/^[0-9]{8}$/.test(opts.dni)) {
    throw new Error('El DNI debe tener exactamente 8 dígitos');
  }

  // El DNI primero: si otra cuenta lo está verificando o ya lo verificó, se
  // avisa aquí y no se suben fotos. Una cuenta rechazada no lo reserva
  // (0013_verificacion_reintentos.sql), así que reintentar siempre es posible.
  const { data: libre, error: errorDni } = await supabase.rpc('dni_disponible', { p_dni: opts.dni });
  if (!errorDni && libre === false) {
    throw new Error(
      'Ese DNI ya está verificado o en revisión en otra cuenta de Encárgalo. Si es tuyo, escríbenos.',
    );
  }
  await actualizarPerfil({ dni: opts.dni });

  const dniPath = `${uid}/dni-${Date.now()}.jpg`;
  const selfiePath = `${uid}/selfie-${Date.now()}.jpg`;
  await subirArchivo('documentos', dniPath, opts.dniFrenteUri);
  await subirArchivo('documentos', selfiePath, opts.selfieUri);

  await actualizarPerfil({
    dni: opts.dni,
    dni_frente_path: dniPath,
    selfie_path: selfiePath,
    verificacion: 'en_revision',
    motivo_rechazo: null,
  });

  // Si una consulta falla (sin red, cupo agotado, etc.) no se bloquea a la
  // persona: la solicitud queda en revisión y la resuelve un operador.
  // El orden importa: verificar-identidad usa el resultado de validar-dni.
  // Si este mismo DNI y nombre ya se validaron (una verificación anterior
  // rechazada por las fotos, por ejemplo), el resultado sigue en el perfil: el
  // trigger solo lo borra si cambia el DNI o el nombre. No se consulta otra vez.
  let dni: ResultadoDni | null = null;
  const { data: actual } = await supabase
    .from('profiles')
    .select('dni_validacion')
    .eq('id', uid)
    .maybeSingle();
  if (actual?.dni_validacion === 'coincide') {
    dni = 'coincide';
  } else {
    try {
      const { data } = await supabase.functions.invoke('validar-dni');
      const r = data?.resultado as string | undefined;
      if (r === 'coincide' || r === 'no_coincide' || r === 'no_existe') dni = r;
    } catch {
      /* sigue sin validar */
    }
  }

  let identidad: ResultadoIa | null = null;
  try {
    const { data } = await supabase.functions.invoke('verificar-identidad');
    const r = data?.resultado as string | undefined;
    if (r === 'aprobado' || r === 'revisar' || r === 'rechazado') identidad = r;
  } catch {
    /* queda para el operador */
  }

  return { dni, identidad };
}

/**
 * Nombre que figura en RENIEC para un DNI, vía la Edge Function `consultar-dni`.
 * Sirve para completar el nombre solo en el registro y en la verificación.
 * Funciona sin sesión: la clave anónima basta.
 *
 * Devuelve la persona, `null` si RENIEC no tiene ese número, o lanza un error
 * con un mensaje legible si el servicio no respondió (sin red, cupo agotado,
 * función sin desplegar). En ese caso la app deja escribir el nombre a mano.
 */
export async function consultarDni(dni: string): Promise<PersonaReniec | null> {
  const { data, error } = await supabase.functions.invoke('consultar-dni', {
    body: { dni },
  });
  if (error) {
    let mensaje = 'No pudimos consultar RENIEC en este momento';
    try {
      const cuerpo = await (error as { context?: Response }).context?.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      /* la función no existe o no devolvió JSON */
    }
    throw new Error(mensaje);
  }
  if (!data?.encontrado) return null;
  return {
    nombres: data.nombres ?? '',
    apellidoPaterno: data.apellido_paterno ?? '',
    apellidoMaterno: data.apellido_materno ?? '',
  };
}

// ---------------------------------------------------------------- archivos
/**
 * Lee la imagen que devolvió el selector. Cada plataforma necesita su camino:
 *
 * - En React Native, `fetch(uri).arrayBuffer()` suele devolver cero bytes y el
 *   archivo llega vacío. La lectura directa del sistema de archivos es fiable.
 * - En el navegador no hay sistema de archivos: expo-file-system se sustituye
 *   por una clase vacía y `new File(uri)` revienta con «this.validatePath is
 *   not a function». Ahí el selector entrega un `blob:` que fetch sí lee.
 */
async function leerImagen(uri: string): Promise<{ bytes: Uint8Array; tipo: string }> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      tipo: blob.type || 'image/jpeg',
    };
  }
  return { bytes: await new File(uri).bytes(), tipo: 'image/jpeg' };
}

export async function subirArchivo(bucket: string, ruta: string, uri: string) {
  const { bytes, tipo } = await leerImagen(uri);
  if (bytes.byteLength === 0) {
    throw new Error('La imagen llegó vacía. Vuelve a tomarla.');
  }
  const { error } = await supabase.storage
    .from(bucket)
    // Las rutas llevan marca de tiempo: nunca se sobrescribe un archivo, y
    // storage no tiene política de UPDATE.
    .upload(ruta, bytes, { contentType: tipo, upsert: false });
  revienta(error);
  return ruta;
}

/** URL pública de una foto de perfil, o null si la persona no subió ninguna. */
export const urlFoto = (ruta: string | null | undefined) => urlPublica('avatares', ruta ?? null);

/**
 * Sube una foto de perfil nueva y borra la anterior. La foto es pública (la
 * ven quienes operan contigo), a diferencia de la selfie de verificación.
 */
export async function subirFotoPerfil(uri: string) {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('No hay sesión activa');
  const { data: antes } = await supabase.from('profiles').select('foto_path').eq('id', uid).maybeSingle();
  const ruta = await subirArchivo('avatares', `${uid}/avatar-${Date.now()}.jpg`, uri);
  await actualizarPerfil({ foto_path: ruta });
  if (antes?.foto_path) {
    // Si falla, solo queda un archivo huérfano: no vale la pena interrumpir.
    await supabase.storage.from('avatares').remove([antes.foto_path]).catch(() => undefined);
  }
}

export async function quitarFotoPerfil() {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('No hay sesión activa');
  const { data: antes } = await supabase.from('profiles').select('foto_path').eq('id', uid).maybeSingle();
  await actualizarPerfil({ foto_path: null });
  if (antes?.foto_path) {
    await supabase.storage.from('avatares').remove([antes.foto_path]).catch(() => undefined);
  }
}

export function urlPublica(bucket: string, ruta: string | null) {
  if (!ruta) return null;
  return supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

// ---------------------------------------------------------------- pedidos
export async function misPedidos(): Promise<Pedido[]> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return [];
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('cliente_id', sesion.user.id)
    .order('creado_en', { ascending: false });
  revienta(error);
  return (data ?? []) as Pedido[];
}

/** Pedidos abiertos que puede ver un comprador externo verificado. */
export async function pedidosAbiertos(): Promise<Pedido[]> {
  const { data: sesion } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('estado', 'publicado')
    .neq('cliente_id', sesion.user?.id ?? '')
    .order('creado_en', { ascending: false });
  revienta(error);
  return (data ?? []) as Pedido[];
}

/** Pedidos en los que participo como comprador externo. */
export async function misEntregas(): Promise<Pedido[]> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return [];
  const { data: pagos, error: e1 } = await supabase
    .from('pagos')
    .select('pedido_id')
    .eq('comprador_id', sesion.user.id);
  revienta(e1);
  const ids = (pagos ?? []).map((p: { pedido_id: string }) => p.pedido_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .in('id', ids)
    .order('actualizado_en', { ascending: false });
  revienta(error);
  return (data ?? []) as Pedido[];
}

export async function verPedido(id: string): Promise<Pedido | null> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  revienta(error);
  return data as Pedido | null;
}

export async function publicarPedido(p: {
  titulo: string;
  descripcion: string;
  url_producto?: string | null;
  categoria: string;
  cantidad: number;
  ciudad_entrega: string;
  fecha_limite: string;
  valor_referencial?: number | null;
  imagen_path?: string | null;
}): Promise<Pedido> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error('No hay sesión activa');
  const { data, error } = await supabase
    .from('pedidos')
    .insert({ ...p, cliente_id: sesion.user.id })
    .select()
    .single();
  revienta(error);
  return data as Pedido;
}

// ---------------------------------------------------------------- ofertas
export async function ofertasDelPedido(
  pedidoId: string,
): Promise<OfertaConReputacion[]> {
  const { data, error } = await supabase
    .from('ofertas')
    .select('*')
    .eq('pedido_id', pedidoId)
    .in('estado', ['enviada', 'aceptada'])
    .order('precio_final', { ascending: true });
  revienta(error);
  const ofertas = (data ?? []) as Oferta[];
  if (ofertas.length === 0) return [];

  const { data: reps } = await supabase
    .from('v_reputacion')
    .select('*')
    .in('perfil_id', [...new Set(ofertas.map((o) => o.comprador_id))]);

  const mapa = new Map<string, Reputacion>(
    ((reps ?? []) as Reputacion[]).map((r) => [r.perfil_id, r]),
  );
  return ofertas.map((o) => ({ ...o, reputacion: mapa.get(o.comprador_id) ?? null }));
}

export async function miOferta(pedidoId: string): Promise<Oferta | null> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return null;
  const { data, error } = await supabase
    .from('ofertas')
    .select('*')
    .eq('pedido_id', pedidoId)
    .eq('comprador_id', sesion.user.id)
    .in('estado', ['enviada', 'aceptada'])
    .maybeSingle();
  revienta(error);
  return data as Oferta | null;
}

export async function ofertar(
  pedidoId: string,
  precioFinal: number,
  fechaEntrega: string,
  nota: string,
) {
  const { data, error } = await supabase.rpc('ofertar', {
    p_pedido_id: pedidoId,
    p_precio_final: precioFinal,
    p_fecha_entrega: fechaEntrega,
    p_nota: nota,
  });
  revienta(error);
  return data as Oferta;
}

export async function aceptarOferta(ofertaId: string) {
  const { data, error } = await supabase.rpc('aceptar_oferta', {
    p_oferta_id: ofertaId,
  });
  revienta(error);
  return data as Pago;
}

// ---------------------------------------------------------------- pagos
export async function pagoDelPedido(pedidoId: string): Promise<Pago | null> {
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('pedido_id', pedidoId)
    .maybeSingle();
  revienta(error);
  return data as Pago | null;
}

export async function desglosePrecio(precio: number): Promise<DesglosePrecio> {
  const { data, error } = await supabase.rpc('desglose_precio', {
    p_precio_final: precio,
  });
  revienta(error);
  const fila = Array.isArray(data) ? data[0] : data;
  return fila as DesglosePrecio;
}

export async function reportarPago(opts: {
  pedidoId: string;
  metodo: MetodoPago;
  codigoOperacion: string;
  comprobanteUri: string;
}) {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('No hay sesión activa');

  const ruta = `${uid}/pago-${opts.pedidoId}-${Date.now()}.jpg`;
  await subirArchivo('comprobantes', ruta, opts.comprobanteUri);

  const { data, error } = await supabase.rpc('reportar_pago', {
    p_pedido_id: opts.pedidoId,
    p_metodo: opts.metodo,
    p_codigo_operacion: opts.codigoOperacion,
    p_comprobante_path: ruta,
  });
  revienta(error);
  return data as Pago;
}

/** Operación del equipo: confirma que el dinero llegó y queda retenido. */
export async function confirmarRetencion(pedidoId: string) {
  const { data, error } = await supabase.rpc('confirmar_retencion', {
    p_pedido_id: pedidoId,
  });
  revienta(error);
  return data as Pago;
}

/** El equipo no encontró el dinero: el pago vuelve a «pendiente» y se avisa al cliente. */
export async function rechazarPago(pedidoId: string, motivo: string) {
  const { data, error } = await supabase.rpc('rechazar_pago', {
    p_pedido_id: pedidoId,
    p_motivo: motivo,
  });
  revienta(error);
  return data as Pago;
}

export async function avanzarPedido(pedidoId: string, nuevo: EstadoPedido) {
  const { data, error } = await supabase.rpc('avanzar_pedido', {
    p_pedido_id: pedidoId,
    p_nuevo: nuevo,
  });
  revienta(error);
  return data as Pedido;
}

export async function confirmarRecepcion(pedidoId: string) {
  const { data, error } = await supabase.rpc('confirmar_recepcion', {
    p_pedido_id: pedidoId,
  });
  revienta(error);
  return data as Pago;
}

export async function abrirDisputa(pedidoId: string, motivo: string) {
  const { error } = await supabase.rpc('abrir_disputa', {
    p_pedido_id: pedidoId,
    p_motivo: motivo,
  });
  revienta(error);
}

// ---------------------------------------------------------------- extras
export async function eventosDelPedido(pedidoId: string): Promise<EventoPedido[]> {
  const { data, error } = await supabase
    .from('eventos_pedido')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('creado_en', { ascending: true });
  revienta(error);
  return (data ?? []) as EventoPedido[];
}

export async function mensajesDelPedido(pedidoId: string): Promise<Mensaje[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('creado_en', { ascending: true });
  revienta(error);
  return (data ?? []) as Mensaje[];
}

export async function enviarMensaje(pedidoId: string, cuerpo: string) {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) throw new Error('No hay sesión activa');
  const { error } = await supabase
    .from('mensajes')
    .insert({ pedido_id: pedidoId, emisor_id: sesion.user.id, cuerpo });
  revienta(error);
}

export async function calificar(
  pedidoId: string,
  puntaje: number,
  comentario: string,
) {
  const { data, error } = await supabase.rpc('calificar', {
    p_pedido_id: pedidoId,
    p_puntaje: puntaje,
    p_comentario: comentario,
  });
  revienta(error);
  return data as Calificacion;
}

export async function miCalificacion(pedidoId: string) {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return null;
  const { data } = await supabase
    .from('calificaciones')
    .select('*')
    .eq('pedido_id', pedidoId)
    .eq('califica_id', sesion.user.id)
    .maybeSingle();
  return data as Calificacion | null;
}

export async function reputacionDe(perfilId: string): Promise<Reputacion | null> {
  const { data } = await supabase
    .from('v_reputacion')
    .select('*')
    .eq('perfil_id', perfilId)
    .maybeSingle();
  return data as Reputacion | null;
}


// ------------------------------------------------- consola del equipo
export async function soyOperador(): Promise<boolean> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return false;
  const { data } = await supabase
    .from('operadores')
    .select('perfil_id')
    .eq('perfil_id', sesion.user.id)
    .maybeSingle();
  return !!data;
}

/** URL temporal para que un operador pueda mirar un documento privado. */
export async function urlFirmada(bucket: string, ruta: string, segundos = 600) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(ruta, segundos);
  return data?.signedUrl ?? null;
}

export async function pendientesVerificacion(): Promise<VerificacionPendiente[]> {
  const { data, error } = await supabase.rpc('pendientes_verificacion');
  revienta(error);
  return (data ?? []) as VerificacionPendiente[];
}

export async function pendientesPago(): Promise<PagoPendiente[]> {
  const { data, error } = await supabase.rpc('pendientes_pago');
  revienta(error);
  return (data ?? []) as PagoPendiente[];
}

export async function disputasAbiertas(): Promise<DisputaAbierta[]> {
  const { data, error } = await supabase.rpc('disputas_abiertas');
  revienta(error);
  return (data ?? []) as DisputaAbierta[];
}

export async function resolverVerificacion(
  perfilId: string,
  aprobar: boolean,
  motivo?: string,
) {
  const { error } = await supabase.rpc('resolver_verificacion', {
    p_perfil: perfilId,
    p_aprobar: aprobar,
    p_motivo: motivo ?? null,
  });
  revienta(error);
}

export async function resolverDisputa(
  disputaId: string,
  aFavorDelCliente: boolean,
  resolucion: string,
) {
  const { error } = await supabase.rpc('resolver_disputa', {
    p_disputa_id: disputaId,
    p_a_favor_del_cliente: aFavorDelCliente,
    p_resolucion: resolucion,
  });
  revienta(error);
}


// ---------------------------------------------------------------- avisos
export async function misAvisos(limite = 50): Promise<Aviso[]> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return [];
  const { data, error } = await supabase
    .from('avisos')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limite);
  revienta(error);
  return (data ?? []) as Aviso[];
}

export async function avisosNoLeidos(): Promise<number> {
  const { data, error } = await supabase.rpc('avisos_no_leidos');
  if (error) return 0;
  return Number(data ?? 0);
}

/** Sin ids marca toda la bandeja. Los avisos no se actualizan por UPDATE. */
export async function marcarAvisosLeidos(ids?: number[]) {
  const { error } = await supabase.rpc('marcar_avisos_leidos', {
    p_ids: ids ?? null,
  });
  revienta(error);
}

// ------------------------------------------------- cancelar y retirar
export async function cancelarPedido(pedidoId: string, motivo: string) {
  const { data, error } = await supabase.rpc('cancelar_pedido', {
    p_pedido_id: pedidoId,
    p_motivo: motivo,
  });
  revienta(error);
  return data as Pedido;
}

export async function retirarOferta(ofertaId: string) {
  const { data, error } = await supabase.rpc('retirar_oferta', {
    p_oferta_id: ofertaId,
  });
  revienta(error);
  return data as Oferta;
}

// ---------------------------------------------------------------- reputación
export async function resenasDe(perfilId: string, limite = 20): Promise<Resena[]> {
  const { data, error } = await supabase.rpc('resenas_de', {
    p_perfil: perfilId,
    p_limite: limite,
  });
  revienta(error);
  return (data ?? []) as Resena[];
}

// ------------------------------------------------- ofertas del comprador
export async function misOfertasEnviadas(): Promise<OfertaEnviada[]> {
  const { data, error } = await supabase.rpc('mis_ofertas_enviadas');
  revienta(error);
  return (data ?? []) as OfertaEnviada[];
}

// ------------------------------------------------- plazo de confirmación
/** Hasta cuándo tiene el cliente para confirmar antes de que el equipo revise. */
export async function fechaLimiteConfirmacion(pedidoId: string) {
  const { data, error } = await supabase.rpc('fecha_limite_confirmacion', {
    p_pedido_id: pedidoId,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}

// ------------------------------------------------- disputas con evidencia
export async function abrirDisputaConEvidencia(opts: {
  pedidoId: string;
  motivo: string;
  evidenciaUri?: string | null;
}) {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('No hay sesión activa');

  let ruta: string | null = null;
  if (opts.evidenciaUri) {
    ruta = `${uid}/disputa-${opts.pedidoId}-${Date.now()}.jpg`;
    await subirArchivo('comprobantes', ruta, opts.evidenciaUri);
  }

  const { error } = await supabase.rpc('abrir_disputa', {
    p_pedido_id: opts.pedidoId,
    p_motivo: opts.motivo,
    p_evidencia_path: ruta,
  });
  revienta(error);
}

// ------------------------------------------------- imagen del producto
/** El bucket `productos` es público: solo fotos de referencia del encargo. */
export async function subirImagenProducto(uri: string) {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('No hay sesión activa');
  return subirArchivo('productos', `${uid}/producto-${Date.now()}.jpg`, uri);
}

// ------------------------------------------------- consola: vencimientos
export async function confirmacionesVencidas(): Promise<ConfirmacionVencida[]> {
  const { data, error } = await supabase.rpc('confirmaciones_vencidas');
  revienta(error);
  return (data ?? []) as ConfirmacionVencida[];
}

export async function liberarPorVencimiento(pedidoId: string) {
  const { data, error } = await supabase.rpc('liberar_por_vencimiento', {
    p_pedido_id: pedidoId,
  });
  revienta(error);
  return data as Pago;
}

/**
 * Borra del bucket las imágenes de una verificación ya resuelta.
 * `resolver_verificacion` descarta las rutas en la base; esto elimina los
 * archivos, que era el paso que quedaba a mano en el panel de Supabase
 * (retención mínima, Ley N° 29733).
 */
export async function borrarDocumentos(rutas: (string | null)[]) {
  const limpias = rutas.filter((r): r is string => !!r);
  if (limpias.length === 0) return;
  const { error } = await supabase.storage.from('documentos').remove(limpias);
  // Si falla, la verificación ya quedó resuelta: se avisa pero no se revierte.
  if (error) throw new Error(`Se aprobó, pero no se pudieron borrar las imágenes: ${error.message}`);
}


// ---------------------------------------------------------------- administración
// Todo pasa por las funciones admin_* de 0012_administracion.sql, que rechazan
// a quien no esté en la tabla administradores. La app solo pide y muestra.

export async function soyAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('soy_admin');
  // Si la migración 0012 aún no está aplicada la función no existe: no es admin.
  if (error) return false;
  return !!data;
}

/** Fecha local en formato AAAA-MM-DD, que es lo que esperan las funciones. */
export const diaIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function resumenAdmin(desde: Date, hasta: Date): Promise<ResumenAdmin> {
  const { data, error } = await supabase.rpc('admin_resumen', {
    p_desde: diaIso(desde),
    p_hasta: diaIso(hasta),
  });
  revienta(error);
  return data as ResumenAdmin;
}

export async function cuentasAdmin(opts: {
  busqueda?: string;
  filtro?: FiltroCuentas;
  limite?: number;
  desde?: number;
}): Promise<CuentaAdmin[]> {
  const { data, error } = await supabase.rpc('admin_cuentas', {
    p_busqueda: opts.busqueda ?? null,
    p_filtro: opts.filtro ?? 'todas',
    p_limite: opts.limite ?? 50,
    p_desde: opts.desde ?? 0,
  });
  revienta(error);
  return (data ?? []) as CuentaAdmin[];
}

export async function fichaCuenta(perfilId: string): Promise<FichaCuenta> {
  const { data, error } = await supabase.rpc('admin_ficha_cuenta', { p_perfil: perfilId });
  revienta(error);
  return data as FichaCuenta;
}

/** Cuentas con el mismo DNI o el mismo nombre: casi siempre, alguien que se registró de nuevo. */
export async function cuentasParecidas(perfilId: string): Promise<CuentaParecida[]> {
  const { data, error } = await supabase.rpc('admin_cuentas_parecidas', { p_perfil: perfilId });
  revienta(error);
  return (data ?? []) as CuentaParecida[];
}

/**
 * Todo lo de un pedido para el panel: datos, todas las ofertas (también las
 * retiradas), pago, bitácora, chat, disputas y calificaciones, con el nombre de
 * cada participante. Usa la lectura que el equipo ya tiene por RLS
 * (0011_correcciones_flujo.sql) y los nombres de la vista pública de reputación.
 */
export async function detallePedidoAdmin(pedidoId: string) {
  const [pedido, ofertas, pago, eventos, mensajes, disputas, notas] = await Promise.all([
    verPedido(pedidoId),
    supabase.from('ofertas').select('*').eq('pedido_id', pedidoId).order('creado_en'),
    pagoDelPedido(pedidoId),
    eventosDelPedido(pedidoId),
    mensajesDelPedido(pedidoId),
    supabase.from('disputas').select('*').eq('pedido_id', pedidoId).order('creado_en'),
    supabase.from('calificaciones').select('*').eq('pedido_id', pedidoId).order('creado_en'),
  ]);
  revienta(ofertas.error);
  revienta(disputas.error);
  if (!pedido) return null;

  const listaOfertas = (ofertas.data ?? []) as Oferta[];
  const listaDisputas = (disputas.data ?? []) as {
    id: string;
    abierta_por: string;
    motivo: string;
    estado: string;
    resolucion: string | null;
    creado_en: string;
    resuelta_en: string | null;
  }[];
  const listaNotas = (notas.data ?? []) as Calificacion[];

  const ids = new Set<string>([pedido.cliente_id]);
  listaOfertas.forEach((o) => ids.add(o.comprador_id));
  eventos.forEach((e) => e.actor_id && ids.add(e.actor_id));
  mensajes.forEach((m) => ids.add(m.emisor_id));
  listaDisputas.forEach((d) => ids.add(d.abierta_por));
  listaNotas.forEach((c) => ids.add(c.califica_id));
  const { data: gente } = await supabase
    .from('v_reputacion')
    .select('perfil_id, nombre_completo, foto_path')
    .in('perfil_id', [...ids]);
  const nombres: Record<string, { nombre: string; foto: string | null }> = {};
  (gente ?? []).forEach((g: { perfil_id: string; nombre_completo: string; foto_path?: string | null }) => {
    nombres[g.perfil_id] = { nombre: g.nombre_completo || 'Sin nombre', foto: g.foto_path ?? null };
  });

  return {
    pedido,
    ofertas: listaOfertas,
    pago,
    eventos,
    mensajes,
    disputas: listaDisputas,
    calificaciones: listaNotas,
    nombres,
  };
}

export type DetallePedidoAdmin = NonNullable<Awaited<ReturnType<typeof detallePedidoAdmin>>>;

/** Moderación: quita una foto de perfil inapropiada y borra el archivo. */
export async function quitarFotoDe(perfilId: string) {
  const { data, error } = await supabase.rpc('admin_quitar_foto', { p_perfil: perfilId });
  revienta(error);
  if (typeof data === 'string' && data) {
    await supabase.storage.from('avatares').remove([data]).catch(() => undefined);
  }
}

export async function suspenderCuenta(perfilId: string, suspender: boolean, motivo?: string) {
  const { error } = await supabase.rpc('admin_suspender_cuenta', {
    p_perfil: perfilId,
    p_suspender: suspender,
    p_motivo: motivo ?? null,
  });
  revienta(error);
}

export async function asignarRol(perfilId: string, rol: 'operador' | 'admin', activo: boolean) {
  const { error } = await supabase.rpc('admin_asignar_rol', {
    p_perfil: perfilId,
    p_rol: rol,
    p_activo: activo,
  });
  revienta(error);
}

export async function historialVerificaciones(
  filtro: FiltroVerificaciones = 'todas',
  limite = 150,
): Promise<VerificacionHistorial[]> {
  const { data, error } = await supabase.rpc('admin_verificaciones', {
    p_filtro: filtro,
    p_limite: limite,
  });
  revienta(error);
  return (data ?? []) as VerificacionHistorial[];
}

export async function pedidosAdmin(opts: {
  estado?: string | null;
  busqueda?: string;
  limite?: number;
  desde?: number;
}): Promise<PedidoAdmin[]> {
  const { data, error } = await supabase.rpc('admin_pedidos', {
    p_estado: opts.estado ?? null,
    p_busqueda: opts.busqueda ?? null,
    p_limite: opts.limite ?? 50,
    p_desde: opts.desde ?? 0,
  });
  revienta(error);
  return (data ?? []) as PedidoAdmin[];
}

export async function pagosAdmin(estado?: string | null, limite = 200): Promise<PagoAdmin[]> {
  const { data, error } = await supabase.rpc('admin_pagos', {
    p_estado: estado ?? null,
    p_limite: limite,
  });
  revienta(error);
  return (data ?? []) as PagoAdmin[];
}

export async function configuracion(): Promise<ConfigItem[]> {
  const { data, error } = await supabase.from('config').select('*').order('clave');
  revienta(error);
  return (data ?? []) as ConfigItem[];
}

export async function actualizarConfig(clave: string, valor: number) {
  const { error } = await supabase.rpc('admin_actualizar_config', {
    p_clave: clave,
    p_valor: valor,
  });
  revienta(error);
}

export async function bitacoraAdmin(
  limite = 200,
  tipo?: string | null,
): Promise<EntradaBitacora[]> {
  const { data, error } = await supabase.rpc('admin_bitacora', {
    p_limite: limite,
    p_tipo: tipo ?? null,
  });
  revienta(error);
  return (data ?? []) as EntradaBitacora[];
}
