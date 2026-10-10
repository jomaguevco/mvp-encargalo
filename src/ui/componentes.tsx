import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from 'react-native';
import { Text, TextInput } from './Texto';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { iniciales } from '@/lib/negocio';
import { AVATARES, C, E, G, R, T, sombra } from './tema';
import { useEscritorio } from './escritorio';

/**
 * Piezas de interfaz de Encárgalo.
 *
 * Las de siempre (Titulo, Boton, Campo, Tarjeta, Chip, Aviso, Dato…) conservan
 * nombre y propiedades: todas las pantallas las usan. Lo nuevo de este
 * rediseño son las piezas que le dan carácter a la aplicación: la cabecera en
 * Monte, el avatar, las cifras, las estrellas, la barra de progreso del
 * pedido y los estados vacíos con icono.
 */

export type NombreIcono = keyof typeof Ionicons.glyphMap;

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

// ------------------------------------------------------------------ animación
/**
 * Entrada suave de abajo hacia arriba. Con `i` se escalonan los elementos de
 * una lista: cada tarjeta llega un instante después de la anterior, que es lo
 * que hace que una pantalla se sienta viva al abrirla.
 */
export function Entrada({
  children,
  i = 0,
  style,
}: {
  children: ReactNode;
  i?: number;
  style?: ViewStyle;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(i, 8) * 60).duration(380)}
      style={style}>
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------------ botón
type BotonProps = {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito' | 'suave';
  icono?: NombreIcono;
  cargando?: boolean;
  deshabilitado?: boolean;
  chico?: boolean;
  style?: ViewStyle;
};

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  icono,
  cargando,
  deshabilitado,
  chico,
  style,
}: BotonProps) {
  const inactivo = deshabilitado || cargando;
  const fondo = {
    primario: G.accion,
    secundario: G.marca,
    peligro: G.peligro,
    exito: G.exito,
    fantasma: null,
    suave: null,
  }[variante];
  const colorTexto =
    variante === 'fantasma' ? C.azul : variante === 'suave' ? C.azulMedio : C.blanco;

  const contenido = cargando ? (
    <ActivityIndicator color={colorTexto} />
  ) : (
    <View style={s.botonFila}>
      {!!icono && <Ionicons name={icono} size={chico ? 16 : 19} color={colorTexto} />}
      <Text
        style={[s.botonTexto, chico && { fontSize: 14.5 }, { color: colorTexto }]}
        numberOfLines={1}>
        {titulo}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
      style={({ pressed }) => [
        s.boton,
        chico && s.botonChico,
        variante === 'fantasma' && s.botonFantasma,
        variante === 'suave' && s.botonSuave,
        fondo && { backgroundColor: fondo },
        fondo && !inactivo && sombra(2),
        // Hundirse un punto al pulsar da la sensación de que el botón responde.
        pressed && !inactivo && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        inactivo && { opacity: 0.45 },
        style,
      ]}>
      {contenido}
    </Pressable>
  );
}

