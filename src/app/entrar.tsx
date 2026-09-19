import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/ctx/auth';
import { Aviso, Boton, Campo } from '@/ui/componentes';
import { C, E, R } from '@/ui/tema';

export default function Entrar() {
  const { entrar } = useAuth();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    setError(null);
    if (!correo.trim() || !clave) {
      setError('Completa tu correo y tu contraseña');
      return;
    }
    setCargando(true);
    try {
      await entrar(correo, clave);
      router.replace('/(app)/pedidos');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.azul }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={s.marca}>
          <Text style={s.logo}>Encárgalo</Text>
          <View style={s.subrayado} />
          <Text style={s.lema}>La forma segura de pedir del extranjero</Text>
        </View>

        <View style={s.panel}>
          <Text style={s.panelTitulo}>Ingresa a tu cuenta</Text>

          {!!error && <Aviso tono="error">{error}</Aviso>}

          <Campo
            etiqueta="Correo electrónico"
            value={correo}
            onChangeText={setCorreo}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
          />
          <Campo
            etiqueta="Contraseña"
            value={clave}
            onChangeText={setClave}
            secureTextEntry
            placeholder="Tu contraseña"
          />

          <Boton titulo="Entrar" onPress={enviar} cargando={cargando} />

          <View style={s.pie}>
            <Text style={s.pieTexto}>¿Todavía no tienes cuenta? </Text>
            <Link href="/registro" style={s.enlace}>
              Créala aquí
            </Link>
          </View>
        </View>

        <Text style={s.legal}>
          Encárgalo verifica la identidad de todos sus usuarios con DNI y retiene el
          pago hasta que confirmas que recibiste tu pedido.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: E.xl },
  marca: { alignItems: 'center', marginBottom: E.xxl },
  logo: { fontSize: 42, fontWeight: '800', color: C.blanco, letterSpacing: -1 },
  subrayado: {
    width: 56,
    height: 4,
    backgroundColor: C.naranja,
    borderRadius: 2,
    marginTop: E.sm,
  },
  lema: { color: C.azulClaro, fontSize: 15, marginTop: E.md },

  panel: { backgroundColor: C.blanco, borderRadius: R.xl, padding: E.xl },
  panelTitulo: {
    fontSize: 20,
    fontWeight: '800',
    color: C.azul,
    marginBottom: E.lg,
  },

  pie: { flexDirection: 'row', justifyContent: 'center', marginTop: E.lg },
  pieTexto: { color: C.textoSuave, fontSize: 14 },
  enlace: { color: C.naranja, fontWeight: '700', fontSize: 14 },

  legal: {
    color: C.azulClaro,
    fontSize: 12,
    textAlign: 'center',
    marginTop: E.xl,
    lineHeight: 18,
  },
});
