import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { solicitarEliminacionPublica } from '@/lib/api';
import { SE_BORRA, SE_CONSERVA } from '@/lib/negocio';
import { Aviso, Boton, Campo, Entrada, Micro, Tarjeta } from '@/ui/componentes';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ListaDatos({ titulo, items, icono, color }: {
  titulo: string;
  items: string[];
  icono: 'trash-outline' | 'archive-outline';
  color: string;
}) {
  return (
    <Tarjeta>
      <View style={s.listaCabecera}>
        <Ionicons name={icono} size={18} color={color} />
        <Text style={s.bloqueTitulo}>{titulo}</Text>
      </View>
      {items.map((t) => (
        <View key={t} style={s.item}>
          <View style={[s.punto, { backgroundColor: color }]} />
          <Text style={s.itemTexto}>{t}</Text>
        </View>
      ))}
    </Tarjeta>
  );
}

/**
 * Eliminar la cuenta desde la web (lo pide Google Play: debe poder hacerse
 * sin instalar la aplicación). Ruta pública. La solicitud entra a una cola
 * que el equipo revisa en /admin/eliminaciones; nada se borra al instante.
 */
export default function EliminarCuenta() {
  const { sesion } = useAuth();
  const [correo, setCorreo] = useState('');
  const [dni, setDni] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  async function enviar() {
    if (!CORREO.test(correo.trim())) return setError('Escribe el correo con el que te registraste');
    if (!/^[0-9]{8}$/.test(dni.trim())) return setError('Escribe tu DNI (8 dígitos)');
    setError(null);
    setEnviando(true);
    try {
      await solicitarEliminacionPublica(correo, dni, motivo);
      setListo(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl, gap: E.md }}
        keyboardShouldPersistTaps="handled">
        <Entrada>
          <Text style={s.titulo}>Eliminar tu cuenta de Encárgalo</Text>
          <Text style={s.texto}>
            Puedes pedir que eliminemos tu cuenta y tus datos personales en cualquier momento
            (Ley N° 29733). El equipo revisa cada solicitud y la completa en un máximo de 10 días
            hábiles; si tienes un pedido o un pago en curso, esperamos a que se cierre para no
            dejar tu dinero ni el de otra persona en el aire.
          </Text>
        </Entrada>

        <Tarjeta>
          <Text style={s.bloqueTitulo}>Cómo pedirlo</Text>
          <Text style={s.texto}>
            1. Desde la app: Perfil → «Eliminar mi cuenta».{'\n'}
            2. Sin la app: llena el formulario de abajo con el correo de tu cuenta y tu DNI.
          </Text>
          {sesion && (
            <Boton
              titulo="Ir a mi perfil"
              icono="person-outline"
              variante="fantasma"
              chico
              style={{ marginTop: E.md }}
              onPress={() => router.push('/(app)/perfil')}
            />
          )}
        </Tarjeta>

        <ListaDatos titulo="Lo que se borra" items={SE_BORRA} icono="trash-outline" color={C.rojo} />
        <ListaDatos
          titulo="Lo que conservamos, y por qué"
          items={SE_CONSERVA}
          icono="archive-outline"
          color={C.azulMedio}
        />

        {listo ? (
          <Aviso tono="exito" titulo="Recibimos tu solicitud">
            Si el correo y el DNI corresponden a una cuenta, el equipo la eliminará y te escribirá a
            ese correo para confirmarlo.
          </Aviso>
        ) : (
          <Tarjeta>
            <Text style={[s.bloqueTitulo, { marginBottom: E.md }]}>Solicitar la eliminación</Text>
            {!!error && <Aviso tono="error">{error}</Aviso>}
            <Campo
              etiqueta="Correo de tu cuenta"
              icono="mail-outline"
              value={correo}
              onChangeText={setCorreo}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Campo
              etiqueta="DNI"
              icono="card-outline"
              value={dni}
              onChangeText={(t) => setDni(t.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              ayuda="Lo usamos para confirmar que la cuenta es tuya"
            />
            <Campo
              etiqueta="Motivo"
              value={motivo}
              onChangeText={setMotivo}
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
              ayuda="Opcional. Nos ayuda a mejorar"
              maxLength={1000}
            />
            <Boton
              titulo="Solicitar la eliminación"
              icono="trash-outline"
              variante="peligro"
              cargando={enviando}
              onPress={enviar}
            />
          </Tarjeta>
        )}

        <Micro>
          ¿Dudas? Escríbenos al correo de soporte o usa el libro de reclamaciones.
        </Micro>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  titulo: { fontSize: 22, fontWeight: '800', color: C.azul, letterSpacing: -0.4 },
  texto: { fontSize: 14, color: C.textoSuave, lineHeight: 21, marginTop: E.xs },
  bloqueTitulo: { fontSize: 16, fontWeight: '800', color: C.azul },
  listaCabecera: { flexDirection: 'row', alignItems: 'center', gap: E.sm, marginBottom: E.sm },
  item: { flexDirection: 'row', gap: E.sm, alignItems: 'flex-start', paddingVertical: 3 },
  punto: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  itemTexto: { flex: 1, fontSize: 14, color: C.texto, lineHeight: 20 },
});
