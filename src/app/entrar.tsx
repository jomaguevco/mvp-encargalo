import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/ui/Texto';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/ctx/auth';
import { Aviso, Boton, Campo, Entrada } from '@/ui/componentes';
import { useEscritorio } from '@/ui/escritorio';
import { Simbolo } from '@/ui/Logo';
import { C, E, R } from '@/ui/tema';

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
        {/* Sobre Monte el acento es Trigo: la Terracota pierde contraste. */}
        <Ionicons name={icono} size={18} color={C.trigo} />
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
  const { es: escritorio } = useEscritorio();

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

  const garantias = (
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
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.azul }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* En escritorio: la marca y las garantías a la izquierda, el formulario a la derecha. */}
        <View style={escritorio && s.filaEscritorio}>
          <View style={escritorio && s.colMarca}>
            <Entrada>
              <View style={[s.marca, escritorio && s.marcaEscritorio]}>
                {/* Encaje vertical sobre oscuro, como en la hoja de marca */}
                <View style={s.logoAro} accessibilityLabel="Logo de Encárgalo">
                  <Simbolo tamano={escritorio ? 84 : 72} oscuro />
                </View>
                <Text style={[s.logo, escritorio && { fontSize: 52 }]}>Encárgalo</Text>
                <Text style={[s.lema, escritorio && s.lemaEscritorio]}>
                  Lo que quieres del extranjero, sin miedo a perder tu plata
                </Text>
              </View>
            </Entrada>
            {escritorio && garantias}
          </View>

          <Entrada i={1} style={escritorio ? s.colPanel : undefined}>
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

          {!escritorio && garantias}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: E.xl },
  marca: { alignItems: 'center', marginBottom: E.xl + E.sm, marginTop: E.xl },
  filaEscritorio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 72,
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
  },
  colMarca: { flex: 1 },
  colPanel: { width: 440 },
  marcaEscritorio: { alignItems: 'flex-start', marginTop: 0 },
  lemaEscritorio: {
    textAlign: 'left',
    fontSize: 20,
    lineHeight: 28,
    maxWidth: 460,
  },
  logoAro: { marginBottom: E.sm },
  logo: {
    fontSize: 42,
    fontWeight: '700',
    color: C.sobreOscuro,
    letterSpacing: -1,
  },
  lema: {
    color: C.sobreOscuroSuave,
    fontSize: 15,
    marginTop: E.sm,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },

  panel: {
    backgroundColor: C.fondo,
    borderRadius: R.lg,
    padding: E.xl,
  },
  panelTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: C.azul,
    letterSpacing: -0.4,
  },
  panelSub: {
    fontSize: 14.5,
    color: C.textoSuave,
    marginTop: 2,
    marginBottom: E.lg,
  },

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
    borderWidth: 1,
    borderColor: C.bordeFuerte,
    backgroundColor: C.blanco,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: E.sm,
  },
  crearTexto: { color: C.azul, fontWeight: '600', fontSize: 15.5 },

  garantias: { marginTop: E.xl + E.sm, gap: E.lg, marginBottom: E.xl },
  garantia: { flexDirection: 'row', alignItems: 'center', gap: E.md },
  garantiaAro: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,235,225,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242,235,225,0.14)',
  },
  garantiaTitulo: { color: C.sobreOscuro, fontSize: 15, fontWeight: '600' },
  garantiaTexto: {
    color: C.sobreOscuroSuave,
    fontSize: 13.5,
    marginTop: 1,
  },
});
