import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { C, E, R, T, sombra } from './tema';

/**
 * Piezas de interfaz de Encárgalo.
 *
 * Los nombres y las propiedades son los mismos que antes: quince pantallas los
 * usan y ninguna tuvo que tocarse. Lo que cambió es cómo se ven.
 */

// ------------------------------------------------------------------ texto
type TextoProps = TextProps & { children: ReactNode };

export function Titulo({ children, style, ...rest }: TextoProps) {
  return (
    <Text {...rest} style={[s.titulo, style]}>
      {children}
    </Text>
  );
}

export function Subtitulo({ children, style, ...rest }: TextoProps) {
  return (
    <Text {...rest} style={[s.subtitulo, style]}>
      {children}
    </Text>
  );
}

export function Parrafo({
  children,
  suave,
  style,
  ...rest
}: TextoProps & { suave?: boolean }) {
  return (
    <Text {...rest} style={[s.parrafo, suave && s.parrafoSuave, style]}>
      {children}
    </Text>
  );
}

export function Micro({ children, style, ...rest }: TextoProps) {
  return (
    <Text {...rest} style={[s.micro, style]}>
      {children}
    </Text>
  );
}

// ------------------------------------------------------------------ botón
type BotonProps = {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'fantasma' | 'peligro';
  cargando?: boolean;
  deshabilitado?: boolean;
  style?: ViewStyle;
};

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  cargando,
  deshabilitado,
  style,
}: BotonProps) {
  const inactivo = deshabilitado || cargando;
  const fondo = {
    primario: C.naranja,
    secundario: C.azul,
    fantasma: 'transparent',
    peligro: C.rojo,
  }[variante];
  const colorTexto = variante === 'fantasma' ? C.azul : C.blanco;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
      style={({ pressed }) => [
        s.boton,
        { backgroundColor: fondo },
        // Los botones rellenos llevan sombra; el fantasma no, porque una
        // sombra sin fondo se ve como una mancha.
        variante !== 'fantasma' && !inactivo && sombra(2),
        variante === 'fantasma' && s.botonFantasma,
        // Hundirse un punto al pulsar da la sensación de que el botón
        // responde, que es lo que hace que una interfaz se sienta viva.
        pressed && !inactivo && { transform: [{ scale: 0.985 }], opacity: 0.9 },
        inactivo && { opacity: 0.4 },
        style,
      ]}>
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <Text style={[s.botonTexto, { color: colorTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

// ------------------------------------------------------------------ campo
type CampoProps = TextInputProps & {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
};

export function Campo({
  etiqueta,
  ayuda,
  error,
  style,
  onFocus,
  onBlur,
  ...rest
}: CampoProps) {
  // El borde se ilumina al escribir. Sin esto, en un formulario de seis campos
  // no hay forma de saber en cuál estás si el teclado tapa media pantalla.
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={s.campoBloque}>
      <Text style={s.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        placeholderTextColor="#98A6B8"
        {...rest}
        onFocus={(e) => {
          setEnfocado(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setEnfocado(false);
          onBlur?.(e);
        }}
        style={[
          s.campo,
          enfocado && s.campoEnfocado,
          !!error && s.campoError,
          style,
        ]}
      />
      {!!ayuda && !error && <Text style={s.campoAyuda}>{ayuda}</Text>}
      {!!error && <Text style={s.campoMensajeError}>{error}</Text>}
    </View>
  );
}

// ------------------------------------------------------------------ tarjeta
export function Tarjeta({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.tarjeta,
          pressed && { transform: [{ scale: 0.99 }], borderColor: C.bordeFuerte },
          style,
        ]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

// ------------------------------------------------------------------ etiqueta de estado
export function Chip({
  texto,
  color,
  fondo,
}: {
  texto: string;
  color: string;
  fondo?: string;
}) {
  return (
    <View style={[s.chip, { backgroundColor: fondo ?? `${color}14` }]}>
      <View style={[s.chipPunto, { backgroundColor: color }]} />
      <Text style={[s.chipTexto, { color }]}>{texto}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ aviso
export function Aviso({
  tono = 'info',
  titulo,
  children,
}: {
  tono?: 'info' | 'exito' | 'alerta' | 'error';
  titulo?: string;
  children: ReactNode;
}) {
  const estilos = {
    info: { bg: C.azulClaro, bd: C.azulMedio, tx: C.azul },
    exito: { bg: C.verdeClaro, bd: C.verde, tx: '#0B5B41' },
    alerta: { bg: C.ambarClaro, bd: C.ambar, tx: '#7A3D06' },
    error: { bg: C.rojoClaro, bd: C.rojo, tx: '#8A1B12' },
  }[tono];

  return (
    <View
      accessibilityLiveRegion={tono === 'error' ? 'assertive' : 'polite'}
      style={[s.aviso, { backgroundColor: estilos.bg }]}>
      {/* Barra de color a la izquierda, con las esquinas redondeadas del
          propio aviso: antes era un borde recto que rompía la curva. */}
      <View style={[s.avisoBarra, { backgroundColor: estilos.bd }]} />
      <View style={s.avisoCuerpo}>
        {!!titulo && (
          <Text style={[s.avisoTitulo, { color: estilos.tx }]}>{titulo}</Text>
        )}
        <Text style={[s.avisoTexto, { color: estilos.tx }]}>{children}</Text>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ fila dato
export function Dato({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <View style={s.dato}>
      <Text style={[s.datoEtiqueta, fuerte && { color: C.texto, fontWeight: '700' }]}>
        {etiqueta}
      </Text>
      <Text style={[s.datoValor, fuerte && s.datoValorFuerte]}>{valor}</Text>
    </View>
  );
}

export function Separador() {
  return <View style={s.separador} />;
}

export function Cargando({ texto }: { texto?: string }) {
  return (
    <View style={s.centro}>
      <ActivityIndicator color={C.naranja} size="large" />
      {!!texto && <Text style={[s.parrafoSuave, { marginTop: E.md }]}>{texto}</Text>}
    </View>
  );
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <View style={s.centro}>
      {/* Un círculo suave en lugar de texto a secas: una pantalla vacía sin
          nada centrado parece que no terminó de cargar. */}
      <View style={s.vacioMarca} />
      <Text style={s.vacioTitulo}>{titulo}</Text>
      {!!detalle && <Text style={s.vacioDetalle}>{detalle}</Text>}
    </View>
  );
}

// ------------------------------------------------------------------ selector
export function Opciones<T extends string>({
  valor,
  opciones,
  onChange,
}: {
  valor: T | null;
  opciones: { valor: T; etiqueta: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.opciones}>
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onChange(o.valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activa }}
            style={({ pressed }) => [
              s.opcion,
              activa && s.opcionActiva,
              pressed && { opacity: 0.8 },
            ]}>
            <Text style={[s.opcionTexto, activa && s.opcionTextoActivo]}>
              {o.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  titulo: { ...T.titulo, color: C.azul },
  subtitulo: { ...T.subtitulo, color: C.azul, marginBottom: E.xs },
  parrafo: { ...T.cuerpo, color: C.texto, lineHeight: 23 },
  parrafoSuave: { color: C.textoSuave, fontSize: 14.5, lineHeight: 22 },
  micro: { ...T.micro, color: C.textoSuave },

  boton: {
    height: 54,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: E.lg,
  },
  botonFantasma: {
    borderWidth: 1.5,
    borderColor: C.bordeFuerte,
    height: 50,
    backgroundColor: C.blanco,
  },
  botonTexto: { fontSize: 16.5, fontWeight: '800', letterSpacing: -0.2 },

  campoBloque: { marginBottom: E.lg },
  campoEtiqueta: {
    fontSize: 13.5,
    fontWeight: '700',
    color: C.azul,
    marginBottom: E.xs + 2,
  },
  campo: {
    borderWidth: 1.5,
    borderColor: C.borde,
    backgroundColor: C.blanco,
    borderRadius: R.md,
    paddingHorizontal: E.md + 2,
    paddingVertical: 14,
    fontSize: 15.5,
    color: C.texto,
  },
  campoEnfocado: { borderColor: C.azulMedio, backgroundColor: C.blanco },
  campoError: { borderColor: C.rojo, backgroundColor: '#FFFBFA' },
  campoAyuda: { fontSize: 12.5, color: C.textoSuave, marginTop: E.xs + 1 },
  campoMensajeError: {
    fontSize: 12.5,
    color: C.rojo,
    marginTop: E.xs + 1,
    fontWeight: '600',
  },

  tarjeta: {
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    padding: E.lg + 2,
    borderWidth: 1,
    borderColor: C.borde,
    marginBottom: E.md,
    ...sombra(1),
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: E.sm + 4,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  chipPunto: { width: 7, height: 7, borderRadius: 4 },
  chipTexto: { fontSize: 12.5, fontWeight: '800', letterSpacing: -0.1 },

  aviso: {
    flexDirection: 'row',
    borderRadius: R.md,
    marginBottom: E.md,
    overflow: 'hidden',
  },
  avisoBarra: { width: 4 },
  avisoCuerpo: { flex: 1, paddingVertical: E.md, paddingHorizontal: E.md + 2 },
  avisoTitulo: { fontSize: 14.5, fontWeight: '800', marginBottom: 3 },
  avisoTexto: { fontSize: 14, lineHeight: 21 },

  dato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: E.md,
  },
  datoEtiqueta: { fontSize: 14.5, color: C.textoSuave, flexShrink: 1 },
  datoValor: { fontSize: 14.5, fontWeight: '700', color: C.texto },
  datoValorFuerte: { fontSize: 17, color: C.azul, fontWeight: '800' },

  separador: { height: 1, backgroundColor: C.borde, marginVertical: E.md },

  centro: { alignItems: 'center', justifyContent: 'center', padding: E.xxl },
  vacioMarca: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.superficieSuave,
    borderWidth: 1.5,
    borderColor: C.borde,
    marginBottom: E.lg,
  },
  vacioTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: C.azul,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  vacioDetalle: {
    fontSize: 14.5,
    color: C.textoSuave,
    textAlign: 'center',
    marginTop: E.sm,
    lineHeight: 22,
  },

  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: E.sm },
  opcion: {
    paddingHorizontal: E.md + 2,
    paddingVertical: E.sm + 3,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.borde,
    backgroundColor: C.blanco,
  },
  opcionActiva: { borderColor: C.azulMedio, backgroundColor: C.azulClaro },
  opcionTexto: { fontSize: 14, color: C.textoSuave, fontWeight: '700' },
  opcionTextoActivo: { color: C.azul, fontWeight: '800' },
});
