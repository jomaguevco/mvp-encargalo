import { Platform, useWindowDimensions } from 'react-native';
import { E } from './tema';

/**
 * Diseño de escritorio para la versión web.
 *
 * Las pantallas nacieron para el teléfono. En un navegador ancho se muestran
 * como una aplicación web: barra lateral en vez de pestañas abajo, contenido
 * centrado con un ancho de lectura cómodo y las listas en dos columnas. En
 * Android, iOS y en la web desde un teléfono nada de esto se activa.
 */
export const ANCHO_ESCRITORIO = 900;
export const ANCHO_LATERAL = 248;
/** Ancho máximo del contenido de las pestañas (listas, consola, perfil). */
export const ANCHO_CONTENIDO = 1040;
/** Ancho máximo de los formularios y el detalle del pedido. */
export const ANCHO_FORMULARIO = 760;

export function useEscritorio() {
  const { width } = useWindowDimensions();
  const es = Platform.OS === 'web' && width >= ANCHO_ESCRITORIO;
  return {
    es,
    /** Margen lateral que centra el contenido de una pestaña junto a la barra lateral. */
    margenPestana: es ? Math.max(E.xl, (width - ANCHO_LATERAL - ANCHO_CONTENIDO) / 2) : 0,
    /** Margen lateral que centra un formulario a pantalla completa. */
    margenFormulario: es ? Math.max(E.xl, (width - ANCHO_FORMULARIO) / 2) : 0,
  };
}
