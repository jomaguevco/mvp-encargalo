import { ReactNode } from 'react';
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
import { C, E, R } from './tema';

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
      style={({ pressed }) => [
        s.boton,
        { backgroundColor: fondo },
        variante === 'fantasma' && s.botonFantasma,
        pressed && !inactivo && { opacity: 0.85 },
        inactivo && { opacity: 0.45 },
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

export function Campo({ etiqueta, ayuda, error, style, ...rest }: CampoProps) {
  return (
    <View style={s.campoBloque}>
      <Text style={s.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        placeholderTextColor="#9AA5B5"
        {...rest}
        style={[s.campo, !!error && s.campoError, style]}
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
        style={({ pressed }) => [s.tarjeta, pressed && { opacity: 0.7 }, style]}>
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
    <View style={[s.chip, { backgroundColor: fondo ?? `${color}1A` }]}>
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
    exito: { bg: C.verdeClaro, bd: C.verde, tx: '#255C38' },
    alerta: { bg: C.ambarClaro, bd: C.ambar, tx: '#7A5310' },
    error: { bg: C.rojoClaro, bd: C.rojo, tx: '#8A0000' },
  }[tono];

  return (
    <View
      style={[
        s.aviso,
        { backgroundColor: estilos.bg, borderLeftColor: estilos.bd },
      ]}>
      {!!titulo && (
        <Text style={[s.avisoTitulo, { color: estilos.tx }]}>{titulo}</Text>
      )}
      <Text style={[s.avisoTexto, { color: estilos.tx }]}>{children}</Text>
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
      <Text style={[s.datoValor, fuerte && { fontSize: 16, color: C.azul }]}>
        {valor}
      </Text>
    </View>
  );
}

export function Separador() {
  return <View style={s.separador} />;
}

export function Cargando({ texto }: { texto?: string }) {
  return (
    <View style={s.centro}>
      <ActivityIndicator color={C.azulMedio} size="large" />
      {!!texto && <Text style={[s.parrafoSuave, { marginTop: E.md }]}>{texto}</Text>}
    </View>
  );
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <View style={s.centro}>
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
            style={[s.opcion, activa && s.opcionActiva]}>
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
  titulo: { fontSize: 26, fontWeight: '800', color: C.azul, letterSpacing: -0.5 },
  subtitulo: { fontSize: 17, fontWeight: '700', color: C.azul, marginBottom: E.xs },
  parrafo: { fontSize: 15, color: C.texto, lineHeight: 22 },
  parrafoSuave: { color: C.textoSuave, fontSize: 14 },
  micro: { fontSize: 12, color: C.textoSuave },

  boton: {
    height: 52,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: E.lg,
  },
  botonFantasma: { borderWidth: 1.5, borderColor: C.azulClaro, height: 46 },
  botonTexto: { fontSize: 16, fontWeight: '700' },

  campoBloque: { marginBottom: E.lg },
  campoEtiqueta: {
    fontSize: 13,
    fontWeight: '700',
    color: C.azul,
    marginBottom: E.xs + 2,
  },
  campo: {
    borderWidth: 1.5,
    borderColor: C.borde,
    backgroundColor: C.blanco,
    borderRadius: R.md,
    paddingHorizontal: E.md,
    paddingVertical: 13,
    fontSize: 15,
    color: C.texto,
  },
  campoError: { borderColor: C.rojo },
  campoAyuda: { fontSize: 12, color: C.textoSuave, marginTop: E.xs },
  campoMensajeError: { fontSize: 12, color: C.rojo, marginTop: E.xs },

  tarjeta: {
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    padding: E.lg,
    borderWidth: 1,
    borderColor: C.borde,
    marginBottom: E.md,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: E.sm + 2,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  chipPunto: { width: 7, height: 7, borderRadius: 4 },
  chipTexto: { fontSize: 12, fontWeight: '700' },

  aviso: {
    borderLeftWidth: 4,
    borderRadius: R.sm,
    padding: E.md,
    marginBottom: E.md,
  },
  avisoTitulo: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  avisoTexto: { fontSize: 13.5, lineHeight: 20 },

  dato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    gap: E.md,
  },
  datoEtiqueta: { fontSize: 14, color: C.textoSuave, flexShrink: 1 },
  datoValor: { fontSize: 14, fontWeight: '700', color: C.texto },

  separador: { height: 1, backgroundColor: C.borde, marginVertical: E.md },

  centro: { alignItems: 'center', justifyContent: 'center', padding: E.xxl },
  vacioTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: C.azul,
    textAlign: 'center',
  },
  vacioDetalle: {
    fontSize: 14,
    color: C.textoSuave,
    textAlign: 'center',
    marginTop: E.sm,
    lineHeight: 20,
  },

  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: E.sm },
  opcion: {
    paddingHorizontal: E.md,
    paddingVertical: E.sm + 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.borde,
    backgroundColor: C.blanco,
  },
  opcionActiva: { borderColor: C.azulMedio, backgroundColor: C.azulClaro },
  opcionTexto: { fontSize: 13.5, color: C.textoSuave, fontWeight: '600' },
  opcionTextoActivo: { color: C.azul, fontWeight: '700' },
});
