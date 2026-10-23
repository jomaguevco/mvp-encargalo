import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Text } from './Texto';
import { C, E, R } from './tema';

export type ImagenVisor = { uri: string; etiqueta: string };

const ZOOMS = [1, 1.5, 2, 3, 4];

/**
 * Visor de documentos a pantalla completa.
 *
 * Existe para la verificación de identidad: en la tarjeta las fotos son
 * miniaturas, y con una miniatura no se puede comparar un rostro ni leer el
 * número impreso del DNI. Aquí se ven lado a lado (documento y selfie), con
 * zoom para leer el documento y rotación para las fotos tomadas de costado.
 * También sirve para comprobantes de pago y evidencias de disputas.
 */
export function VisorImagenes({
  imagenes,
  inicial = 0,
  onCerrar,
}: {
  imagenes: ImagenVisor[] | null;
  inicial?: number;
  onCerrar: () => void;
}) {
  const visible = !!imagenes && imagenes.length > 0;
  const varias = (imagenes?.length ?? 0) > 1;
  const [indice, setIndice] = useState(inicial);
  const [ladoALado, setLadoALado] = useState(varias);
  const [zoom, setZoom] = useState(1);
  const [giro, setGiro] = useState<Record<number, number>>({});
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });

  // Cada vez que se abre, empieza limpio.
  useEffect(() => {
    if (!visible) return;
    setIndice(inicial);
    setLadoALado(varias);
    setZoom(1);
    setGiro({});
  }, [visible, inicial, varias]);

  // En la web: Esc cierra, flechas cambian de foto, + y − hacen zoom.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'ArrowRight' && varias) setIndice((i) => (i + 1) % imagenes!.length);
      else if (e.key === 'ArrowLeft' && varias) setIndice((i) => (i - 1 + imagenes!.length) % imagenes!.length);
      else if (e.key === '+' || e.key === '=') setZoom((z) => ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)]);
      else if (e.key === '-') setZoom((z) => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)]);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [visible, varias, imagenes, onCerrar]);

  if (!visible) return null;

  const mostradas = ladoALado ? imagenes!.map((im, i) => ({ im, i })) : [{ im: imagenes![indice], i: indice }];
  const anchoCelda = ladoALado ? (caja.ancho - E.md * (mostradas.length - 1)) / mostradas.length : caja.ancho;

  function abrirOriginal(uri: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(uri, '_blank', 'noopener');
  }

  const accion = (icono: keyof typeof Ionicons.glyphMap, texto: string, onPress: () => void, activo = false, deshabilitado = false) => (
    <Pressable
      key={texto}
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ hovered }: { hovered?: boolean }) => [
        s.accion,
        activo && s.accionActiva,
        hovered && !deshabilitado && { backgroundColor: 'rgba(242,235,225,0.18)' },
        deshabilitado && { opacity: 0.35 },
      ]}>
      <Ionicons name={icono} size={18} color={C.sobreOscuro} />
      <Text style={s.accionTexto}>{texto}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={s.fondo}>
        <View style={s.barra}>
          <Text style={s.titulo} numberOfLines={1}>
            {ladoALado ? imagenes!.map((x) => x.etiqueta).join(' · ') : imagenes![indice].etiqueta}
          </Text>
          <View style={s.acciones}>
            {varias && accion('git-compare-outline', 'Lado a lado', () => setLadoALado((v) => !v), ladoALado)}
            {accion('remove', 'Alejar', () => setZoom((z) => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)]), false, zoom === 1)}
            <Text style={s.zoom}>{Math.round(zoom * 100)} %</Text>
            {accion('add', 'Acercar', () => setZoom((z) => ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)]), false, zoom === ZOOMS[ZOOMS.length - 1])}
            {accion('refresh', 'Rotar', () =>
              setGiro((g) => {
                const n = { ...g };
                for (const { i } of mostradas) n[i] = ((n[i] ?? 0) + 90) % 360;
                return n;
              }),
            )}
            {Platform.OS === 'web' &&
              accion('open-outline', 'Abrir original', () => mostradas.forEach(({ im }) => abrirOriginal(im.uri)))}
            <Pressable onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" style={s.cerrar} hitSlop={8}>
              <Ionicons name="close" size={24} color={C.sobreOscuro} />
            </Pressable>
          </View>
        </View>

        <View
          style={s.cuerpo}
          onLayout={(e: LayoutChangeEvent) =>
            setCaja({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })
          }>
          {caja.ancho > 0 && (
            <View style={{ flex: 1, flexDirection: 'row', gap: E.md }}>
              {mostradas.map(({ im, i }) => {
                const ancho = anchoCelda * zoom;
                const alto = (caja.alto - 28) * zoom;
                return (
                  <View key={im.uri} style={{ width: anchoCelda, height: caja.alto }}>
                    {/* Con zoom la imagen crece y se recorre desplazando en las dos direcciones. */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={zoom === 1 && s.centrado}>
                      <ScrollView horizontal contentContainerStyle={zoom === 1 && s.centrado}>
                        <Image
                          source={{ uri: im.uri }}
                          resizeMode="contain"
                          accessibilityLabel={im.etiqueta}
                          style={{
                            width: ancho,
                            height: alto,
                            transform: [{ rotate: `${giro[i] ?? 0}deg` }],
                          }}
                        />
                      </ScrollView>
                    </ScrollView>
                    {ladoALado && <Text style={s.etiqueta}>{im.etiqueta}</Text>}
                  </View>
                );
              })}
            </View>
          )}

          {!ladoALado && varias && (
            <>
              <Pressable
                style={[s.flecha, { left: E.sm }]}
                onPress={() => setIndice((x) => (x - 1 + imagenes!.length) % imagenes!.length)}
                accessibilityLabel="Anterior">
                <Ionicons name="chevron-back" size={28} color={C.sobreOscuro} />
              </Pressable>
              <Pressable
                style={[s.flecha, { right: E.sm }]}
                onPress={() => setIndice((x) => (x + 1) % imagenes!.length)}
                accessibilityLabel="Siguiente">
                <Ionicons name="chevron-forward" size={28} color={C.sobreOscuro} />
              </Pressable>
            </>
          )}
        </View>

        <Text style={s.ayuda}>
          {Platform.OS === 'web'
            ? 'Esc para cerrar · + y − para zoom · flechas para cambiar de foto'
            : 'Desplázate para recorrer la imagen ampliada'}
        </Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(8,20,16,0.96)', padding: E.lg, gap: E.md },
  barra: { flexDirection: 'row', alignItems: 'center', gap: E.md, flexWrap: 'wrap' },
  titulo: { flex: 1, minWidth: 160, fontSize: 17, fontWeight: '700', color: C.sobreOscuro },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: E.xs, flexWrap: 'wrap' },
  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: R.sm,
    backgroundColor: 'rgba(242,235,225,0.08)',
  },
  accionActiva: { backgroundColor: 'rgba(217,180,90,0.35)' },
  accionTexto: { fontSize: 13.5, fontWeight: '600', color: C.sobreOscuro },
  zoom: { fontSize: 13.5, fontWeight: '700', color: C.trigo, minWidth: 48, textAlign: 'center' },
  cerrar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,235,225,0.12)',
    marginLeft: E.sm,
  },
  cuerpo: { flex: 1 },
  centrado: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  etiqueta: { fontSize: 13, fontWeight: '700', color: C.trigo, textAlign: 'center', height: 28, paddingTop: 6 },
  flecha: {
    position: 'absolute',
    top: '45%',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,235,225,0.15)',
  },
  ayuda: { fontSize: 12, color: C.sobreOscuroSuave, textAlign: 'center' },
});
