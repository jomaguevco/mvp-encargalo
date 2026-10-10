import type { EstadoPedido, TipoAviso } from '@/lib/tipos';
import type { NombreIcono } from './componentes';

/**
 * Iconos del negocio. Viven en la capa de interfaz y no en negocio.ts por la
 * misma razón que los colores de tema.ts: el negocio no depende de Ionicons.
 */
/**
 * Cada categoría tiene su ícono y su par de colores. En las listas es lo que
 * hace que un pedido se reconozca de un vistazo sin leer el título, y lo que
 * evita que todas las tarjetas sin foto se vean iguales.
 */
type EstiloCategoria = { icono: NombreIcono; colores: readonly [string, string] };

export const ESTILO_CATEGORIA: Record<string, EstiloCategoria> = {
  Tecnología: { icono: 'phone-portrait', colores: ['#6366F1', '#4338CA'] },
  'Zapatillas y ropa': { icono: 'shirt', colores: ['#F97316', '#C2410C'] },
  Videojuegos: { icono: 'game-controller', colores: ['#8B5CF6', '#6D28D9'] },
  Suplementos: { icono: 'barbell', colores: ['#10B981', '#047857'] },
  Cosméticos: { icono: 'sparkles', colores: ['#EC4899', '#BE185D'] },
  Coleccionables: { icono: 'diamond', colores: ['#F59E0B', '#B45309'] },
  Repuestos: { icono: 'construct', colores: ['#64748B', '#334155'] },
  Otros: { icono: 'cube', colores: ['#2A6BA8', '#0E3255'] },
};

/** Nombres que se usaron antes de fijar la lista de CATEGORIAS. */
const ALIAS: Record<string, string> = {
  Electrónica: 'Tecnología',
  Moda: 'Zapatillas y ropa',
  Accesorios: 'Zapatillas y ropa',
  Belleza: 'Cosméticos',
  Salud: 'Suplementos',
  Juguetes: 'Coleccionables',
};

export const estiloCategoria = (c: string): EstiloCategoria =>
  ESTILO_CATEGORIA[c] ?? ESTILO_CATEGORIA[ALIAS[c] ?? ''] ?? ESTILO_CATEGORIA.Otros;

export const iconoCategoria = (c: string): NombreIcono =>
  `${estiloCategoria(c).icono}-outline` as NombreIcono;

export const ICONO_ESTADO: Record<EstadoPedido, NombreIcono> = {
  publicado: 'megaphone-outline',
  aceptado: 'hand-left-outline',
  pagado: 'lock-closed',
  comprado: 'bag-check-outline',
  en_viaje: 'airplane',
  entregado: 'cube',
  confirmado: 'checkmark-done-circle',
  en_disputa: 'alert-circle',
  cancelado: 'close-circle',
};

export const ICONO_AVISO: Record<TipoAviso, NombreIcono> = {
  oferta: 'pricetag',
  pedido: 'cube',
  pago: 'wallet',
  mensaje: 'chatbubble-ellipses',
  calificacion: 'star',
  verificacion: 'shield-checkmark',
};
