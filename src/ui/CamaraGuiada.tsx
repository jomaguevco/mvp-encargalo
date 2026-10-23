import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from './Texto';
import { C, E, R } from './tema';

export type ModoCamara = 'dni' | 'selfie';

/** Proporción de una tarjeta ID-1 (85.6 × 54 mm), la del DNI peruano. */
const PROPORCION_DNI = 85.6 / 54;

/**
 * Recuadros de la guía, en fracciones del marco del DNI. Corresponden a la
 * cara frontal del DNI azul y del electrónico: el número arriba a la derecha y
 * los apellidos y nombres al lado derecho de la foto. Encajarlos ahí es lo que
 * deja leer el número y el nombre a la verificación automática.
 */
const RECUADROS = [
  { etiqueta: 'N° de DNI', x: 0.6, y: 0.04, w: 0.37, h: 0.16 },
  { etiqueta: 'Apellidos y nombres', x: 0.32, y: 0.2, w: 0.4, h: 0.44 },
  { etiqueta: 'Foto', x: 0.03, y: 0.18, w: 0.27, h: 0.58 },
];

/**
 * Cámara con guía para la verificación de identidad.
 *
 * En modo DNI dibuja el contorno del documento con los recuadros donde deben
 * caer el número y los nombres; en modo selfie, un óvalo para el rostro. Si no
 * hay permiso de cámara o la persona prefiere, puede elegir de la galería
 * recortando a la forma del DNI.
 */
