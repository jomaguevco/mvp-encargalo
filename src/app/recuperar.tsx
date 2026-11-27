import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { soyAdmin } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Aviso, Boton, Campo, Entrada, Tarjeta } from '@/ui/componentes';
import { empezarEn } from '@/ui/navegacion';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

/**
 * Recuperar la contraseña con un código que llega al correo.
 *
 * Se usa un código y no un enlace porque el enlace tendría que abrir la app
 * instalada (APK) o la web según dónde lo toque la persona, y eso exige
 * configurar enlaces profundos. El código funciona igual en los dos.
 *
 * Requisito en Supabase (una sola vez): Authentication → Emails → «Reset
 * Password», agregar {{ .Token }} a la plantilla. Ver README, «Recuperar
 * contraseña».
 */

const ESPERA_REENVIO = 60; // segundos entre un código y otro

function mensajeLegible(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) {
    return 'El código no es válido o ya venció. Revisa que sea el del último correo o pide uno nuevo.';
  }
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) {
    return 'Pediste varios códigos seguidos. Espera unos minutos y vuelve a intentarlo.';
  }
  if (m.includes('same') && m.includes('password')) {
    return 'La nueva contraseña debe ser distinta de la anterior.';
  }
  if (m.includes('weak') || m.includes('password should')) {
    return 'Esa contraseña es muy débil. Usa al menos 8 caracteres, con letras y números.';
  }
  return mensaje;
}

export default function Recuperar() {
  const { correo: correoInicial } = useLocalSearchParams<{ correo?: string }>();
  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo');
  const [correo, setCorreo] = useState(correoInicial ?? '');
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);

  // Cuenta regresiva para reenviar el código
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const limpio = correo.trim().toLowerCase();

  async function pedirCodigo() {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      setError('Escribe el correo con el que te registraste');
      return;
    }
    setCargando(true);
    try {
      // Supabase no dice si el correo existe: así nadie puede averiguar qué
      // correos tienen cuenta. La pantalla tampoco lo dice.
      const { error: e } = await supabase.auth.resetPasswordForEmail(limpio);
      if (e) throw e;
      setPaso('codigo');
      setEspera(ESPERA_REENVIO);
    } catch (e) {
      setError(mensajeLegible((e as Error).message));
    } finally {
      setCargando(false);
    }
  }

  async function cambiarClave() {
    setError(null);
    const token = codigo.replace(/\s/g, '');
    if (!/^[0-9]{6,10}$/.test(token)) {
      setError('Escribe el código de números que te llegó al correo');
      return;
    }
    if (clave.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (clave !== repetir) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    setCargando(true);
    try {
      // El código abre una sesión de recuperación; con ella se cambia la clave.
      const { error: e1 } = await supabase.auth.verifyOtp({
        email: limpio,
        token,
        type: 'recovery',
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.auth.updateUser({ password: clave });
      if (e2) throw e2;
      // Ya entró con la clave nueva: a su inicio, sin volver a esta pantalla.
      empezarEn((await soyAdmin()) ? '/admin' : '/(app)/pedidos');
    } catch (e) {
      setError(mensajeLegible((e as Error).message));
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}
        keyboardShouldPersistTaps="handled">
        <Entrada>
          <View style={s.intro}>
            <View style={s.introIcono}>
              <Ionicons name="key" size={24} color={C.naranja} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.introTitulo}>Recupera tu contraseña</Text>
              <Text style={s.introTexto}>
                {paso === 'correo'
                  ? 'Te enviaremos un código a tu correo para que elijas una contraseña nueva.'
                  : 'Escribe el código que te llegó y elige tu nueva contraseña.'}
              </Text>
            </View>
          </View>
        </Entrada>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        <Entrada i={1}>
          <Tarjeta>
            {paso === 'correo' ? (
              <>
                <Campo
                  etiqueta="Correo electrónico"
                  icono="mail-outline"
                  value={correo}
                  onChangeText={setCorreo}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  onSubmitEditing={pedirCodigo}
                  returnKeyType="send"
                />
                <Boton
                  titulo="Enviarme el código"
                  icono="paper-plane-outline"
                  onPress={pedirCodigo}
                  cargando={cargando}
                />
              </>
            ) : (
              <>
                <Aviso tono="info" titulo="Revisa tu correo">
                  Si {limpio} tiene una cuenta en Encárgalo, te llegó un código. Mira también en
                  spam o promociones.
                </Aviso>
                <Campo
                  etiqueta="Código"
                  icono="keypad-outline"
                  value={codigo}
                  onChangeText={setCodigo}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={10}
                  placeholder="123456"
                />
                <Campo
                  etiqueta="Nueva contraseña"
                  icono="lock-closed-outline"
                  value={clave}
                  onChangeText={setClave}
                  secureTextEntry={!verClave}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
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
                <Campo
                  etiqueta="Repite la contraseña"
                  icono="lock-closed-outline"
                  value={repetir}
                  onChangeText={setRepetir}
                  secureTextEntry={!verClave}
                  autoComplete="new-password"
                  placeholder="La misma de arriba"
                  onSubmitEditing={cambiarClave}
                  returnKeyType="go"
                />
                <Boton
                  titulo="Cambiar contraseña y entrar"
                  icono="checkmark-circle-outline"
                  onPress={cambiarClave}
                  cargando={cargando}
                />
                <View style={s.acciones}>
                  <Pressable
                    onPress={pedirCodigo}
                    disabled={espera > 0 || cargando}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <Text style={[s.enlace, (espera > 0 || cargando) && s.enlaceInactivo]}>
                      {espera > 0 ? `Reenviar código en ${espera} s` : 'Reenviar código'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setPaso('correo');
                      setCodigo('');
                      setError(null);
                    }}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <Text style={s.enlace}>Usar otro correo</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Tarjeta>
        </Entrada>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  intro: { flexDirection: 'row', gap: E.md, alignItems: 'center', marginBottom: E.lg },
  introIcono: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.naranjaClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitulo: { fontSize: 22, fontWeight: '800', color: C.azul, letterSpacing: -0.4 },
  introTexto: { fontSize: 14, color: C.textoSuave, lineHeight: 20, marginTop: 2 },
  acciones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: E.md,
  },
  enlace: { color: C.azulMedio, fontWeight: '600', fontSize: 14 },
  enlaceInactivo: { color: C.textoSuave },
});
