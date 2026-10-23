import { View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C, F, R } from './tema';
import { Text } from './Texto';

/**
 * El símbolo de Encárgalo: la bolsa del encargo y el check que sale de ella.
 * Trazos y medidas copiados de la hoja de marca (encargalo/branding).
 *
 * Las tres reglas de la hoja se cumplen aquí y no en cada pantalla:
 *   - No se estira: el lienzo es siempre cuadrado.
 *   - El check va Terracota sobre claro y Trigo sobre oscuro, nunca al revés.
 *   - El check sale de la bolsa: el trazo no se toca.
 */
const BOLSA = 'M30 50 h60 l5 50 a7 7 0 0 1 -7 8 h-56 a7 7 0 0 1 -7 -8 Z';
const CHECK = 'M38 56 L54 74 L88 24';

export function Simbolo({ tamano = 40, oscuro }: { tamano?: number; oscuro?: boolean }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 120 120" fill="none">
      <Path
        d={BOLSA}
        stroke={oscuro ? C.sobreOscuro : C.azul}
        strokeWidth={8}
        strokeLinejoin="round"
      />
      <Path
        d={CHECK}
        stroke={oscuro ? C.trigo : C.naranja}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Ícono de aplicación: bolsa llena sobre Monte. A tamaños chicos el contorno
 * se cierra solo, por eso aquí la bolsa va rellena.
 */
export function IconoApp({ tamano = 56 }: { tamano?: number }) {
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano * (R.xl / 88),
        backgroundColor: C.azul,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Svg width={tamano * 0.64} height={tamano * 0.64} viewBox="0 0 120 120" fill="none">
        <Path d={BOLSA} fill={C.sobreOscuro} />
        <Path
          d={CHECK}
          stroke={C.naranja}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/**
 * Encaje horizontal: símbolo y nombre. Debajo de 24 px el nombre ya no
 * acompaña al símbolo, así que con `tamano` menor se dibuja solo el símbolo.
 */
export function Logo({
  tamano = 36,
  oscuro,
  style,
}: {
  tamano?: number;
  oscuro?: boolean;
  style?: ViewStyle;
}) {
  if (tamano < 24) return <Simbolo tamano={tamano} oscuro={oscuro} />;
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: tamano * 0.22 }, style]}
      accessibilityRole="image"
      accessibilityLabel="Encárgalo">
      <Simbolo tamano={tamano} oscuro={oscuro} />
      <Text
        style={{
          fontFamily: F.titulo700,
          fontSize: tamano * 0.66,
          letterSpacing: -0.025 * tamano * 0.66,
          color: oscuro ? C.sobreOscuro : C.azul,
        }}>
        Encárgalo
      </Text>
    </View>
  );
}
