import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { ORIGENES, VERSION_TERMINOS } from '@/lib/negocio';
import { Aviso, Boton, Campo, Opciones, Parrafo, Subtitulo } from '@/ui/componentes';
import { C, E } from '@/ui/tema';

type Origen = (typeof ORIGENES)[number]['valor'];

export default function Registro() {
  const { registrar, entrar } = useAuth();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [origen, setOrigen] = useState<Origen | null>(null);
  const [codigo, setCodigo] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function validar(): string | null {
    if (nombre.trim().length < 5) return 'Escribe tu nombre y apellidos completos';
    if (!/^9\d{8}$/.test(telefono.trim()))
      return 'El celular debe tener 9 dígitos y empezar en 9';
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) return 'Revisa tu correo electrónico';
    if (clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!origen) return 'Cuéntanos cómo conociste Encárgalo';
    if (codigo.trim() && !/^[0-9A-Fa-f]{6}$/.test(codigo.trim()))
      return 'El código de quien te invitó tiene 6 caracteres, como A1B2C3';
    if (!acepto) return 'Para crear la cuenta tienes que aceptar los términos y la política de privacidad';
    return null;
  }

  async function enviar() {
    const problema = validar();
    setError(problema);
    if (problema) return;

    setCargando(true);
    try {
      await registrar({
        correo,
        clave,
        nombre,
        telefono,
        origen: origen as string,
        codigoReferido: codigo,
        versionTerminos: VERSION_TERMINOS,
      });
      // Si el proyecto no exige confirmación por correo, la sesión ya queda abierta.
      try {
        await entrar(correo, clave);
      } catch {
        /* el proyecto pide confirmar el correo: se maneja abajo */
      }
      router.replace('/(app)/pedidos');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: E.xl }}
        keyboardShouldPersistTaps="handled">
        <Subtitulo>Crea tu cuenta</Subtitulo>
        <Parrafo suave style={{ marginBottom: E.xl }}>
          Después de registrarte tendrás que verificar tu identidad con tu DNI. Sin esa
          verificación nadie puede publicar pedidos ni ofertar: es lo que hace que el
          resto confíe en ti.
        </Parrafo>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        <Campo
          etiqueta="Nombre y apellidos"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Como figura en tu DNI"
          autoComplete="name"
        />
        <Campo
          etiqueta="Celular"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="number-pad"
          maxLength={9}
          placeholder="9XXXXXXXX"
          ayuda="Lo usamos solo para avisarte de tus pedidos"
        />
        <Campo
          etiqueta="Correo electrónico"
          value={correo}
          onChangeText={setCorreo}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="tucorreo@ejemplo.com"
        />
        <Campo
          etiqueta="Contraseña"
          value={clave}
          onChangeText={setClave}
          secureTextEntry
          ayuda="Mínimo 8 caracteres"
        />

        <View style={{ marginBottom: E.lg }}>
          <Parrafo style={{ fontWeight: '700', fontSize: 13, marginBottom: E.sm }}>
            ¿Cómo conociste Encárgalo?
          </Parrafo>
          <Opciones
            valor={origen}
            onChange={setOrigen}
            opciones={ORIGENES.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
          />
        </View>

        <Campo
          etiqueta="Código de quien te invitó"
          value={codigo}
          onChangeText={setCodigo}
          autoCapitalize="characters"
          maxLength={6}
          placeholder="Opcional"
          ayuda="Si alguien te recomendó Encárgalo, los dos reciben un descuento en su primer pedido"
        />

        <Pressable
          onPress={() => setAcepto((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acepto }}
          style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: E.lg }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: acepto ? C.verde : C.borde,
              backgroundColor: acepto ? C.verde : C.blanco,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: E.sm,
              marginTop: 1,
            }}>
            {acepto && <Text style={{ color: C.blanco, fontWeight: '800' }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, color: C.texto, fontSize: 14, lineHeight: 21 }}>
            Acepto los{' '}
            <Link href="/legal" style={{ color: C.azul, fontWeight: '700' }}>
              términos y condiciones y la política de privacidad
            </Link>
            , incluido que Encárgalo retiene mi pago hasta que confirme la recepción y
            que trata mi DNI solo para verificar mi identidad.
          </Text>
        </Pressable>

        <Boton titulo="Crear cuenta" onPress={enviar} cargando={cargando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