/** Botón redondo solo con icono, para cabeceras y barras de acción. */
export function BotonIcono({
  icono,
  onPress,
  claro,
  etiqueta,
}: {
  icono: NombreIcono;
  onPress: () => void;
  claro?: boolean;
  etiqueta: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={8}
      style={({ pressed }) => [
        s.botonIcono,
        claro ? s.botonIconoClaro : null,
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={icono} size={20} color={claro ? C.sobreOscuro : C.azul} />
    </Pressable>
  );
}

// ------------------------------------------------------------------ campo
type CampoProps = TextInputProps & {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  icono?: NombreIcono;
  /** Lo que va pegado a la derecha dentro del campo: un indicador, un botón. */
  derecha?: ReactNode;
};

export function Campo({
  etiqueta,
  ayuda,
  error,
  icono,
  derecha,
  style,
  onFocus,
  onBlur,
  ...rest
}: CampoProps) {
  // El borde se ilumina al escribir. Sin esto, en un formulario de seis campos
  // no hay forma de saber en cuál estás si el teclado tapa media pantalla.
  const [enfocado, setEnfocado] = useState(false);
  const multilinea = !!rest.multiline;

  return (
    <View style={s.campoBloque}>
      <Text style={s.campoEtiqueta}>{etiqueta}</Text>
      <View
        style={[
          s.campoCaja,
          enfocado && s.campoEnfocado,
          !!error && s.campoError,
          rest.editable === false && { backgroundColor: C.superficieSuave },
        ]}>
        {!!icono && (
          <Ionicons
            name={icono}
            size={18}
            color={enfocado ? C.azul : C.grisTexto}
            style={{ marginLeft: E.md, marginTop: multilinea ? 14 : 0 }}
          />
        )}
        <TextInput
          placeholderTextColor={C.grisTexto}
          {...rest}
          onFocus={(e) => {
            setEnfocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            onBlur?.(e);
          }}
          style={[s.campo, !!icono && { paddingLeft: E.sm + 2 }, style]}
        />
        {derecha ? <View style={s.campoDerecha}>{derecha}</View> : null}
      </View>
      {!!ayuda && !error && <Text style={s.campoAyuda}>{ayuda}</Text>}
      {!!error && (
        <View style={s.campoErrorFila}>
          <Ionicons name="alert-circle" size={14} color={C.rojo} />
          <Text style={s.campoMensajeError}>{error}</Text>
        </View>
      )}
    </View>
  );
}

/** Etiqueta de un grupo de opciones, con el mismo aspecto que la de un campo. */
export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={s.campoEtiqueta}>{children}</Text>;
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
          pressed && { transform: [{ scale: 0.985 }], borderColor: C.bordeFuerte },
          style,
        ]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

/**
 * Tarjeta de fondo oscuro y plano: para el dinero y los momentos clave. Se
 * llamaba así cuando llevaba degradado; el nombre se conserva porque diez
 * pantallas la usan.
 */
export function TarjetaDegradada({
  children,
  fondo = G.marca,
  style,
}: {
  children: ReactNode;
  fondo?: string;
  style?: ViewStyle;
}) {
  return <View style={[s.tarjetaDegradada, { backgroundColor: fondo }, style]}>{children}</View>;
}

// ------------------------------------------------------------------ cabecera
/**
 * Cabecera de las pestañas: Monte a todo ancho, saludo o título, y debajo lo
 * que la pantalla quiera mostrar (cifras, buscador).
 */
export function Cabecera({
  titulo,
  antetitulo,
  subtitulo,
  derecha,
  children,
  fondo = G.marca,
}: {
  titulo: string;
  antetitulo?: string;
  subtitulo?: string;
  derecha?: ReactNode;
  children?: ReactNode;
  fondo?: string;
}) {
  const insets = useSafeAreaInsets();
  const { es: escritorio } = useEscritorio();
  return (
    <View style={[s.cabecera, { backgroundColor: fondo }, escritorio && s.cabeceraEscritorio]}>
      <View style={{ paddingTop: insets.top + E.lg, paddingHorizontal: E.lg }}>
        <View style={s.cabeceraFila}>
          <View style={{ flex: 1 }}>
            {!!antetitulo && <Text style={s.cabeceraAnte}>{antetitulo}</Text>}
            <Text style={s.cabeceraTitulo} numberOfLines={2}>
              {titulo}
            </Text>
            {!!subtitulo && <Text style={s.cabeceraSub}>{subtitulo}</Text>}
          </View>
          {derecha}
        </View>
        {children ? <View style={{ marginTop: E.lg }}>{children}</View> : null}
      </View>
      <View style={{ height: E.xl }} />
    </View>
  );
}

// ------------------------------------------------------------------ avatar
function colorDe(texto: string) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return AVATARES[h % AVATARES.length];
}

