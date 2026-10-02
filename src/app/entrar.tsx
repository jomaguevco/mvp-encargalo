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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/ctx/auth';
import { Aviso, Boton, Campo } from '@/ui/componentes';
import { C, E, R, sombra } from '@/ui/tema';

/**
 * Las tres promesas del producto, en la primera pantalla.
 *
 * Antes iban en un párrafo de letra pequeña al pie. Son el criterio de producto
 * del equipo —verificación, pago protegido y reputación— y que se vean de un
 * golpe es lo que hace que alguien se anime a registrarse en una aplicación que
 * le va a pedir el DNI.
 */
function Garantia({
  icono,
  texto,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
}) {
  return (
    <View style={s.garantia}>
      <View style={s.garantiaAro}>
        <Ionicons name={icono} size={17} color={C.blanco} />
      </View>
      <Text style={s.garantiaTexto}>{texto}</Text>
    </View>
  );
}

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
          <View style={s.logoAro}>
            <Ionicons name="airplane" size={26} color={C.naranja} />
          </View>
          <Text style={s.logo}>Encárgalo</Text>
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
            onSubmitEditing={enviar}
            returnKeyType="go"
          />

          <Boton titulo="Entrar" onPress={enviar} cargando={cargando} />

          <View style={s.pie}>
            <Text style={s.pieTexto}>¿Todavía no tienes cuenta? </Text>
            <Link href="/registro" style={s.enlace}>
              Créala aquí
            </Link>
          </View>
        </View>

        <View style={s.garantias}>
          <Garantia icono="shield-checkmark" texto="Identidad verificada con DNI" />
          <Garantia icono="lock-closed" texto="Tu pago retenido hasta que recibas" />
          <Garantia icono="star" texto="Reputación pública de cada persona" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: E.xl },

  marca: { alignItems: 'center', marginBottom: E.xl + E.sm },
  logoAro: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: E.md,
  },
  logo: { fontSize: 40, fontWeight: '800', color: C.blanco, letterSpacing: -1.2 },
  lema: {
    color: C.azulClaro,
    fontSize: 15,
    marginTop: E.sm,
    textAlign: 'center',
  },

  panel: {
    backgroundColor: C.blanco,
    borderRadius: R.xl,
    padding: E.xl,
    ...sombra(3),
  },
  panelTitulo: {
    fontSize: 21,
    fontWeight: '800',
    color: C.azul,
    marginBottom: E.lg,
    letterSpacing: -0.4,
  },

  pie: { flexDirection: 'row', justifyContent: 'center', marginTop: E.lg },
  pieTexto: { color: C.textoSuave, fontSize: 14.5 },
  enlace: { color: C.naranja, fontWeight: '800', fontSize: 14.5 },

  garantias: { marginTop: E.xl + E.sm, gap: E.md },
  garantia: { flexDirection: 'row', alignItems: 'center', gap: E.md },
  garantiaAro: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  garantiaTexto: {
    color: C.azulClaro,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
