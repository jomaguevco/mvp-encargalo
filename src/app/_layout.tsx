import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { AuthProvider } from '@/ctx/auth';
import { C } from '@/ui/tema';

/**
 * En el navegador la aplicación se muestra como una columna del ancho de un
 * teléfono, centrada sobre el azul de la marca. Las pantallas están pensadas
 * para móvil: estiradas a 1 400 px los formularios y las tarjetas se ven
 * vacíos. En Android y iOS esto no cambia nada.
 */
function Marco({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={s.fondo}>
      <View style={s.columna}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Marco>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C.azul },
            headerTintColor: C.blanco,
            headerTitleStyle: { fontWeight: '800', fontSize: 17 },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: C.fondo },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="entrar" options={{ headerShown: false }} />
          <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
          <Stack.Screen name="legal" options={{ title: 'Términos y privacidad' }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="verificacion" options={{ title: 'Verificar identidad' }} />
          <Stack.Screen name="publicar" options={{ title: 'Nuevo pedido' }} />
          <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
          <Stack.Screen name="reputacion/[id]" options={{ title: 'Reputación' }} />
        </Stack>
      </Marco>
    </AuthProvider>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#0A223B', alignItems: 'center' },
  columna: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
    backgroundColor: C.fondo,
    boxShadow: '0 0 60px rgba(0,0,0,0.35)',
  },
});
