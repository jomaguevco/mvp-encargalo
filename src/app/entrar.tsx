import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/ctx/auth';
import { Aviso, Boton, Campo, Entrada } from '@/ui/componentes';
import { C, E, G, R, sombra } from '@/ui/tema';

/**
 * Las tres promesas del producto, en la primera pantalla.
 *
 * Son el criterio de producto del equipo —verificación, pago protegido y
 * reputación— y que se vean de un golpe es lo que hace que alguien se anime a
 * registrarse en una aplicación que le va a pedir el DNI.
 */
function Garantia({
  icono,
  titulo,
  texto,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
}) {
  return (
    <View style={s.garantia}>
      <View style={s.garantiaAro}>
        <Ionicons name={icono} size={18} color={C.naranja} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.garantiaTitulo}>{titulo}</Text>
        <Text style={s.garantiaTexto}>{texto}</Text>
      </View>
    </View>
  );
}

export default function Entrar() {
  const { entrar } = useAuth();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
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
      <LinearGradient
        colors={G.marca}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Círculos de fondo: textura sin imágenes */}
      <View style={[s.burbuja, { top: -80, right: -60, width: 260, height: 260 }]} />
      <View style={[s.burbuja, { top: 180, left: -90, width: 200, height: 200 }]} />
      <View style={[s.burbuja, { bottom: -60, right: 30, width: 160, height: 160 }]} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Entrada>
          <View style={s.marca}>
            <LinearGradient
              colors={G.accion}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.logoAro}>
              <Ionicons name="airplane" size={30} color={C.blanco} />
            </LinearGradient>
            <Text style={s.logo}>Encárgalo</Text>
            <Text style={s.lema}>Lo que quieres del extranjero, sin miedo a perder tu plata</Text>
          </View>
        </Entrada>

        <Entrada i={1}>
          <View style={s.panel}>
            <Text style={s.panelTitulo}>Ingresa a tu cuenta</Text>
            <Text style={s.panelSub}>Qué bueno verte otra vez.</Text>

            {!!error && <Aviso tono="error">{error}</Aviso>}

            <Campo
              etiqueta="Correo electrónico"
              icono="mail-outline"
              value={correo}
              onChangeText={setCorreo}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
            />
            <Campo
              etiqueta="Contraseña"
              icono="lock-closed-outline"
              value={clave}
              onChangeText={setClave}
              secureTextEntry={!verClave}
              placeholder="Tu contraseña"
              onSubmitEditing={enviar}
              returnKeyType="go"
              derecha={
                <Pressable
                  onPress={() => setVerClave((v) => !v)}
                  hitSlop={8}
                  accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  <Ionicons
                    name={verClave ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={C.textoSuave}
                  />
                </Pressable>
              }
            />

            <Boton titulo="Entrar" icono="log-in-outline" onPress={enviar} cargando={cargando} />

            <View style={s.separador}>
              <View style={s.separadorLinea} />
              <Text style={s.separadorTexto}>¿Eres nuevo?</Text>
              <View style={s.separadorLinea} />
            </View>

            <Pressable
              onPress={() => router.push('/registro')}
              accessibilityRole="link"
              style={({ pressed }) => [s.crear, pressed && { opacity: 0.8 }]}>
              <Ionicons name="person-add-outline" size={18} color={C.azul} />
              <Text style={s.crearTexto}>Crear una cuenta gratis</Text>
            </Pressable>
          </View>
        </Entrada>

        <Entrada i={2}>
          <View style={s.garantias}>
            <Garantia
              icono="shield-checkmark"
              titulo="Identidad verificada"
              texto="Cada persona valida su DNI contra RENIEC"
            />
            <Garantia
              icono="lock-closed"
              titulo="Pago retenido"
              texto="Tu dinero no se libera hasta que recibas tu producto"
            />
            <Garantia
              icono="star"
              titulo="Reputación pública"
              texto="Lee las reseñas de quien te va a traer tu pedido"
            />
          </View>
        </Entrada>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: E.xl },
  burbuja: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  marca: { alignItems: 'center', marginBottom: E.xl + E.sm, marginTop: E.xl },
  logoAro: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.md,
    transform: [{ rotate: '-8deg' }],
    ...sombra(3),
  },
  logo: { fontSize: 42, fontWeight: '800', color: C.blanco, letterSpacing: -1.4 },
  lema: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    marginTop: E.sm,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },

  panel: {
    backgroundColor: C.blanco,
    borderRadius: R.xl,
    padding: E.xl,
    ...sombra(3),
  },
  panelTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: C.azul,
    letterSpacing: -0.4,
  },
  panelSub: { fontSize: 14.5, color: C.textoSuave, marginTop: 2, marginBottom: E.lg },

  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm,
    marginVertical: E.lg,
  },
  separadorLinea: { flex: 1, height: 1, backgroundColor: C.borde },
  separadorTexto: { fontSize: 13, color: C.textoSuave, fontWeight: '600' },
  crear: {
    height: 50,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.bordeFuerte,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: E.sm,
  },
  crearTexto: { color: C.azul, fontWeight: '800', fontSize: 15.5 },

  garantias: { marginTop: E.xl + E.sm, gap: E.lg, marginBottom: E.xl },
  garantia: { flexDirection: 'row', alignItems: 'center', gap: E.md },
  garantiaAro: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  garantiaTitulo: { color: C.blanco, fontSize: 15, fontWeight: '800' },
  garantiaTexto: { color: 'rgba(255,255,255,0.72)', fontSize: 13.5, marginTop: 1 },
});
