import type { EstadoPago, EstadoPedido, EstadoVerificacion } from './tipos';

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

type Info = { etiqueta: string; detalle: string; color: string };

export const ESTADO_PEDIDO: Record<EstadoPedido, Info> = {
  publicado: {
    etiqueta: 'Publicado',
    detalle: 'Esperando ofertas de compradores externos',
    color: '#2E5C9A',
  },
  aceptado: {
    etiqueta: 'Aceptado',
    detalle: 'Elegiste una oferta. Falta que pagues para asegurar el pedido',
    color: '#ED7D31',
  },
  pagado: {
    etiqueta: 'Pago retenido',
    detalle: 'Tu dinero está protegido. El comprador externo ya puede comprar',
    color: '#377C4E',
  },
  comprado: {
    etiqueta: 'Producto comprado',
    detalle: 'El comprador externo ya adquirió tu producto',
    color: '#377C4E',
  },
  en_viaje: {
    etiqueta: 'En viaje',
    detalle: 'Tu producto está en camino al Perú',
    color: '#377C4E',
  },
  entregado: {
    etiqueta: 'Entregado',
    detalle: 'El comprador externo marcó la entrega. Confirma si lo recibiste',
    color: '#ED7D31',
  },
  confirmado: {
    etiqueta: 'Confirmado',
    detalle: 'Recibiste tu pedido y el pago fue liberado',
    color: '#377C4E',
  },
  en_disputa: {
    etiqueta: 'En disputa',
    detalle: 'Tu dinero sigue retenido mientras revisamos el caso',
    color: '#C00000',
  },
  cancelado: {
    etiqueta: 'Cancelado',
    detalle: 'Este pedido ya no está activo',
    color: '#767676',
  },
};

export const ESTADO_PAGO: Record<EstadoPago, Info> = {
  pendiente: {
    etiqueta: 'Sin pagar',
    detalle: 'Todavía no reportaste el pago',
    color: '#ED7D31',
  },
  en_revision: {
    etiqueta: 'Verificando pago',
    detalle: 'Recibimos tu comprobante y lo estamos validando',
    color: '#ED7D31',
  },
  retenido: {
    etiqueta: 'Dinero retenido',
    detalle: 'Encárgalo tiene tu dinero. No se mueve hasta que confirmes',
    color: '#377C4E',
  },
  liberado: {
    etiqueta: 'Pago liberado',
    detalle: 'El comprador externo ya recibió su dinero',
    color: '#377C4E',
  },
  reembolsado: {
    etiqueta: 'Reembolsado',
    detalle: 'Te devolvimos el dinero',
    color: '#2E5C9A',
  },
};

export const ESTADO_VERIFICACION: Record<EstadoVerificacion, Info> = {
  pendiente: {
    etiqueta: 'Sin verificar',
    detalle: 'Verifica tu identidad para publicar pedidos u ofertar',
    color: '#ED7D31',
  },
  en_revision: {
    etiqueta: 'En revisión',
    detalle: 'Estamos validando tu DNI. Suele tomar menos de 24 horas',
    color: '#ED7D31',
  },
  verificado: {
    etiqueta: 'Identidad verificada',
    detalle: 'Tu DNI fue validado. Ya puedes operar',
    color: '#377C4E',
  },
  rechazado: {
    etiqueta: 'Verificación rechazada',
    detalle: 'No pudimos validar tus documentos',
    color: '#C00000',
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
