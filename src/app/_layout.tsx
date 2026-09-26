import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/ctx/auth';
import { C } from '@/ui/tema';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.azul },
          headerTintColor: C.blanco,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: C.fondo },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
        <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="verificacion" options={{ title: 'Verificar identidad' }} />
        <Stack.Screen name="publicar" options={{ title: 'Nuevo pedido' }} />
        <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
        <Stack.Screen name="reputacion/[id]" options={{ title: 'Reputación' }} />
      </Stack>
    </AuthProvider>
  );
}