export function CamaraGuiada({
  modo,
  visible,
  onCancelar,
  onFoto,
}: {
  modo: ModoCamara;
  visible: boolean;
  onCancelar: () => void;
  onFoto: (uri: string) => void;
}) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [lado, setLado] = useState<CameraType>(modo === 'selfie' ? 'front' : 'back');
  const [lista, setLista] = useState(false);
  const [tomando, setTomando] = useState(false);
  const [vista, setVista] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();

  // Marco del DNI: lo más ancho posible dejando margen.
  const anchoMarco = Math.min(width - 48, 640);
  const altoMarco = anchoMarco / PROPORCION_DNI;
  const anchoOvalo = Math.min(width * 0.62, 320);

  async function disparar() {
    if (!camara.current || tomando) return;
    setTomando(true);
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      if (foto?.uri) setVista(foto.uri);
    } finally {
      setTomando(false);
    }
  }

  async function galeria() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: modo === 'dni' ? [86, 54] : [1, 1],
    });
    if (!res.canceled && res.assets?.[0]) setVista(res.assets[0].uri);
  }

  function cerrar() {
    setVista(null);
    setLista(false);
    onCancelar();
  }

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={cerrar}>
      <View style={s.fondo}>
        {/* ----------------------------------------- vista previa */}
        {vista ? (
          <View style={s.previa}>
            <Text style={s.titulo}>{modo === 'dni' ? '¿Se leen el número y tu nombre?' : '¿Se ve bien tu rostro?'}</Text>
            <Image source={{ uri: vista }} style={s.previaImagen} resizeMode="contain" />
            <View style={s.botonesFila}>
              <Pressable style={[s.boton, s.botonSecundario]} onPress={() => setVista(null)}>
                <Ionicons name="refresh" size={18} color={C.sobreOscuro} />
                <Text style={s.botonTexto}>Repetir</Text>
              </Pressable>
              <Pressable
                style={[s.boton, s.botonPrimario]}
                onPress={() => {
                  const uri = vista;
                  setVista(null);
                  setLista(false);
                  onFoto(uri);
                }}>
                <Ionicons name="checkmark" size={18} color={C.blanco} />
                <Text style={s.botonTexto}>Usar esta foto</Text>
              </Pressable>
            </View>
          </View>
        ) : !permiso ? (
          <ActivityIndicator color={C.sobreOscuro} style={{ flex: 1 }} />
        ) : !permiso.granted ? (
          /* ----------------------------------------- sin permiso */
          <View style={s.previa}>
            <Ionicons name="camera-outline" size={48} color={C.trigo} />
            <Text style={s.titulo}>Necesitamos tu cámara</Text>
            <Text style={s.ayuda}>
              Para tomar {modo === 'dni' ? 'la foto de tu DNI' : 'tu selfie'} con la guía. También puedes
              elegir una foto de tu galería.
            </Text>
            <View style={s.botonesFila}>
              {/* Si el permiso se negó para siempre, el sistema ya no vuelve a
                  preguntar: solo queda activarlo desde los ajustes del teléfono. */}
              <Pressable
                style={[s.boton, s.botonPrimario]}
                onPress={() => (permiso.canAskAgain ? pedirPermiso() : Linking.openSettings())}>
                <Ionicons name="camera" size={18} color={C.blanco} />
                <Text style={s.botonTexto}>{permiso.canAskAgain ? 'Permitir cámara' : 'Abrir ajustes'}</Text>
              </Pressable>
              <Pressable style={[s.boton, s.botonSecundario]} onPress={galeria}>
                <Ionicons name="images-outline" size={18} color={C.sobreOscuro} />
                <Text style={s.botonTexto}>Elegir de la galería</Text>
              </Pressable>
            </View>
            <Pressable onPress={cerrar} style={{ marginTop: E.lg }}>
              <Text style={s.cancelar}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          /* ----------------------------------------- cámara con guía */
          <View style={{ flex: 1 }}>
            <CameraView
              ref={camara}
              style={StyleSheet.absoluteFill}
              facing={lado}
              onCameraReady={() => setLista(true)}
            />

            <View style={[StyleSheet.absoluteFill, s.capa]} pointerEvents="none">
              {modo === 'dni' ? (
                <View style={{ width: anchoMarco, height: altoMarco }}>
                  <View style={[s.marco, { width: anchoMarco, height: altoMarco }]} />
                  {RECUADROS.map((r) => (
                    <View
                      key={r.etiqueta}
                      style={[
                        s.recuadro,
                        {
                          left: r.x * anchoMarco,
                          top: r.y * altoMarco,
                          width: r.w * anchoMarco,
                          height: r.h * altoMarco,
                        },
                        r.etiqueta === 'Foto' && s.recuadroFoto,
                      ]}>
                      <Text style={s.recuadroTexto}>{r.etiqueta}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[s.ovalo, { width: anchoOvalo, height: anchoOvalo * 1.3, borderRadius: anchoOvalo }]} />
              )}
            </View>

            <View style={s.arriba}>
              <Pressable onPress={cerrar} style={s.redondo} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={24} color={C.sobreOscuro} />
              </Pressable>
              <Text style={s.instruccion}>
                {modo === 'dni'
                  ? 'Encaja tu DNI en el marco: el número y tu nombre dentro de sus recuadros, sin reflejos.'
                  : 'Pon tu rostro dentro del óvalo, con buena luz y sin lentes oscuros.'}
              </Text>
            </View>

            <View style={[s.abajo, { paddingBottom: Math.max(E.xl, height * 0.03) }]}>
              <Pressable onPress={galeria} style={s.redondo} accessibilityLabel="Elegir de la galería">
                <Ionicons name="images-outline" size={24} color={C.sobreOscuro} />
              </Pressable>
              <Pressable
                onPress={disparar}
                disabled={!lista || tomando}
                accessibilityLabel="Tomar foto"
                style={[s.disparador, (!lista || tomando) && { opacity: 0.5 }]}>
                {tomando ? <ActivityIndicator color={C.azul} /> : <View style={s.disparadorCentro} />}
              </Pressable>
              <Pressable
                onPress={() => setLado((l) => (l === 'back' ? 'front' : 'back'))}
                style={s.redondo}
                accessibilityLabel="Cambiar de cámara">
                <Ionicons name="camera-reverse-outline" size={24} color={C.sobreOscuro} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#0B1C16' },
  capa: { alignItems: 'center', justifyContent: 'center' },
  marco: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: C.trigo,
    borderRadius: 14,
  },
  recuadro: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(242,235,225,0.9)',
    borderRadius: 6,
    padding: 3,
  },
  recuadroFoto: { borderColor: 'rgba(217,180,90,0.7)' },
  recuadroTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sobreOscuro,
    backgroundColor: 'rgba(11,28,22,0.6)',
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  ovalo: { borderWidth: 3, borderColor: C.trigo },
  arriba: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: E.xl,
    paddingHorizontal: E.lg,
    gap: E.md,
    backgroundColor: 'rgba(11,28,22,0.55)',
    paddingBottom: E.md,
  },
  instruccion: { fontSize: 15, fontWeight: '600', color: C.sobreOscuro, textAlign: 'center' },
  abajo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: E.lg,
    backgroundColor: 'rgba(11,28,22,0.55)',
  },
  redondo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,235,225,0.15)',
  },
  disparador: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: C.sobreOscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disparadorCentro: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.sobreOscuro },
  previa: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: E.xl, gap: E.lg },
  previaImagen: { width: '100%', flex: 1, maxHeight: 520, borderRadius: R.md },
  titulo: { fontSize: 20, fontWeight: '800', color: C.sobreOscuro, textAlign: 'center' },
  ayuda: { fontSize: 15, color: C.sobreOscuroSuave, textAlign: 'center' },
  botonesFila: { flexDirection: 'row', gap: E.md, flexWrap: 'wrap', justifyContent: 'center' },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: E.xl,
    borderRadius: R.md,
  },
  botonPrimario: { backgroundColor: C.naranja },
  botonSecundario: { backgroundColor: 'rgba(242,235,225,0.15)' },
  botonTexto: { fontSize: 15, fontWeight: '700', color: C.blanco },
  cancelar: { fontSize: 15, color: C.sobreOscuroSuave, textDecorationLine: 'underline' },
});
