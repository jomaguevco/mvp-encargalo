import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { enviarVerificacion } from '@/lib/api';
import { Aviso, Boton, Campo, Parrafo, Subtitulo } from '@/ui/componentes';
import { C, E, R } from '@/ui/tema';

type Captura = { uri: string } | null;

function Capturador({
  titulo,
  ayuda,
  valor,
  onCapturar,
}: {
  titulo: string;
  ayuda: string;
  valor: Captura;
  onCapturar: () => void;
}) {
  return (
    <Pressable
      onPress={onCapturar}
      style={{
        borderWidth: 2,
        borderStyle: valor ? 'solid' : 'dashed',
        borderColor: valor ? C.verde : C.borde,
        borderRadius: R.lg,
        padding: valor ? 0 : E.xl,
        marginBottom: E.lg,
        backgroundColor: C.blanco,
        overflow: 'hidden',
        alignItems: 'center',
      }}>
      {valor ? (
        <>
          <Image
            source={{ uri: valor.uri }}
            style={{ width: '100%', height: 190 }}
            resizeMode="cover"
          />
          <Text
            style={{
              paddingVertical: E.sm,
              color: C.verde,
              fontWeight: '700',
              fontSize: 13,
            }}>
            {titulo} · toca para cambiar
          </Text>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.azul }}>
            {titulo}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: C.textoSuave,
              textAlign: 'center',
              marginTop: E.xs,
              lineHeight: 19,
            }}>
            {ayuda}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function Verificacion() {
  const { perfil, refrescarPerfil } = useAuth();
  const [dni, setDni] = useState(perfil?.dni ?? '');
  const [frente, setFrente] = useState<Captura>(null);
  const [selfie, setSelfie] = useState<Captura>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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

  async function enviar() {
    setError(null);
    if (!/^[0-9]{8}$/.test(dni.trim())) {
      setError('El DNI debe tener exactamente 8 dígitos');
      return;
    }
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
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (perfil?.verificacion === 'en_revision') {
    return (
      <ScrollView contentContainerStyle={{ padding: E.xl }}>
        <Aviso tono="alerta" titulo="Ya enviaste tus documentos">
          Estamos validando tu DNI contra RENIEC. Suele tomar menos de 24 horas y te
          avisaremos apenas termine.
        </Aviso>
        <Boton titulo="Volver" variante="fantasma" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: E.xl }}
      keyboardShouldPersistTaps="handled">
      <Subtitulo>Verifica tu identidad</Subtitulo>
      <Parrafo suave style={{ marginBottom: E.lg }}>
        Esto es lo que diferencia a Encárgalo de un grupo de Facebook: todos los que
        operan aquí están identificados. Sin verificación no puedes publicar pedidos ni
        enviar ofertas.
      </Parrafo>

      {!!error && <Aviso tono="error">{error}</Aviso>}

      <Campo
        etiqueta="Número de DNI"
        value={dni}
        onChangeText={setDni}
        keyboardType="number-pad"
        maxLength={8}
        placeholder="8 dígitos"
      />

      <Capturador
        titulo="Frente de tu DNI"
        ayuda="Toca para tomar la foto. Que se lea el número y tu nombre, sin reflejos."
        valor={frente}
        onCapturar={() => tomar('frente')}
      />

      <Capturador
        titulo="Tu selfie"
        ayuda="Toca para tomarte una foto. Rostro descubierto y con buena luz."
        valor={selfie}
        onCapturar={() => tomar('selfie')}
      />

      <Aviso tono="info" titulo="Tus datos están protegidos">
        Las imágenes viajan cifradas y se almacenan en un espacio privado al que solo tú
        tienes acceso. Se eliminan una vez validada tu identidad: guardamos únicamente
        el resultado de la verificación, según la Ley N° 29733.
      </Aviso>

      <Boton titulo="Enviar a verificación" onPress={enviar} cargando={enviando} />
      <View style={{ height: E.sm }} />
      <Boton titulo="Ahora no" variante="fantasma" onPress={() => router.back()} />
    </ScrollView>
  );
}