export function Avatar({
  nombre,
  tamano = 44,
  verificado,
}: {
  nombre: string | null | undefined;
  tamano?: number;
  verificado?: boolean;
}) {
  const color = colorDe(nombre ?? '?');
  return (
    <View style={{ width: tamano, height: tamano }}>
      <View
        style={{
          width: tamano,
          height: tamano,
          borderRadius: tamano / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text
          style={{
            color: C.sobreOscuro,
            fontWeight: '700',
            fontSize: tamano * 0.38,
            letterSpacing: -0.5,
          }}>
          {iniciales(nombre)}
        </Text>
      </View>
      {verificado && (
        <View
          style={[
            s.avatarSello,
            { width: tamano * 0.36, height: tamano * 0.36, borderRadius: tamano * 0.18 },
          ]}>
          <Ionicons name="checkmark" size={tamano * 0.22} color={C.blanco} />
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ cifras
/** Una cifra con su icono y etiqueta. Se ponen de a dos o tres en fila. */
export function Cifra({
  icono,
  valor,
  etiqueta,
  color = C.azulMedio,
  claro,
  onPress,
}: {
  icono: NombreIcono;
  valor: string;
  etiqueta: string;
  color?: string;
  /** Sobre la cabecera oscura */
  claro?: boolean;
  onPress?: () => void;
}) {
  const cuerpo = (
    <>
      <View
        style={[
          s.cifraIcono,
          { backgroundColor: claro ? 'rgba(242,235,225,0.12)' : `${color}18` },
        ]}>
        <Ionicons name={icono} size={17} color={claro ? C.trigo : color} />
      </View>
      <Text style={[s.cifraValor, claro && { color: C.sobreOscuro }]} numberOfLines={1}>
        {valor}
      </Text>
      <Text style={[s.cifraEtiqueta, claro && { color: C.sobreOscuroSuave }]}>
        {etiqueta}
      </Text>
    </>
  );
  const estilo = [s.cifra, claro ? s.cifraClara : sombra(1)];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...estilo, pressed && { opacity: 0.8 }]}>
        {cuerpo}
      </Pressable>
    );
  }
  return <View style={estilo}>{cuerpo}</View>;
}

export function FilaCifras({ children }: { children: ReactNode }) {
  return <View style={s.filaCifras}>{children}</View>;
}

// ------------------------------------------------------------------ estrellas
export function Estrellas({
  valor,
  tamano = 15,
  onCambiar,
}: {
  valor: number;
  tamano?: number;
  onCambiar?: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: onCambiar ? E.sm : 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const nombre: NombreIcono =
          valor >= i ? 'star' : valor >= i - 0.5 ? 'star-half' : 'star-outline';
        const icono = (
          <Ionicons name={nombre} size={tamano} color={valor >= i - 0.5 ? C.estrella : C.borde} />
        );
        return onCambiar ? (
          <Pressable
            key={i}
            onPress={() => onCambiar(i)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${i} estrella${i === 1 ? '' : 's'}`}
            style={({ pressed }) => pressed && { transform: [{ scale: 1.15 }] }}>
            {icono}
          </Pressable>
        ) : (
          <View key={i}>{icono}</View>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ progreso
/** Barra de pasos compacta: cuántos de los siete pasos del pedido van. */
export function Progreso({
  hechos,
  total,
  color = C.verde,
}: {
  hechos: number;
  total: number;
  color?: string;
}) {
  return (
    <View style={s.progreso}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            s.progresoTramo,
            { backgroundColor: i < hechos ? color : C.borde },
          ]}
        />
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ etiqueta de estado
export function Chip({
  texto,
  color,
  fondo,
  icono,
}: {
  texto: string;
  color: string;
  fondo?: string;
  icono?: NombreIcono;
}) {
  return (
    <View style={[s.chip, { backgroundColor: fondo ?? `${color}16` }]}>
      {icono ? (
        <Ionicons name={icono} size={12} color={color} />
      ) : (
        <View style={[s.chipPunto, { backgroundColor: color }]} />
      )}
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
    info: { bg: C.azulClaro, bd: C.azulMedio, tx: C.azul, ic: 'information-circle' },
    exito: { bg: C.verdeClaro, bd: C.verde, tx: C.verdeOscuro, ic: 'checkmark-circle' },
    alerta: { bg: C.ambarClaro, bd: C.ambar, tx: C.ambarOscuro, ic: 'warning' },
    error: { bg: C.rojoClaro, bd: C.rojo, tx: C.rojoOscuro, ic: 'close-circle' },
  }[tono] as { bg: string; bd: string; tx: string; ic: NombreIcono };

  return (
    <View
      accessibilityLiveRegion={tono === 'error' ? 'assertive' : 'polite'}
      style={[s.aviso, { backgroundColor: estilos.bg, borderColor: `${estilos.bd}33` }]}>
      <Ionicons name={estilos.ic} size={20} color={estilos.bd} style={{ marginTop: 1 }} />
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
  icono,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
  icono?: NombreIcono;
}) {
  return (
    <View style={s.dato}>
      <View style={s.datoIzq}>
        {!!icono && <Ionicons name={icono} size={16} color={C.textoSuave} />}
        <Text style={[s.datoEtiqueta, fuerte && { color: C.texto, fontWeight: '700' }]}>
          {etiqueta}
        </Text>
      </View>
      <Text style={[s.datoValor, fuerte && s.datoValorFuerte]}>{valor}</Text>
    </View>
  );
}

export function Separador() {
  return <View style={s.separador} />;
}

/** Título de sección con icono y, opcionalmente, una acción a la derecha. */
export function Seccion({
  titulo,
  icono,
  conteo,
  accion,
  onAccion,
  style,
}: {
  titulo: string;
  icono?: NombreIcono;
  conteo?: number;
  accion?: string;
  onAccion?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.seccion, style]}>
      {!!icono && (
        <View style={s.seccionIcono}>
          <Ionicons name={icono} size={15} color={C.azulMedio} />
        </View>
      )}
      <Text style={s.seccionTitulo}>{titulo}</Text>
      {conteo != null && (
        <View style={s.seccionConteo}>
          <Text style={s.seccionConteoTexto}>{conteo}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {!!accion && onAccion && (
        <Pressable onPress={onAccion} hitSlop={8}>
          <Text style={s.seccionAccion}>{accion}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Cargando({ texto }: { texto?: string }) {
  return (
    <View style={[s.centro, { flex: 1 }]}>
      <ActivityIndicator color={C.azul} size="large" />
      {!!texto && <Text style={[s.parrafoSuave, { marginTop: E.md }]}>{texto}</Text>}
    </View>
  );
}

export function Vacio({
  titulo,
  detalle,
  icono = 'file-tray-outline',
  accion,
  onAccion,
}: {
  titulo: string;
  detalle?: string;
  icono?: NombreIcono;
  accion?: string;
  onAccion?: () => void;
}) {
  return (
    <Entrada>
      <View style={s.centro}>
        <View style={s.vacioAro}>
          <View style={s.vacioMarca}>
            <Ionicons name={icono} size={30} color={C.azulMedio} />
          </View>
        </View>
        <Text style={s.vacioTitulo}>{titulo}</Text>
        {!!detalle && <Text style={s.vacioDetalle}>{detalle}</Text>}
        {!!accion && onAccion && (
          <Boton
            titulo={accion}
            onPress={onAccion}
            variante="suave"
            chico
            style={{ marginTop: E.lg, paddingHorizontal: E.xl }}
          />
        )}
      </View>
    </Entrada>
  );
}

// ------------------------------------------------------------------ selector
export function Opciones<T extends string>({
  valor,
  opciones,
  onChange,
  desplazable,
}: {
  valor: T | null;
  opciones: { valor: T; etiqueta: string; icono?: NombreIcono }[];
  onChange: (v: T) => void;
  /** En una sola fila con desplazamiento horizontal (filtros) */
  desplazable?: boolean;
}) {
  const fichas = opciones.map((o) => {
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
        {!!o.icono && (
          <Ionicons name={o.icono} size={14} color={activa ? C.sobreOscuro : C.textoSuave} />
        )}
        <Text style={[s.opcionTexto, activa && s.opcionTextoActivo]}>{o.etiqueta}</Text>
      </Pressable>
    );
  });

  if (desplazable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: E.sm, paddingRight: E.lg }}>
        {fichas}
      </ScrollView>
    );
  }
  return <View style={s.opciones}>{fichas}</View>;
}

// ------------------------------------------------------------------ casilla
export function Casilla({
  marcada,
  onCambiar,
  children,
}: {
  marcada: boolean;
  onCambiar: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onCambiar(!marcada)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      style={s.casillaFila}>
      <View style={[s.casilla, marcada && s.casillaMarcada]}>
        {marcada && <Ionicons name="checkmark" size={15} color={C.blanco} />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
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
    overflow: 'hidden',
  },
  botonChico: { height: 44, borderRadius: R.md },
  botonFila: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  botonFantasma: {
    borderWidth: 1,
    borderColor: C.bordeFuerte,
    height: 50,
    backgroundColor: C.blanco,
  },
  botonSuave: { backgroundColor: C.azulClaro },
  botonTexto: { fontSize: 16, fontWeight: '600' },

  botonIcono: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.azulClaro,
  },
  botonIconoClaro: {
    backgroundColor: 'rgba(242,235,225,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,235,225,0.18)',
  },

  campoBloque: { marginBottom: E.lg },
  campoEtiqueta: {
    fontSize: 13.5,
    fontWeight: '600',
    color: C.azul,
    marginBottom: E.xs + 3,
  },
  campoCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.blanco,
    borderRadius: R.md,
  },
  campo: {
    flex: 1,
    paddingHorizontal: E.md + 2,
    paddingVertical: 14,
    fontSize: 15.5,
    color: C.texto,
    // En el navegador el campo trae su propio contorno de foco, que choca con
    // el borde iluminado de la caja. En el teléfono no existe.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  campoDerecha: { paddingRight: E.md },
  campoEnfocado: {
    borderColor: C.azul,
    shadowColor: C.azul,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  campoError: { borderColor: C.rojo, backgroundColor: '#FFFAF8' },
  campoAyuda: { fontSize: 12.5, color: C.textoSuave, marginTop: E.xs + 2, lineHeight: 18 },
  campoErrorFila: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: E.xs + 2 },
  campoMensajeError: { fontSize: 12.5, color: C.rojo, fontWeight: '600', flex: 1 },

  tarjeta: {
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    padding: E.lg + 2,
    borderWidth: 1,
    borderColor: C.borde,
    marginBottom: E.md,
  },
  tarjetaDegradada: {
    borderRadius: R.lg,
    padding: E.xl,
    marginBottom: E.md,
    overflow: 'hidden',
  },
  cabecera: {
    overflow: 'hidden',
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
  },
  // En escritorio la cabecera es una tarjeta: el contenido ya está centrado.
  cabeceraEscritorio: { borderRadius: R.lg, marginBottom: E.lg, marginHorizontal: E.sm },
  cabeceraFila: { flexDirection: 'row', alignItems: 'center', gap: E.md },
  cabeceraAnte: {
    color: C.trigo,
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  cabeceraTitulo: { ...T.titulo, color: C.sobreOscuro, fontSize: 27 },
  cabeceraSub: {
    color: C.sobreOscuroSuave,
    fontSize: 14.5,
    marginTop: E.xs,
    lineHeight: 21,
  },

  avatarSello: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: C.verde,
    borderWidth: 2,
    borderColor: C.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filaCifras: { flexDirection: 'row', gap: E.sm + 2 },
  cifra: {
    flex: 1,
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    padding: E.md,
    borderWidth: 1,
    borderColor: C.borde,
  },
  cifraClara: {
    backgroundColor: 'rgba(242,235,225,0.07)',
    borderColor: 'rgba(242,235,225,0.14)',
  },
  cifraIcono: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.sm,
  },
  cifraValor: { fontSize: 21, fontWeight: '800', color: C.azul, letterSpacing: -0.5 },
  cifraEtiqueta: { fontSize: 12, color: C.textoSuave, fontWeight: '600', marginTop: 1 },

  progreso: { flexDirection: 'row', gap: 4 },
  progresoTramo: { flex: 1, height: 5, borderRadius: 3 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: E.sm + 3,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
  },
  chipPunto: { width: 7, height: 7, borderRadius: 4 },
  chipTexto: { fontSize: 12.5, fontWeight: '600' },

  aviso: {
    flexDirection: 'row',
    gap: E.sm + 2,
    borderRadius: R.md,
    marginBottom: E.md,
    padding: E.md + 2,
    borderWidth: 1,
  },
  avisoCuerpo: { flex: 1 },
  avisoTitulo: { fontSize: 14.5, fontWeight: '800', marginBottom: 3 },
  avisoTexto: { fontSize: 14, lineHeight: 21 },

  dato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: E.md,
  },
  datoIzq: { flexDirection: 'row', alignItems: 'center', gap: E.sm, flexShrink: 1 },
  datoEtiqueta: { fontSize: 14.5, color: C.textoSuave, flexShrink: 1 },
  datoValor: { fontSize: 14.5, fontWeight: '700', color: C.texto, textAlign: 'right' },
  datoValorFuerte: { fontSize: 17, color: C.azul, fontWeight: '800' },

  separador: { height: 1, backgroundColor: C.borde, marginVertical: E.md },

  seccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm,
    marginBottom: E.md,
    marginTop: E.sm,
  },
  seccionIcono: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seccionTitulo: { ...T.subtitulo, fontSize: 17, color: C.azul },
  seccionConteo: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: C.naranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seccionConteoTexto: { color: C.blanco, fontWeight: '800', fontSize: 12 },
  seccionAccion: { color: C.naranjaOscuro, fontWeight: '600', fontSize: 14 },

  centro: { alignItems: 'center', justifyContent: 'center', padding: E.xxl },
  vacioAro: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: `${C.azulMedio}0D`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.lg,
  },
  vacioMarca: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacioTitulo: {
    fontSize: 18,
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
    maxWidth: 320,
  },

  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: E.sm },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: E.md + 2,
    paddingVertical: E.sm + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.blanco,
  },
  opcionActiva: { borderColor: C.azul, backgroundColor: C.azul },
  opcionTexto: { fontSize: 14, color: C.textoSuave, fontWeight: '500' },
  opcionTextoActivo: { color: C.sobreOscuro, fontWeight: '600' },

  casillaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: E.sm + 2 },
  casilla: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: C.bordeFuerte,
    backgroundColor: C.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  casillaMarcada: { borderColor: C.azul, backgroundColor: C.azul },
});

// ------------------------------------------------------------------ cuadrícula
/** Separación entre tarjetas de una cuadrícula de productos. */
export const HUECO = E.md;

/**
 * Cuadrícula de productos para pantallas con ScrollView (las que usan
 * FlatList pasan `numColumns`). Las tarjetas de una misma fila quedan de la
 * misma altura, como en una tienda.
 */
export function Cuadricula<T>({
  datos,
  columnas,
  clave,
  render,
}: {
  datos: T[];
  columnas: number;
  clave: (d: T) => string;
  render: (d: T, i: number) => ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -HUECO / 2 }}>
      {datos.map((d, i) => (
        <Entrada key={clave(d)} i={i} style={celda(columnas)}>
          {render(d, i)}
        </Entrada>
      ))}
    </View>
  );
}

/** Estilo de cada celda de la cuadrícula; también lo usan las FlatList. */
export const celda = (columnas: number): ViewStyle => ({
  width: `${100 / columnas}%`,
  paddingHorizontal: HUECO / 2,
  marginBottom: HUECO,
});
