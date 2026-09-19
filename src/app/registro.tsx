import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { Aviso, Boton, Campo, Parrafo, Subtitulo } from '@/ui/componentes';
import { E } from '@/ui/tema';

export default function Registro() {
  const { registrar, entrar } = useAuth();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function validar(): string | null {
    if (nombre.trim().length < 5) return 'Escribe tu nombre y apellidos completos';
    if (!/^9\d{8}$/.test(telefono.trim()))
      return 'El celular debe tener 9 dígitos y empezar en 9';
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) return 'Revisa tu correo electrónico';
    if (clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    return null;
  }

  async function enviar() {
    const problema = validar();
    setError(problema);
    if (problema) return;

    setCargando(true);
    try {
      await registrar({ correo, clave, nombre, telefono });
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

        <Boton titulo="Crear cuenta" onPress={enviar} cargando={cargando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
