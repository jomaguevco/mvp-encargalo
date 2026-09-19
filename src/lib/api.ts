import { supabase } from './supabase';
import type {
  Calificacion,
  DesglosePrecio,
  DisputaAbierta,
  EstadoPedido,
  EventoPedido,
  Mensaje,
  MetodoPago,
  Oferta,
  OfertaConReputacion,
  Pago,
  PagoPendiente,
  Pedido,
  Perfil,
  Reputacion,
  VerificacionPendiente,
} from './tipos';

/** Convierte el error de PostgREST en algo que se le pueda mostrar a una persona. */
function revienta(error: { message: string } | null): never | void {
  if (!error) return;
  const m = error.message ?? 'Ocurrió un error';
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
 */
export async function enviarVerificacion(opts: {
  dni: string;
  dniFrenteUri: string;
  selfieUri: string;
}) {
  const { data: sesion } = await supabase.auth.getUser();
  const uid = sesion.user?.id;
  if (!uid) throw new Error('No hay sesión activa');

  if (!/^[0-9]{8}$/.test(opts.dni)) {
    throw new Error('El DNI debe tener exactamente 8 dígitos');
  }

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
}

// ---------------------------------------------------------------- archivos
export async function subirArchivo(bucket: string, ruta: string, uri: string) {
  const respuesta = await fetch(uri);
  const blob = await respuesta.arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });
  revienta(error);
  return ruta;
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
