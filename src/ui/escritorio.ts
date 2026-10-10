import { Platform, useWindowDimensions } from 'react-native';
import { E } from './tema';

/**
 * Diseño de escritorio para la versión web.
 *
 * Las pantallas nacieron para el teléfono. En un navegador ancho se muestran
 * como una aplicación web: barra lateral en vez de pestañas abajo, contenido
 * que aprovecha el ancho y las listas en dos o tres columnas. En Android, iOS
 * y en la web desde un teléfono nada de esto se activa.
 */
export const ANCHO_ESCRITORIO = 900;
export const ANCHO_LATERAL = 248;
/**
 * Ancho máximo del contenido de las pestañas. Generoso a propósito: con un
 * tope bajo quedaban franjas vacías a los lados en cualquier monitor.
 */
export const ANCHO_CONTENIDO = 1440;
/** Ancho máximo de los formularios. */
export const ANCHO_FORMULARIO = 900;
/** Ancho máximo del detalle del pedido: dos columnas, como una página de producto. */
export const ANCHO_DETALLE = 1200;
/**
 * Ancho mínimo de una tarjeta de producto en la cuadrícula. Las columnas salen
 * de cuántas caben: dos en el teléfono, de tres a cinco en un monitor.
 */
const ANCHO_TARJETA = 270;

export function useEscritorio() {
  const { width } = useWindowDimensions();
  const es = Platform.OS === 'web' && width >= ANCHO_ESCRITORIO;
  const disponible = width - ANCHO_LATERAL;
  const margenPestana = es ? Math.max(E.xl, (disponible - ANCHO_CONTENIDO) / 2) : 0;
  const util = disponible - 2 * margenPestana;
  return {
    es,
    /** Margen lateral del contenido de una pestaña, junto a la barra lateral. */
    margenPestana,
    /** Margen lateral que centra un formulario a pantalla completa. */
    margenFormulario: es ? Math.max(E.xl, (width - ANCHO_FORMULARIO) / 2) : 0,
    /** Margen lateral que centra el detalle del pedido. */
    margenDetalle: es ? Math.max(E.xl, (width - ANCHO_DETALLE) / 2) : 0,
    /**
     * Columnas de la cuadrícula de productos. En el teléfono dos, como una
     * tienda: se ven cuatro pedidos sin desplazar en vez de uno y medio.
     */
    columnas: !es
      ? width >= 600
        ? 3
        : 2
      : Math.max(2, Math.min(5, Math.floor(util / ANCHO_TARJETA))),
  };
}
