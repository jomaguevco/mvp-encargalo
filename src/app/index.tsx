import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { Cargando } from '@/ui/componentes';
import { C } from '@/ui/tema';

export default function Entrada() {
  const { sesion, cargando, esAdmin, recuperacion, errorRecuperacion } = useAuth();

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fondo, justifyContent: 'center' }}>
        <Cargando texto="Abriendo Encárgalo…" />
      </View>
    );
  }

  // Volvió del correo de recuperación a la raíz (la URL del sitio en Supabase):
  // primero la contraseña nueva.
  if (recuperacion || errorRecuperacion) return <Redirect href="/recuperar-clave" />;

  // El administrador aterriza en su panel; desde ahí puede ir a la app.
  return <Redirect href={!sesion ? '/entrar' : esAdmin ? '/admin' : '/(app)/pedidos'} />;
}
