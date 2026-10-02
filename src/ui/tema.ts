import { Platform } from 'react-native';

/**
 * Paleta de Encárgalo.
 *
 * La lógica de marca no cambia: el azul comunica seguridad y el naranja es la
 * acción. Lo que cambió son los tonos. Los anteriores venían de la paleta por
 * defecto de Office —ese azul #1F3864 y ese naranja #ED7D31— y le daban a la
 * aplicación el aire de una plantilla de Word. Son los mismos colores, más
 * profundos y más limpios:
 *
 *   azul    #1F3864 → #0E3255   navy más profundo, mejor contraste en blanco
 *   naranja #ED7D31 → #EE6C34   coral más cálido y saturado, menos apagado
 *   verde   #377C4E → #12805C   esmeralda en vez de verde oliva
 *   rojo    #C00000 → #B42318   ladrillo; el rojo puro grita y cansa
 *
 * Los nombres de las claves se conservan a propósito: quince pantallas los
 * usan, y renombrarlos habría sido cambiar trescientas líneas para no ganar
 * nada.
 */
export const C = {
  azul: '#0E3255',
  azulMedio: '#2A6BA8',
  azulClaro: '#DCE9F7',
  azulFondo: '#F2F6FC',
  naranja: '#EE6C34',
  naranjaClaro: '#FDE8DC',
  verde: '#12805C',
  verdeClaro: '#D8F0E5',
  rojo: '#B42318',
  rojoClaro: '#FCE5E2',
  ambar: '#B45309',
  ambarClaro: '#FDF0D5',
  texto: '#101828',
  textoSuave: '#5B6B7F',
  borde: '#E3E9F0',
  blanco: '#FFFFFF',
  fondo: '#F5F8FB',

  // Añadidos en el rediseño
  bordeFuerte: '#CDD7E3',
  superficieSuave: '#F0F4F9',
  grisTexto: '#6B7280',
};

/**
 * Radios.
 *
 * Más redondeados que antes (12 → 14 en el radio de uso general). Es el cambio
 * de una línea que más acerca una interfaz a lo que hoy se ve en el teléfono.
 */
export const R = { sm: 10, md: 14, lg: 18, xl: 26 };

export const E = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/**
 * Elevación.
 *
 * Lo que más hacía que la aplicación pareciera plana: todo eran rectángulos
 * blancos con un borde gris de un píxel. Una sombra muy suave separa la tarjeta
 * del fondo y da profundidad sin ensuciar.
 *
 * Android ignora shadow* y iOS ignora elevation, así que hay que declarar los
 * dos. Se resuelve aquí una vez en lugar de en cada componente.
 */
export const sombra = (nivel: 1 | 2 | 3 = 1) => {
  const conf = {
    1: { alto: 1, radio: 3, opacidad: 0.05, elev: 1 },
    2: { alto: 2, radio: 8, opacidad: 0.07, elev: 3 },
    3: { alto: 6, radio: 18, opacidad: 0.1, elev: 8 },
  }[nivel];

  return Platform.select({
    android: { elevation: conf.elev },
    default: {
      shadowColor: '#0E3255',
      shadowOffset: { width: 0, height: conf.alto },
      shadowRadius: conf.radio,
      shadowOpacity: conf.opacidad,
    },
  });
};

/**
 * Tipografía.
 *
 * Todo sube un punto o dos respecto al diseño anterior, que se quedaba en 13–15
 * y se leía apretado. Los títulos llevan letterSpacing negativo: a tamaño
 * grande las letras parecen separarse solas y juntarlas un poco se ve más
 * cuidado.
 */
export const T = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.7 },
  titulo: { fontSize: 25, fontWeight: '800' as const, letterSpacing: -0.5 },
  subtitulo: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  cuerpo: { fontSize: 15.5, fontWeight: '400' as const },
  cuerpoFuerte: { fontSize: 15.5, fontWeight: '700' as const },
  chico: { fontSize: 13.5, fontWeight: '400' as const },
  micro: { fontSize: 12, fontWeight: '600' as const },
  cifra: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8 },
};
