import type {
  EstadoOferta,
  EstadoPago,
  EstadoPedido,
  EstadoVerificacion,
} from './tipos';

export const soles = (n: number | null | undefined) =>
  n == null ? '—' : `S/ ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

export const fecha = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const fechaHora = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fecha(iso)} · ${d.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const diasHasta = (iso: string) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
};

/** Los nueve estados del pedido, en el orden en que ocurren. */
export const PASOS: EstadoPedido[] = [
  'publicado',
  'aceptado',
  'pagado',
  'comprado',
  'en_viaje',
  'entregado',
  'confirmado',
];

/**
 * Los colores de los estados son los mismos de `ui/tema.ts`, escritos aquí en
 * hexadecimal porque este archivo describe el negocio y no debería depender de
 * la capa de interfaz. Si se cambia la paleta, hay que cambiarlos en los dos
 * sitios: son seis valores y la alternativa era acoplar el negocio al tema.
 */
type Info = { etiqueta: string; detalle: string; color: string };

export const ESTADO_PEDIDO: Record<EstadoPedido, Info> = {
  publicado: {
    etiqueta: 'Publicado',
    detalle: 'Esperando ofertas de compradores externos',
    color: '#2E6A55',
  },
  aceptado: {
    etiqueta: 'Aceptado',
    detalle: 'Elegiste una oferta. Falta que pagues para asegurar el pedido',
    color: '#C65A3A',
  },
  pagado: {
    etiqueta: 'Pago retenido',
    detalle: 'Tu dinero está protegido. El comprador externo ya puede comprar',
    color: '#3B7F4C',
  },
  comprado: {
    etiqueta: 'Producto comprado',
    detalle: 'El comprador externo ya adquirió tu producto',
    color: '#3B7F4C',
  },
  en_viaje: {
    etiqueta: 'En viaje',
    detalle: 'Tu producto está en camino al Perú',
    color: '#3B7F4C',
  },
  entregado: {
    etiqueta: 'Entregado',
    detalle: 'El comprador externo marcó la entrega. Confirma si lo recibiste',
    color: '#C65A3A',
  },
  confirmado: {
    etiqueta: 'Confirmado',
    detalle: 'Recibiste tu pedido y el pago fue liberado',
    color: '#3B7F4C',
  },
  en_disputa: {
    etiqueta: 'En disputa',
    detalle: 'Tu dinero sigue retenido mientras revisamos el caso',
    color: '#A8322A',
  },
  cancelado: {
    etiqueta: 'Cancelado',
    detalle: 'Este pedido ya no está activo',
    color: '#8A8276',
  },
};

export const ESTADO_PAGO: Record<EstadoPago, Info> = {
  pendiente: {
    etiqueta: 'Sin pagar',
    detalle: 'Todavía no reportaste el pago',
    color: '#C65A3A',
  },
  en_revision: {
    etiqueta: 'Verificando pago',
    detalle: 'Recibimos tu comprobante y lo estamos validando',
    color: '#C65A3A',
  },
  retenido: {
    etiqueta: 'Dinero retenido',
    detalle: 'Encárgalo tiene tu dinero. No se mueve hasta que confirmes',
    color: '#3B7F4C',
  },
  liberado: {
    etiqueta: 'Pago liberado',
    detalle: 'El comprador externo ya recibió su dinero',
    color: '#3B7F4C',
  },
  reembolsado: {
    etiqueta: 'Reembolsado',
    detalle: 'Te devolvimos el dinero',
    color: '#2E6A55',
  },
};

export const ESTADO_VERIFICACION: Record<EstadoVerificacion, Info> = {
  pendiente: {
    etiqueta: 'Sin verificar',
    detalle: 'Verifica tu identidad para publicar pedidos u ofertar',
    color: '#C65A3A',
  },
  en_revision: {
    etiqueta: 'En revisión',
    detalle: 'Estamos validando tu DNI. Suele tomar menos de 24 horas',
    color: '#C65A3A',
  },
  verificado: {
    etiqueta: 'Identidad verificada',
    detalle: 'Tu DNI fue validado. Ya puedes operar',
    color: '#3B7F4C',
  },
  rechazado: {
    etiqueta: 'Verificación rechazada',
    detalle: 'No pudimos validar tus documentos',
    color: '#A8322A',
  },
};

export const CATEGORIAS = [
  'Tecnología',
  'Zapatillas y ropa',
  'Videojuegos',
  'Suplementos',
  'Cosméticos',
  'Coleccionables',
  'Repuestos',
  'Otros',
];

/** Qué puede hacer el comprador externo según el estado actual. */
export const SIGUIENTE_PASO_COMPRADOR: Partial<
  Record<EstadoPedido, { siguiente: EstadoPedido; accion: string }>
> = {
  pagado: { siguiente: 'comprado', accion: 'Ya compré el producto' },
  comprado: { siguiente: 'en_viaje', accion: 'El producto está en viaje' },
  en_viaje: { siguiente: 'entregado', accion: 'Ya lo entregué' },
};

/** Cómo se muestra cada aviso en la bandeja. */
export const TIPO_AVISO: Record<
  'oferta' | 'pedido' | 'pago' | 'mensaje' | 'calificacion' | 'verificacion',
  { etiqueta: string; color: string }
> = {
  oferta: { etiqueta: 'Oferta', color: '#2E6A55' },
  pedido: { etiqueta: 'Pedido', color: '#C65A3A' },
  pago: { etiqueta: 'Dinero', color: '#3B7F4C' },
  mensaje: { etiqueta: 'Mensaje', color: '#2E6A55' },
  calificacion: { etiqueta: 'Reputación', color: '#9C6B12' },
  verificacion: { etiqueta: 'Identidad', color: '#3B7F4C' },
};

export const ESTADO_OFERTA: Record<EstadoOferta, { etiqueta: string; color: string }> = {
  enviada: { etiqueta: 'Esperando respuesta', color: '#C65A3A' },
  aceptada: { etiqueta: 'Aceptada', color: '#3B7F4C' },
  rechazada: { etiqueta: 'No elegida', color: '#8A8276' },
  retirada: { etiqueta: 'Retirada', color: '#8A8276' },
};

/** Estados del pedido en los que cualquiera de las dos partes puede disputar. */
export const DISPUTABLES: EstadoPedido[] = [
  'pagado',
  'comprado',
  'en_viaje',
  'entregado',
];

/** Estados en los que el cliente todavía puede cancelar desde la app. */
export const CANCELABLES: EstadoPedido[] = ['publicado', 'aceptado'];

/** «hace 3 días», «hace 2 h». Para la bandeja de avisos y el chat. */
export const hace = (iso: string) => {
  const seg = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return 'ahora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} día${d === 1 ? '' : 's'}`;
  return fecha(iso);
};

