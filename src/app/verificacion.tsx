import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { actualizarPerfil, enviarVerificacion } from '@/lib/api';
import { coincideConReniec } from '@/lib/negocio';
import {
  Aviso,
  Boton,
  Entrada,
  Progreso,
  Tarjeta,
  TarjetaDegradada,
  type NombreIcono,
} from '@/ui/componentes';
import { CampoDni, type EstadoDni } from '@/ui/CampoDni';
import { avisar } from '@/ui/dialogos';
import { C, E, G, R } from '@/ui/tema';

type Captura = { uri: string } | null;

function Paso({
  n,
  titulo,
  hecho,
  children,
}: {
  n: number;
  titulo: string;
  hecho: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tarjeta>
      <View style={s.pasoCabecera}>
        <View style={[s.pasoNumero, hecho && { backgroundColor: C.verde }]}>
          {hecho ? (
            <Ionicons name="checkmark" size={16} color={C.blanco} />
          ) : (
            <Text style={s.pasoNumeroTexto}>{n}</Text>
          )}
        </View>
        <Text style={s.pasoTitulo}>{titulo}</Text>
      </View>
      {children}
    </Tarjeta>
  );
}

function Capturador({
  icono,
  titulo,
  ayuda,
  valor,
  onCapturar,
}: {
  icono: NombreIcono;
  titulo: string;
  ayuda: string;
  valor: Captura;
  onCapturar: () => void;
}) {
  return (
    <Pressable
      onPress={onCapturar}
      style={({ pressed }) => [
        s.capturador,
        valor && s.capturadorListo,
        pressed && { opacity: 0.85 },
      ]}>
      {valor ? (
        <>
          <Image source={{ uri: valor.uri }} style={s.capturaImagen} resizeMode="cover" />
          <View style={s.capturaPie}>
            <Ionicons name="checkmark-circle" size={16} color={C.verde} />
            <Text style={s.capturaPieTexto}>Lista · toca para cambiarla</Text>
          </View>
        </>
      ) : (
        <>
          <View style={s.capturaIcono}>
            <Ionicons name={icono} size={30} color={C.azulMedio} />
          </View>
          <Text style={s.capturaTitulo}>{titulo}</Text>
          <Text style={s.capturaAyuda}>{ayuda}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function Verificacion() {
  const { perfil, refrescarPerfil } = useAuth();
  const [dni, setDni] = useState(perfil?.dni ?? '');
  const [estadoDni, setEstadoDni] = useState<EstadoDni>({ tipo: 'vacio' });
  const [frente, setFrente] = useState<Captura>(null);
  const [selfie, setSelfie] = useState<Captura>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);

  const nombrePerfil = perfil?.nombre_completo ?? '';
  const coincide =
    estadoDni.tipo === 'encontrado' && coincideConReniec(nombrePerfil, estadoDni.persona);
  const dniListo =
    /^[0-9]{8}$/.test(dni) &&
    (estadoDni.tipo === 'encontrado' ? coincide : estadoDni.tipo === 'sin_servicio');
  const hechos = (dniListo ? 1 : 0) + (frente ? 1 : 0) + (selfie ? 1 : 0);

  async function tomar(destino: 'frente' | 'selfie') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    const usarCamara = permiso.granted;

    const res = usarCamara
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.6,
          cameraType:
            destino === 'selfie'
              ? ImagePicker.CameraType.front
              : ImagePicker.CameraType.back,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.6,
        });

    if (res.canceled || !res.assets?.[0]) return;
    const captura = { uri: res.assets[0].uri };
    if (destino === 'frente') setFrente(captura);
    else setSelfie(captura);
  }

  /** Reemplaza el nombre del perfil por el de RENIEC: el error más común. */
  async function usarNombreReniec() {
    if (estadoDni.tipo !== 'encontrado') return;
    setCorrigiendo(true);
    try {
      await actualizarPerfil({ nombre_completo: estadoDni.nombre });
      await refrescarPerfil();
    } catch (e) {
      avisar('No se pudo actualizar tu nombre', (e as Error).message);
    } finally {
      setCorrigiendo(false);
    }
  }

  async function enviar() {
    setError(null);
    if (!/^[0-9]{8}$/.test(dni.trim())) {
      setError('El DNI debe tener exactamente 8 dígitos');
      return;
    }
    if (estadoDni.tipo === 'no_existe')
      return setError('RENIEC no reconoce ese número de DNI. Revísalo antes de continuar.');
    if (estadoDni.tipo === 'encontrado' && !coincide)
      return setError('El nombre de tu perfil no coincide con el de RENIEC. Corrígelo primero.');
    if (!frente) return setError('Falta la foto del frente de tu DNI');
    if (!selfie) return setError('Falta tu selfie');

    setEnviando(true);
    try {
      const resultado = await enviarVerificacion({
        dni: dni.trim(),
        dniFrenteUri: frente.uri,
        selfieUri: selfie.uri,
      });
      await refrescarPerfil();
      if (resultado === 'no_existe') {
        // Si el rechazo automático está activo, el perfil ya figura como rechazado
        // y se vuelve a mostrar este formulario. Si no, queda en revisión.
        setError('RENIEC no reconoce ese número de DNI. Revísalo antes de continuar.');
        return;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  // ------------------------------------------------ ya enviada
  if (perfil?.verificacion === 'en_revision') {
    const validado = perfil.dni_validacion === 'coincide';
    return (
      <ScrollView
        style={{ backgroundColor: C.fondo }}
        contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}>
        <Entrada>
          <TarjetaDegradada colores={G.marca} style={{ alignItems: 'center' }}>
            <View style={s.esperaIcono}>
              <Ionicons name="hourglass" size={34} color={C.blanco} />
            </View>
            <Text style={s.esperaTitulo}>Estamos revisando tus documentos</Text>
            <Text style={s.esperaTexto}>
              Suele tomar menos de 24 horas. Te avisaremos en la bandeja de avisos apenas
              termine.
            </Text>
          </TarjetaDegradada>
        </Entrada>
        <Entrada i={1}>
          <Tarjeta>
            {[
              { ok: true, texto: 'Documentos recibidos', icono: 'cloud-done' as const },
              {
                ok: validado,
                texto: validado
                  ? 'Nombre y DNI validados con RENIEC'
                  : 'Validación con RENIEC a cargo del equipo',
                icono: 'shield-checkmark' as const,
              },
              { ok: false, texto: 'Un operador compara tu selfie con el DNI', icono: 'eye' as const },
            ].map((p) => (
              <View key={p.texto} style={s.esperaPaso}>
                <View style={[s.esperaPasoIcono, p.ok && { backgroundColor: C.verdeClaro }]}>
                  <Ionicons name={p.icono} size={18} color={p.ok ? C.verde : C.textoSuave} />
                </View>
                <Text style={[s.esperaPasoTexto, p.ok && { color: C.texto }]}>{p.texto}</Text>
              </View>
            ))}
          </Tarjeta>
        </Entrada>
        <Boton titulo="Volver" variante="fantasma" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  // ------------------------------------------------ formulario
  return (
    <ScrollView
      style={{ backgroundColor: C.fondo }}
      contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}
      keyboardShouldPersistTaps="handled">
      <Entrada>
        <TarjetaDegradada colores={G.marca}>
          <View style={{ flexDirection: 'row', gap: E.md, alignItems: 'center' }}>
            <View style={s.heroIcono}>
              <Ionicons name="finger-print" size={28} color={C.blanco} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitulo}>Verifica tu identidad</Text>
              <Text style={s.heroTexto}>
                Es lo que diferencia a Encárgalo de un grupo de Facebook: todos aquí están
                identificados.
              </Text>
            </View>
          </View>
          <View style={{ marginTop: E.lg }}>
            <Progreso hechos={hechos} total={3} color="#7EE2B8" />
            <Text style={s.heroProgreso}>{hechos} de 3 pasos listos</Text>
          </View>
        </TarjetaDegradada>
      </Entrada>

      {perfil?.verificacion === 'rechazado' && (
        <Aviso tono="error" titulo="Tu verificación anterior fue rechazada">
          {perfil.motivo_rechazo ?? 'Vuelve a enviar tus documentos.'}
        </Aviso>
      )}

      {!!error && <Aviso tono="error">{error}</Aviso>}

      <Entrada i={1}>
        <Paso n={1} titulo="Tu número de DNI" hecho={dniListo}>
          <CampoDni valor={dni} onCambiar={setDni} onEstado={setEstadoDni} />
          {estadoDni.tipo === 'encontrado' && !coincide && (
            <View style={s.diferencia}>
              <Text style={s.diferenciaTitulo}>El nombre de tu perfil es distinto</Text>
              <Text style={s.diferenciaTexto}>
                En tu cuenta figura «{nombrePerfil || 'sin nombre'}». Para verificarte tiene
                que coincidir con tu DNI.
              </Text>
              <Boton
                titulo="Usar el nombre de RENIEC"
                icono="sync"
                variante="secundario"
                chico
                cargando={corrigiendo}
                onPress={usarNombreReniec}
                style={{ marginTop: E.md }}
              />
            </View>
          )}
        </Paso>
      </Entrada>

      <Entrada i={2}>
        <Paso n={2} titulo="Frente de tu DNI" hecho={!!frente}>
          <Capturador
            icono="card-outline"
            titulo="Tomar foto del DNI"
            ayuda="Que se lea el número y tu nombre, sin reflejos."
            valor={frente}
            onCapturar={() => tomar('frente')}
          />
        </Paso>
      </Entrada>

      <Entrada i={3}>
        <Paso n={3} titulo="Tu selfie" hecho={!!selfie}>
          <Capturador
            icono="happy-outline"
            titulo="Tomarme una selfie"
            ayuda="Rostro descubierto, con buena luz y sin lentes oscuros."
            valor={selfie}
            onCapturar={() => tomar('selfie')}
          />
        </Paso>
      </Entrada>

      <Aviso tono="info" titulo="Tus datos están protegidos">
        Las imágenes se guardan en un espacio privado al que solo tú y el equipo de
        verificación tienen acceso, y se eliminan al aprobarse tu identidad. Guardamos
        únicamente el número de DNI, según la Ley N° 29733.
      </Aviso>

      <Boton
        titulo="Enviar a verificación"
        icono="send"
        onPress={enviar}
        cargando={enviando}
        deshabilitado={hechos < 3}
      />
      <View style={{ height: E.sm }} />
      <Boton titulo="Ahora no" variante="fantasma" onPress={() => router.back()} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  heroIcono: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitulo: { color: C.blanco, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  heroTexto: { color: 'rgba(255,255,255,0.8)', fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  heroProgreso: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: '700', marginTop: 6 },

  pasoCabecera: { flexDirection: 'row', alignItems: 'center', gap: E.sm + 2, marginBottom: E.lg },
  pasoNumero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoNumeroTexto: { color: C.blanco, fontWeight: '800', fontSize: 13.5 },
  pasoTitulo: { fontSize: 16.5, fontWeight: '800', color: C.azul },

  diferencia: {
    backgroundColor: C.ambarClaro,
    borderRadius: R.md,
    padding: E.md,
    marginTop: -E.sm,
  },
  diferenciaTitulo: { fontSize: 14.5, fontWeight: '800', color: '#7A3D06' },
  diferenciaTexto: { fontSize: 13.5, color: '#7A3D06', marginTop: 3, lineHeight: 19 },

  capturador: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.bordeFuerte,
    borderRadius: R.lg,
    padding: E.xl,
    backgroundColor: C.azulFondo,
    alignItems: 'center',
    overflow: 'hidden',
  },
  capturadorListo: { borderStyle: 'solid', borderColor: C.verde, padding: 0 },
  capturaIcono: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.md,
  },
  capturaTitulo: { fontSize: 15.5, fontWeight: '800', color: C.azul },
  capturaAyuda: {
    fontSize: 13,
    color: C.textoSuave,
    textAlign: 'center',
    marginTop: E.xs,
    lineHeight: 19,
  },
  capturaImagen: { width: '100%', height: 200 },
  capturaPie: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: E.sm + 2 },
  capturaPieTexto: { color: C.verde, fontWeight: '800', fontSize: 13 },

  esperaIcono: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.md,
  },
  esperaTitulo: {
    color: C.blanco,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  esperaTexto: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: E.sm,
    lineHeight: 20,
  },
  esperaPaso: { flexDirection: 'row', alignItems: 'center', gap: E.md, paddingVertical: E.sm },
  esperaPasoIcono: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.superficieSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  esperaPasoTexto: { flex: 1, fontSize: 14.5, fontWeight: '700', color: C.textoSuave },
});
