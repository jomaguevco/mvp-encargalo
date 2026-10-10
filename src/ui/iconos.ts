import type { EstadoPedido, TipoAviso } from '@/lib/tipos';
import type { NombreIcono } from './componentes';

/**
 * Iconos del negocio. Viven en la capa de interfaz y no en negocio.ts por la
 * misma razón que los colores de tema.ts: el negocio no depende de Ionicons.
 */
/**
 * Cada categoría tiene su ícono, su color y un fondo claro del mismo tono. En
 * las listas es lo que hace que un pedido se reconozca de un vistazo sin leer
 * el título, y lo que evita que todas las tarjetas sin foto se vean iguales.
 *
 * Son tonos de tierra, de la misma familia que Monte, Terracota y Trigo: se
 * distinguen entre sí sin pelearse con la marca.
 */
type EstiloCategoria = { icono: NombreIcono; color: string; fondo: string };

export const ESTILO_CATEGORIA: Record<string, EstiloCategoria> = {
  Tecnología: { icono: 'phone-portrait', color: '#2E6A55', fondo: '#DDE8E0' },
  'Zapatillas y ropa': { icono: 'shirt', color: '#C65A3A', fondo: '#F6E0D6' },
  Videojuegos: { icono: 'game-controller', color: '#6A4E6B', fondo: '#EBE0EA' },
  Suplementos: { icono: 'barbell', color: '#3B7F4C', fondo: '#DFEEDD' },
  Cosméticos: { icono: 'sparkles', color: '#A8475E', fondo: '#F5DFE3' },
  Coleccionables: { icono: 'diamond', color: '#9C6B12', fondo: '#F5EACB' },
  Repuestos: { icono: 'construct', color: '#5E5A50', fondo: '#E9E3D8' },
  Otros: { icono: 'cube', color: '#14352B', fondo: '#E3E9E1' },
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
