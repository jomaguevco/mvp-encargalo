import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from './Texto';
import { C } from './tema';

/** Rectángulo en fracciones de la imagen (0 a 1), independiente de su tamaño. */
export type Rect = { x: number; y: number; w: number; h: number };

export type Recuadros = { numero: Rect; nombres: Rect };

const MIN_W = 0.08;
const MIN_H = 0.05;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Foto del DNI con los recuadros del número y de los nombres encima, que la
 * persona puede arrastrar (desde el centro) y agrandar o achicar (desde la
 * esquina). Si la lectura automática de la foto completa no encuentra el
 * número o el nombre, la verificación lee estos recortes: así un DNI torcido o
 * fotografiado de lejos no termina siempre en revisión manual.
 */
export function AjusteRecuadros({
  uri,
  ancho,
  alto,
  valor,
  onCambio,
}: {
  uri: string;
  /** Tamaño real de la imagen, en píxeles. */
  ancho: number;
  alto: number;
  valor: Recuadros;
  onCambio: (r: Recuadros) => void;
}) {
  // Espacio disponible: la imagen se dibuja entera, con su proporción.
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const proporcion = ancho / alto;
  const dispW = caja.w && caja.h ? Math.min(caja.w, caja.h * proporcion) : 0;
  const dispH = dispW / proporcion;

  return (
    <View
      style={s.area}
      onLayout={(e: LayoutChangeEvent) =>
        setCaja({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      {dispW > 0 && (
        <View style={{ width: dispW, height: dispH }}>
          <Image source={{ uri }} style={{ width: dispW, height: dispH }} resizeMode="stretch" />
          <Recuadro
            etiqueta="N° de DNI"
            rect={valor.numero}
            dispW={dispW}
            dispH={dispH}
            onCambio={(numero) => onCambio({ ...valor, numero })}
          />
          <Recuadro
            etiqueta="Apellidos y nombres"
            rect={valor.nombres}
            dispW={dispW}
            dispH={dispH}
            onCambio={(nombres) => onCambio({ ...valor, nombres })}
          />
        </View>
      )}
    </View>
  );
}

function Recuadro({
  etiqueta,
  rect,
  dispW,
  dispH,
  onCambio,
}: {
  etiqueta: string;
  rect: Rect;
  dispW: number;
  dispH: number;
  onCambio: (r: Rect) => void;
}) {
  // Los gestos se crean una sola vez: si se rehicieran en cada movimiento, el
  // sistema soltaría el gesto a mitad del arrastre. Leen los valores del
  // momento desde `actual` y aplican solo lo que se movió desde el evento
  // anterior (`previo`): al agrandar, la esquina se corre bajo el dedo y el
  // gesto puede reiniciarse, y sumar desde el inicio lo haría crecer de más.
  const actual = useRef({ rect, dispW, dispH, onCambio });
  // Durante el gesto manda la posición que lleva el propio gesto: la que llega
  // por props va un render atrás y pisaría los últimos movimientos.
  const arrastrando = useRef(false);
  useEffect(() => {
    actual.current = { ...actual.current, dispW, dispH, onCambio };
    if (!arrastrando.current) actual.current.rect = rect;
  });
  const previo = useRef({ dx: 0, dy: 0 });
  const paso = (g: { dx: number; dy: number }) => {
    const d = { x: g.dx - previo.current.dx, y: g.dy - previo.current.dy };
    previo.current = { dx: g.dx, dy: g.dy };
    return d;
  };

  const [mover] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Solo el toque inicial decide quién atiende: la esquina, por estar
      // más adentro, gana; si el recuadro también lo pidiera al mover, se
      // lo quitarían uno al otro en cada evento.
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        previo.current = { dx: 0, dy: 0 };
        arrastrando.current = true;
      },
      onPanResponderRelease: () => {
        arrastrando.current = false;
      },
      onPanResponderTerminate: () => {
        arrastrando.current = false;
      },
      onPanResponderMove: (_, g) => {
        const { rect: r, dispW: w, dispH: h, onCambio: cambiar } = actual.current;
        const d = paso(g);
        const nuevo = {
          ...r,
          x: limitar(r.x + d.x / w, 0, 1 - r.w),
          y: limitar(r.y + d.y / h, 0, 1 - r.h),
        };
        actual.current.rect = nuevo;
        cambiar(nuevo);
      },
    }),
  );

  const [estirar] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        previo.current = { dx: 0, dy: 0 };
        arrastrando.current = true;
      },
      onPanResponderRelease: () => {
        arrastrando.current = false;
      },
      onPanResponderTerminate: () => {
        arrastrando.current = false;
      },
      onPanResponderMove: (_, g) => {
        const { rect: r, dispW: w, dispH: h, onCambio: cambiar } = actual.current;
        const d = paso(g);
        const nuevo = {
          ...r,
          w: limitar(r.w + d.x / w, MIN_W, 1 - r.x),
          h: limitar(r.h + d.y / h, MIN_H, 1 - r.y),
        };
        actual.current.rect = nuevo;
        cambiar(nuevo);
      },
    }),
  );

  return (
    <View
      {...mover.panHandlers}
      accessibilityLabel={`Recuadro ${etiqueta}: arrástralo sobre el dato`}
      style={[
        s.recuadro,
        { left: rect.x * dispW, top: rect.y * dispH, width: rect.w * dispW, height: rect.h * dispH },
      ]}>
      <Text style={s.etiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
      <View {...estirar.panHandlers} style={s.esquina} accessibilityLabel={`Cambiar tamaño de ${etiqueta}`}>
        <Ionicons name="resize" size={14} color={C.azul} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  area: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  recuadro: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: C.trigo,
    backgroundColor: 'rgba(217,180,90,0.12)',
    borderRadius: 4,
  },
  etiqueta: {
    position: 'absolute',
    top: -22,
    left: -2,
    fontSize: 11,
    fontWeight: '700',
    color: C.azul,
    backgroundColor: C.trigo,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  esquina: {
    position: 'absolute',
    right: -14,
    bottom: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.trigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
