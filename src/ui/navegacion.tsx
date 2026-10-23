import type { Ionicons } from '@expo/vector-icons';
import { Redirect, router, usePathname, type Href } from 'expo-router';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import type { Perfil } from '@/lib/tipos';
import { Cargando } from './componentes';
import { C } from './tema';

/**
 * Vuelve a la pantalla anterior, o a `respaldo` si no hay historial: en la
 * web pasa al abrir un enlace directo, un aviso o recargar la página, y sin
 * esto el botón «Volver» no hacía nada y la persona quedaba atrapada.
 */
export function volver(respaldo: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(respaldo);
}

type Icono = keyof typeof Ionicons.glyphMap;

/**
 * Qué hace «Publicar» según el estado de la cuenta. Antes había tres botones
 * de publicar (Mis pedidos, barra lateral, Perfil) y cada uno decidía distinto
 * para una cuenta en revisión, rechazada o suspendida.
 */
export function accesoPublicar(perfil: Perfil | null): {
  etiqueta: string;
  detalle: string;
  icono: Icono;
  destino: Href | null;
} {
  if (perfil?.suspendido) {
    return {
      etiqueta: 'Cuenta suspendida',
      detalle: 'No puedes publicar mientras esté suspendida',
      icono: 'ban',
      destino: null,
    };
  }
  switch (perfil?.verificacion) {
    case 'verificado':
      return { etiqueta: 'Publicar pedido', detalle: 'Pide algo del extranjero', icono: 'add-circle', destino: '/publicar' };
    case 'en_revision':
      return {
        etiqueta: 'Verificación en revisión',
        detalle: 'Podrás publicar cuando se apruebe',
        icono: 'hourglass-outline',
        destino: '/verificacion',
      };
    case 'rechazado':
      return {
        etiqueta: 'Volver a verificarme',
        detalle: 'Tu verificación fue rechazada',
        icono: 'refresh',
        destino: '/verificacion',
      };
    default:
      return {
        etiqueta: 'Verificar mi identidad',
        detalle: 'Necesario para publicar',
        icono: 'shield-checkmark',
        destino: '/verificacion',
      };
  }
}

/**
 * Protege una pantalla que vive fuera de las pestañas (pedido, publicar,
 * verificación, reputación). Sin sesión, los datos vienen vacíos por RLS y la
 * pantalla decía «No encontramos este pedido»; ahora lleva a ingresar y, al
 * entrar, vuelve a la misma pantalla.
 */
export function conSesion<P extends object>(Pantalla: ComponentType<P>) {
  function Protegida(props: P) {
    const { sesion, cargando } = useAuth();
    const ruta = usePathname();
    if (cargando) {
      return (
        <View style={{ flex: 1, backgroundColor: C.fondo }}>
          <Cargando />
        </View>
      );
    }
    if (!sesion) return <Redirect href={{ pathname: '/entrar', params: { volver: ruta } }} />;
    return <Pantalla {...props} />;
  }
  Protegida.displayName = `conSesion(${Pantalla.displayName ?? Pantalla.name ?? 'Pantalla'})`;
  return Protegida;
}
