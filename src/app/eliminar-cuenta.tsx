import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { miSolicitudEliminacion, solicitarEliminacionCuenta } from '@/lib/api';
import { fecha } from '@/lib/negocio';
import { Aviso, Boton, Campo, Cargando, Parrafo, Tarjeta } from '@/ui/componentes';
import { confirmar } from '@/ui/dialogos';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

const SE_BORRA = [
  'Tu nombre, número de DNI, teléfono y correo',
  'Las fotos de tu DNI, tu selfie y tu foto de perfil',
  'Tu acceso: ya no podrás iniciar sesión con esa cuenta',
];

const SE_CONSERVA = [
  'Los pedidos, pagos y calificaciones en los que participaste, sin tu nombre: la otra persona los necesita y la ley tributaria obliga a guardarlos',
  'Las hojas del libro de reclamaciones, por dos años, como exige la ley',
];

/**
 * Eliminar la cuenta (requisito de Google Play). Es una ruta pública para que
 * sirva también como enlace web: sin sesión explica el proceso y pide entrar.
 * El equipo resuelve la solicitud en hasta 7 días (admin_eliminar_cuenta, 0020).
 */
export default function EliminarCuenta() {
  const { sesion, cargando } = useAuth();
  const [pendiente, setPendiente] = useState<string | null | undefined>(undefined);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sesion) miSolicitudEliminacion().then(setPendiente).catch(() => setPendiente(null));
    else setPendiente(null);
  }, [sesion]);

  async function solicitar() {
    const seguro = await confirmar(
      'Eliminar mi cuenta',
      'Borraremos tus datos personales en un plazo máximo de 7 días. No se puede deshacer.',
      'Eliminar',
      true,
    );
    if (!seguro) return;
    setEnviando(true);
    setError(null);
    try {
      await solicitarEliminacionCuenta(motivo.trim() || undefined);
      setPendiente(new Date().toISOString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (cargando || pendiente === undefined) return <Cargando />;

  return (
    <ScrollView style={{ backgroundColor: C.fondo }} contentContainerStyle={s.contenido}>
      <View style={s.cabecera}>
        <View style={s.icono}>
          <Ionicons name="trash" size={24} color={C.rojo} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Eliminar tu cuenta de Encárgalo</Text>
          <Text style={s.subtitulo}>Lo resolvemos en un plazo máximo de 7 días.</Text>
        </View>
      </View>

      <Tarjeta>
        <Text style={s.bloque}>Qué se borra</Text>
        {SE_BORRA.map((t) => (
          <Fila key={t} icono="close-circle" color={C.rojo} texto={t} />
        ))}
        <Text style={[s.bloque, { marginTop: E.md }]}>Qué se conserva, sin tus datos</Text>
        {SE_CONSERVA.map((t) => (
          <Fila key={t} icono="archive" color={C.textoSuave} texto={t} />
        ))}
      </Tarjeta>

      {!sesion ? (
        <>
          <Parrafo suave>
            Para confirmar que la cuenta es tuya, inicia sesión y vuelve a esta página (Perfil →
            Eliminar mi cuenta). Si ya no puedes entrar, escríbenos desde el correo de la cuenta.
          </Parrafo>
          <Boton titulo="Iniciar sesión" icono="log-in" onPress={() => router.push('/entrar')} />
        </>
      ) : pendiente ? (
        <Aviso tono="info" titulo="Solicitud recibida">
          La pediste el {fecha(pendiente)}. Eliminaremos tu cuenta en un plazo máximo de 7 días y
          ya no podrás iniciar sesión con ella.
        </Aviso>
      ) : (
        <>
          <Campo
            etiqueta="¿Por qué te vas? (opcional)"
            value={motivo}
            onChangeText={setMotivo}
            multiline
            maxLength={500}
            style={{ height: 80, textAlignVertical: 'top' }}
          />
          {!!error && <Aviso tono="error">{error}</Aviso>}
          <Boton titulo="Eliminar mi cuenta" icono="trash" variante="peligro" onPress={solicitar} cargando={enviando} />
        </>
      )}
    </ScrollView>
  );
}

function Fila({ icono, color, texto }: { icono: 'close-circle' | 'archive'; color: string; texto: string }) {
  return (
    <View style={s.fila}>
      <Ionicons name={icono} size={16} color={color} style={{ marginTop: 2 }} />
      <Text style={s.filaTexto}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  contenido: { padding: E.lg, paddingBottom: E.xxl, gap: E.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  cabecera: { flexDirection: 'row', gap: E.md, alignItems: 'center' },
  icono: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.rojoClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 20, fontWeight: '800', color: C.azul, letterSpacing: -0.4 },
  subtitulo: { fontSize: 14, color: C.textoSuave, marginTop: 2 },
  bloque: { fontSize: 15, fontWeight: '800', color: C.azul, marginBottom: E.sm },
  fila: { flexDirection: 'row', gap: E.sm, marginBottom: E.sm },
  filaTexto: { flex: 1, fontSize: 14, color: C.texto, lineHeight: 20 },
});
