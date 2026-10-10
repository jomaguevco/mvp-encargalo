import { Platform } from 'react-native';

/**
 * Paleta de Encárgalo, según la hoja de marca (encargalo/branding).
 *
 * Cuatro colores de marca y nada más:
 *
 *   Monte      #14352B   el color de la casa: cabeceras, títulos, texto fuerte
 *   Terracota  #C65A3A   la acción: botón principal, el check del logo
 *   Trigo      #D9B45A   el acento sobre oscuro (nunca sobre claro: desaparece)
 *   Arena      #F2EBE1   el fondo
 *
 * Los estados (éxito, alerta, error) salen de la misma familia cálida, más
 * apagados que los de una paleta por defecto, para que no compitan con la marca.
 *
 * Los nombres de las claves se conservan a propósito: `azul` ya no es azul sino
 * Monte, y `naranja` es Terracota. Quince pantallas los usan, y renombrarlos
 * habría sido cambiar trescientas líneas para no ganar nada.
 */
export const C = {
  // Monte y sus tonos (antes, el azul)
  azul: '#14352B',
  azulMedio: '#2E6A55',
  azulClaro: '#DDE8E0',
  azulFondo: '#EEF3EE',
  // Terracota (antes, el naranja)
  naranja: '#C65A3A',
  naranjaOscuro: '#9A4526',
  naranjaClaro: '#F6E0D6',
  // Trigo
  trigo: '#D9B45A',
  trigoClaro: '#F5EACB',
  // Estados
  verde: '#3B7F4C',
  verdeClaro: '#DFEEDD',
  verdeOscuro: '#24522F',
  rojo: '#A8322A',
  rojoClaro: '#F6DEDA',
  rojoOscuro: '#7A1F19',
  ambar: '#9C6B12',
  ambarClaro: '#F5EACB',
  ambarOscuro: '#6B4708',
  estrella: '#D19A2A',
  // Texto y superficies
  texto: '#1E2B25',
  textoSuave: '#6B6558',
  grisTexto: '#8A8276',
  borde: '#DCCFBD',
  bordeFuerte: '#C9B9A3',
  blanco: '#FFFFFF',
  fondo: '#F2EBE1',
  superficieSuave: '#F7F2EA',
  /** Texto e iconos sobre Monte */
  sobreOscuro: '#F2EBE1',
  sobreOscuroSuave: '#A9BBA8',
};

/**
 * Radios. La hoja de marca usa 14 en las tarjetas, 9 en las piezas chicas y 20
 * en el ícono de la aplicación.
 */
export const R = { sm: 9, md: 12, lg: 14, xl: 20 };

export const E = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/**
 * Elevación.
 *
 * La marca es plana: lo que separa una tarjeta del fondo Arena es su borde
 * #DCCFBD, no la sombra. Queda una sombra muy leve, teñida de Monte, solo para
 * lo que flota (botón principal, menús).
 *
 * Android ignora shadow* y iOS ignora elevation, así que hay que declarar los
 * dos. Se resuelve aquí una vez en lugar de en cada componente.
 */
export const sombra = (nivel: 1 | 2 | 3 = 1) => {
  const conf = {
    1: { alto: 1, radio: 2, opacidad: 0.04, elev: 0 },
    2: { alto: 2, radio: 6, opacidad: 0.08, elev: 2 },
    3: { alto: 6, radio: 16, opacidad: 0.1, elev: 5 },
  }[nivel];

  return Platform.select({
    android: { elevation: conf.elev },
    default: {
      shadowColor: '#14352B',
      shadowOffset: { width: 0, height: conf.alto },
      shadowRadius: conf.radio,
      shadowOpacity: conf.opacidad,
    },
  });
};

/**
 * Familias tipográficas de la marca: Bricolage Grotesque para lo que se lee
 * como título, Instrument Sans para todo lo demás. Se cargan en app/_layout.
 *
 * En React Native cada peso es una familia aparte (fontWeight no elige el
 * archivo en Android), así que el componente Text de ui/Texto traduce el
 * fontWeight y el tamaño de cada estilo a una de estas.
 */
export const F = {
  titulo500: 'BricolageGrotesque_500Medium',
  titulo700: 'BricolageGrotesque_700Bold',
  titulo800: 'BricolageGrotesque_800ExtraBold',
  cuerpo400: 'InstrumentSans_400Regular',
  cuerpo500: 'InstrumentSans_500Medium',
  cuerpo600: 'InstrumentSans_600SemiBold',
  cuerpo700: 'InstrumentSans_700Bold',
};

/**
 * Tipografía. Los títulos llevan letterSpacing negativo, como el logotipo
 * (-0.025em): a tamaño grande las letras parecen separarse solas.
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

/**
 * Fondos de las piezas destacadas (cabeceras, tarjetas de dinero, banners).
 *
 * Antes eran degradados. La hoja de marca es plana, así que ahora son colores
 * sólidos; los nombres se conservan para que cada pantalla siga diciendo qué
 * comunica («dinero», «alerta») y no qué color lleva.
 */
export const G = {
  marca: '#14352B',
  accion: '#C65A3A',
  exito: '#3B7F4C',
  dinero: '#24522F',
  alerta: '#9C6B12',
  peligro: '#A8322A',
  noche: '#0E261F',
};

/** Colores para avatares: se elige uno por persona, siempre el mismo. */
export const AVATARES = [
  '#14352B',
  '#C65A3A',
  '#3B7F4C',
  '#9A4526',
  '#2E6A55',
  '#8C6A1E',
  '#6E4B3A',
] as const;
