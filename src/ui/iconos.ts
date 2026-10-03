import type { EstadoPedido, TipoAviso } from '@/lib/tipos';
import type { NombreIcono } from './componentes';

/**
 * Iconos del negocio. Viven en la capa de interfaz y no en negocio.ts por la
 * misma razón que los colores de tema.ts: el negocio no depende de Ionicons.
 */
export const ICONO_CATEGORIA: Record<string, NombreIcono> = {
  Tecnología: 'phone-portrait-outline',
  'Zapatillas y ropa': 'shirt-outline',
  Videojuegos: 'game-controller-outline',
  Suplementos: 'barbell-outline',
  Cosméticos: 'color-palette-outline',
  Coleccionables: 'diamond-outline',
  Repuestos: 'construct-outline',
  Otros: 'cube-outline',
};

export const iconoCategoria = (c: string): NombreIcono =>
  ICONO_CATEGORIA[c] ?? 'cube-outline';

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
