import { createContext, useContext } from 'react';
import {
  Text as TextoNativo,
  TextInput as CampoNativo,
  StyleSheet,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { F } from './tema';

/**
 * Text y TextInput con la tipografía de la marca.
 *
 * Las pantallas escriben sus estilos con fontWeight y fontSize, como siempre.
 * En React Native eso no basta para una fuente propia: cada peso es una
 * familia distinta y Android ignora fontWeight al buscar el archivo. Aquí se
 * traduce una vez, en lugar de poner fontFamily en ciento y pico estilos:
 *
 *   negrita (700+) y 17 px o más   → Bricolage Grotesque, es un título
 *   todo lo demás                  → Instrument Sans, con el peso más cercano
 *
 * Un estilo que ya trae fontFamily se respeta tal cual, y un Text anidado que
 * no dice ni peso ni tamaño hereda la letra del que lo contiene.
 */
const DentroDeTexto = createContext(false);

function familia(estilo: TextStyle): string {
  const peso = estilo.fontWeight === 'bold' ? 700 : Number(estilo.fontWeight) || 400;
  const tamano = estilo.fontSize ?? 14;
  if (peso >= 700 && tamano >= 17) return peso >= 800 ? F.titulo800 : F.titulo700;
  if (peso >= 700) return F.cuerpo700;
  if (peso >= 600) return F.cuerpo600;
  if (peso >= 500) return F.cuerpo500;
  return F.cuerpo400;
}

function conFuente(style: TextProps['style'], anidado = false) {
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (plano.fontFamily) return style;
  if (anidado && plano.fontWeight == null && plano.fontSize == null) return style;
  // fontWeight vuelve a normal: el peso ya lo lleva el archivo de la fuente, y
  // dejarlo haría que el navegador engrosara una letra que ya es gruesa.
  return [style, { fontFamily: familia(plano), fontWeight: 'normal' as const }];
}

export function Text(props: TextProps & { ref?: React.Ref<TextoNativo> }) {
  const anidado = useContext(DentroDeTexto);
  return (
    <DentroDeTexto.Provider value>
      <TextoNativo {...props} style={conFuente(props.style, anidado)} />
    </DentroDeTexto.Provider>
  );
}

export function TextInput(props: TextInputProps & { ref?: React.Ref<CampoNativo> }) {
  return <CampoNativo {...props} style={conFuente(props.style)} />;
}
