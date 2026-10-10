import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/ctx/auth';
import { useEscritorio } from '@/ui/escritorio';
import { C, E } from '@/ui/tema';

export default function RootLayout() {
  // En un navegador ancho, los formularios y el detalle del pedido se centran
  // con un ancho de lectura cómodo (ui/escritorio). En el teléfono, margen 0.
  const { es: escritorio, margenFormulario } = useEscritorio();
  const contenido = escritorio
    ? { backgroundColor: C.fondo, paddingHorizontal: margenFormulario, paddingTop: E.lg }
    : { backgroundColor: C.fondo };
  const sinMargen = { contentStyle: { backgroundColor: C.fondo } };

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.azul },
          headerTintColor: C.blanco,
          headerTitleStyle: { fontWeight: '800', fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: contenido,
        }}>
        <Stack.Screen name="index" options={{ headerShown: false, ...sinMargen }} />
        <Stack.Screen name="entrar" options={{ headerShown: false, ...sinMargen }} />
        <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
        <Stack.Screen name="legal" options={{ title: 'Términos y privacidad' }} />
        <Stack.Screen name="(app)" options={{ headerShown: false, ...sinMargen }} />
        <Stack.Screen name="verificacion" options={{ title: 'Verificar identidad' }} />
        <Stack.Screen name="publicar" options={{ title: 'Nuevo pedido' }} />
        <Stack.Screen name="pedido/[id]" options={{ title: 'Pedido' }} />
        <Stack.Screen name="reputacion/[id]" options={{ title: 'Reputación' }} />
      </Stack>
    </AuthProvider>
  );
}
