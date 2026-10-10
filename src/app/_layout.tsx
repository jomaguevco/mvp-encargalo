import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider } from '@/ctx/auth';
import { useEscritorio } from '@/ui/escritorio';
import { C, E, F } from '@/ui/tema';

// El splash se queda hasta que llegan las fuentes de la marca: sin esto, la
// primera pantalla se dibuja un instante con la letra del sistema y salta.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fuentesListas, errorFuentes] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  // Si las fuentes fallan, la aplicación sigue con la del sistema: es mejor
  // que quedarse en el splash.
  const listo = fuentesListas || !!errorFuentes;
  useEffect(() => {
    if (listo) SplashScreen.hideAsync().catch(() => {});
  }, [listo]);

  // En un navegador ancho, los formularios y el detalle del pedido se centran
  // con un ancho de lectura cómodo (ui/escritorio). En el teléfono, margen 0.
  const { es: escritorio, margenFormulario, margenDetalle } = useEscritorio();
  const contenido = escritorio
    ? { backgroundColor: C.fondo, paddingHorizontal: margenFormulario, paddingTop: E.lg }
    : { backgroundColor: C.fondo };
  const sinMargen = { contentStyle: { backgroundColor: C.fondo } };

  if (!listo) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.azul },
          headerTintColor: C.sobreOscuro,
          headerTitleStyle: { fontFamily: F.titulo700, fontSize: 18 },
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
        <Stack.Screen
          name="pedido/[id]"
          options={{
            title: 'Pedido',
            // Más ancho que un formulario: en escritorio va en dos columnas.
            contentStyle: escritorio
              ? { backgroundColor: C.fondo, paddingHorizontal: margenDetalle, paddingTop: E.lg }
              : { backgroundColor: C.fondo },
          }}
        />
        <Stack.Screen name="reputacion/[id]" options={{ title: 'Reputación' }} />
      </Stack>
    </AuthProvider>
  );
}
