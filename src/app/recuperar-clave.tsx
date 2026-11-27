import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { soyAdmin } from '@/lib/api';
import { Aviso, Boton, Campo, Cargando, Entrada, Tarjeta } from '@/ui/componentes';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Paso = 'correo' | 'enviado' | 'nueva' | 'listo';

/**
 * «Olvidé mi contraseña». Ruta pública, en tres pasos:
 *
 * 1. Correo: Supabase envía el correo de recuperación (resetPasswordForEmail).
 * 2. Enlace o código: el enlace del correo vuelve a esta misma página en la web
 *    con la sesión de recuperación (la abre ctx/auth). Si la plantilla del
 *    correo trae el código de 6 dígitos ({{ .Token }}), también se puede
 *    escribir aquí, sin salir de la app.
 * 3. Contraseña nueva (updateUser). Hasta cambiarla no se entra a la app.
 *
 * Por seguridad, el mensaje del paso 1 es el mismo exista o no la cuenta.
 */
export default function RecuperarClave() {
  const {
    sesion,
    cargando: cargandoSesion,
    recuperacion,
    errorRecuperacion,
    pedirRecuperacion,
    verificarCodigoRecuperacion,
    cambiarClave,
    terminarRecuperacion,
  } = useAuth();
  const [paso, setPaso] = useState<Paso>('correo');
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Se llegó desde el enlace del correo (o se validó el código): toca la
  // contraseña nueva.
  useEffect(() => {
    if (recuperacion && sesion && paso !== 'listo') setPaso('nueva');
  }, [recuperacion, sesion, paso]);

  useEffect(() => {
    if (errorRecuperacion) {
      setError(errorRecuperacion);
      setPaso('correo');
    }
  }, [errorRecuperacion]);

  async function enviarCorreo() {
    if (!CORREO.test(correo.trim())) {
      return setError('Escribe el correo con el que te registraste');
    }
    setError(null);
    setEnviando(true);
    try {
      await pedirRecuperacion(correo);
      setPaso('enviado');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo() {
    if (!/^\d{6,10}$/.test(codigo.replace(/\s/g, ''))) {
      return setError('Escribe el código que te llegó al correo');
    }
    setError(null);
    setEnviando(true);
    try {
      await verificarCodigoRecuperacion(correo, codigo);
      setPaso('nueva');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function guardarClave() {
    if (clave.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (clave !== clave2) return setError('Las dos contraseñas no coinciden');
    setError(null);
    setEnviando(true);
    try {
      await cambiarClave(clave);
      terminarRecuperacion();
      setPaso('listo');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function irALaApp() {
    router.replace((await soyAdmin().catch(() => false)) ? '/admin' : '/(app)/pedidos');
  }

  if (cargandoSesion) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fondo, justifyContent: 'center' }}>
        <Cargando texto="Abriendo el enlace…" />
      </View>
    );
  }

  const ojo = (
    <Pressable
      onPress={() => setVerClave((v) => !v)}
      hitSlop={8}
      accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
      <Ionicons name={verClave ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textoSuave} />
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl, gap: E.md }}
        keyboardShouldPersistTaps="handled">
        <Entrada>
          <Text style={s.titulo}>
            {paso === 'nueva'
              ? 'Crea tu contraseña nueva'
              : paso === 'listo'
                ? 'Contraseña actualizada'
                : '¿Olvidaste tu contraseña?'}
          </Text>
          <Text style={s.texto}>
            {paso === 'correo' &&
              'Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.'}
            {paso === 'enviado' &&
              `Si ${correo.trim()} tiene una cuenta en Encárgalo, ya te llegó un correo. Abre el enlace desde tu celular o tu computadora; si en el correo viene un código, también puedes escribirlo aquí.`}
            {paso === 'nueva' && 'Usa al menos 8 caracteres, con letras y números.'}
            {paso === 'listo' && 'Ya puedes usar tu contraseña nueva para ingresar.'}
          </Text>
        </Entrada>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        {paso === 'correo' && (
          <Tarjeta>
            <Campo
              etiqueta="Correo electrónico"
              icono="mail-outline"
              value={correo}
              onChangeText={setCorreo}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              onSubmitEditing={enviarCorreo}
              returnKeyType="send"
            />
            <Boton
              titulo="Enviarme el enlace"
              icono="paper-plane-outline"
              onPress={enviarCorreo}
              cargando={enviando}
            />
          </Tarjeta>
        )}

        {paso === 'enviado' && (
          <>
            <Aviso tono="info" titulo="Revisa tu correo">
              Busca un mensaje de Encárgalo (o de Supabase Auth). Si no aparece en unos minutos,
              mira en spam o en promociones. El enlace sirve una sola vez y vence en una hora.
            </Aviso>
            <Tarjeta>
              <Campo
                etiqueta="Código del correo (opcional)"
                icono="keypad-outline"
                value={codigo}
                onChangeText={setCodigo}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={10}
                placeholder="123456"
                onSubmitEditing={enviarCodigo}
              />
              <Boton
                titulo="Validar código"
                icono="checkmark-outline"
                onPress={enviarCodigo}
                cargando={enviando}
              />
            </Tarjeta>
            <Boton
              titulo="Enviar otra vez"
              icono="refresh-outline"
              variante="fantasma"
              onPress={enviarCorreo}
              deshabilitado={enviando}
            />
            <Boton
              titulo="Usar otro correo"
              variante="suave"
              onPress={() => {
                setError(null);
                setCodigo('');
                setPaso('correo');
              }}
            />
          </>
        )}

        {paso === 'nueva' && (
          <Tarjeta>
            <Campo
              etiqueta="Contraseña nueva"
              icono="lock-closed-outline"
              value={clave}
              onChangeText={setClave}
              secureTextEntry={!verClave}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              derecha={ojo}
            />
            <Campo
              etiqueta="Repite la contraseña"
              icono="lock-closed-outline"
              value={clave2}
              onChangeText={setClave2}
              secureTextEntry={!verClave}
              autoComplete="new-password"
              placeholder="La misma de arriba"
              onSubmitEditing={guardarClave}
              returnKeyType="done"
            />
            <Boton
              titulo="Guardar contraseña"
              icono="save-outline"
              onPress={guardarClave}
              cargando={enviando}
            />
          </Tarjeta>
        )}

        {paso === 'listo' && (
          <>
            <Aviso tono="exito" titulo="Listo">
              Cambiaste tu contraseña. Si usas la app en el celular, ingresa ahí con la nueva.
            </Aviso>
            {sesion && <Boton titulo="Ir a Encárgalo" icono="arrow-forward" onPress={irALaApp} />}
          </>
        )}

        {paso !== 'listo' && paso !== 'nueva' && (
          <Boton
            titulo="Volver a ingresar"
            icono="log-in-outline"
            variante="suave"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/entrar'))}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  titulo: { fontSize: 22, fontWeight: '800', color: C.azul, letterSpacing: -0.4 },
  texto: { fontSize: 14, color: C.textoSuave, lineHeight: 21, marginTop: E.xs },
});
