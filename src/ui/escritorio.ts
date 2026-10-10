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
/** Ancho máximo de los formularios y el detalle del pedido. */
export const ANCHO_FORMULARIO = 900;
/** Ancho útil a partir del cual las listas pasan a tres columnas. */
const ANCHO_TRES_COLUMNAS = 1180;

export function useEscritorio() {
  const { width } = useWindowDimensions();
  const es = Platform.OS === 'web' && width >= ANCHO_ESCRITORIO;
  const disponible = width - ANCHO_LATERAL;
  const margenPestana = es ? Math.max(E.xl, (disponible - ANCHO_CONTENIDO) / 2) : 0;
  return {
    es,
    /** Margen lateral del contenido de una pestaña, junto a la barra lateral. */
    margenPestana,
    /** Margen lateral que centra un formulario a pantalla completa. */
    margenFormulario: es ? Math.max(E.xl, (width - ANCHO_FORMULARIO) / 2) : 0,
    /** Columnas de las listas de pedidos. */
    columnas: !es ? 1 : disponible - 2 * margenPestana >= ANCHO_TRES_COLUMNAS ? 3 : 2,
  };
}
