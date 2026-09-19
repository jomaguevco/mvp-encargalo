import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { Cargando } from '@/ui/componentes';
import { C } from '@/ui/tema';

export default function Entrada() {
  const { sesion, cargando } = useAuth();

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fondo, justifyContent: 'center' }}>
        <Cargando texto="Abriendo Encárgalo…" />
      </View>
    );
  }

  return <Redirect href={sesion ? '/(app)/pedidos' : '/entrar'} />;
}