// ------------------------------------------------- medición del plan de marketing
/**
 * De dónde llegó el usuario (requisito R16). Es una lista cerrada a propósito:
 * con texto libre, «insta», «IG» e «instagram» serían tres canales distintos y la
 * medición de cada acción del plan de marketing dejaría de cuadrar.
 */
export const ORIGENES = [
  { valor: 'instagram', etiqueta: 'Instagram' },
  { valor: 'tiktok', etiqueta: 'TikTok' },
  { valor: 'facebook', etiqueta: 'Grupo de Facebook' },
  { valor: 'activacion', etiqueta: 'Módulo en mi universidad' },
  { valor: 'volante', etiqueta: 'Volante' },
  { valor: 'referido', etiqueta: 'Me lo recomendaron' },
  { valor: 'otro', etiqueta: 'Otro' },
] as const;

/** Versión de los términos que el usuario acepta. Cambia cuando cambia el texto. */
export const VERSION_TERMINOS = '2026-10-borrador';

/**
 * Código de referido de un usuario (requisito R18): las seis primeras letras de
 * su identificador, en mayúsculas. No necesita columna nueva: el operador lo
 * cruza con upper(left(id::text, 6)) en la consulta Q11.
 */
export const codigoReferidoDe = (perfilId: string) =>
  perfilId.replace(/-/g, '').slice(0, 6).toUpperCase();

/**
 * Lo que no se puede encargar (acción ES-16). La lista sigue las mercancías
 * restringidas o prohibidas para envíos de entrega rápida y equipaje.
 */
export const PROHIBIDOS = [
  'Medicamentos y suplementos con receta',
  'Armas, municiones, réplicas y piezas',
  'Alimentos frescos, plantas y semillas',
  'Productos inflamables, baterías sueltas y aerosoles',
  'Dinero, joyas de alto valor y bienes de origen dudoso',
  'Drogas y productos con sustancias controladas',
];

/** Umbral desde el que un envío paga impuestos de importación (US$). */
export const UMBRAL_IMPUESTO_USD = 200;

/** «DELGADO HUAMANI» → «Delgado Huamani». RENIEC devuelve todo en mayúsculas. */
export const tipoTitulo = (t: string) =>
  t
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (['de', 'del', 'la', 'las', 'los', 'y'].includes(p) ? p : p[0].toUpperCase() + p.slice(1)))
    .join(' ');

/** Nombre completo como lo escribiría una persona: nombres y luego apellidos. */
export const nombreDeReniec = (p: {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}) => tipoTitulo(`${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`);

/** Iniciales para el avatar: «Mariano Guevara» → «MG». */
export const iniciales = (nombre: string | null | undefined) =>
  (nombre ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Misma regla que supabase/functions/validar-dni/nombres.ts: coincide si la
 * persona declaró al menos dos palabras y todas están en el nombre de RENIEC.
 * Aquí solo sirve para avisar antes de enviar; la que cuenta es la del servidor.
 */
export function coincideConReniec(
  declarado: string,
  reniec: { nombres: string; apellidoPaterno: string; apellidoMaterno: string },
) {
  const particulas = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA']);
  const palabras = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]+/g, ' ')
      .split(' ')
      .filter((p) => p.length >= 2 && !particulas.has(p));
  const mias = palabras(declarado);
  if (mias.length < 2) return false;
  const suyas = new Set(
    palabras(`${reniec.nombres} ${reniec.apellidoPaterno} ${reniec.apellidoMaterno}`),
  );
  return mias.every((p) => suyas.has(p));
}
