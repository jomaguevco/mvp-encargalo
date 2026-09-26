import { Redirect, Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { Cargando } from '@/ui/componentes';
import { C } from '@/ui/tema';

/** Punto de una pestaña. Sin librería de iconos: menos peso y cero dependencias. */
function Punto({
  activo,
  letra,
  globo,
}: {
  activo: boolean;
  letra: string;
  globo?: number;
}) {
  return (
    <View>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: activo ? C.naranja : 'transparent',
          borderWidth: activo ? 0 : 1.5,
          borderColor: C.borde,
        }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '800',
            color: activo ? C.blanco : C.textoSuave,
          }}>
          {letra}
        </Text>
      </View>

      {!!globo && globo > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -8,
            minWidth: 17,
            height: 17,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: C.rojo,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: C.blanco }}>
            {globo > 9 ? '9+' : globo}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AppLayout() {
  const { sesion, cargando, esOperador, avisosPendientes } = useAuth();

  if (cargando) return <Cargando texto="Cargando…" />;
  if (!sesion) return <Redirect href="/entrar" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.azul },
        headerTintColor: C.blanco,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: C.naranja,
        tabBarInactiveTintColor: C.textoSuave,
        tabBarStyle: { backgroundColor: C.blanco, borderTopColor: C.borde, height: 60 },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', marginBottom: 6 },
        sceneStyle: { backgroundColor: C.fondo },
      }}>
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Mis pedidos',
          headerTitle: 'Mis pedidos',
          tabBarIcon: ({ focused }) => <Punto activo={focused} letra="P" />,
        }}
      />
      <Tabs.Screen
        name="explorar"
        options={{
          title: 'Ofertar',
          headerTitle: 'Pedidos abiertos',
          tabBarIcon: ({ focused }) => <Punto activo={focused} letra="O" />,
        }}
      />
      <Tabs.Screen
        name="entregas"
        options={{
          title: 'Mis entregas',
          headerTitle: 'Lo que estoy trayendo',
          tabBarIcon: ({ focused }) => <Punto activo={focused} letra="E" />,
        }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Avisos',
          headerTitle: 'Avisos',
          tabBarIcon: ({ focused }) => (
            <Punto activo={focused} letra="A" globo={avisosPendientes} />
          ),
        }}
      />
      <Tabs.Screen
        name="operador"
        options={{
          title: 'Equipo',
          headerTitle: 'Consola del equipo',
          href: esOperador ? '/(app)/operador' : null,
          tabBarIcon: ({ focused }) => <Punto activo={focused} letra="=" />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          headerTitle: 'Mi perfil',
          tabBarIcon: ({ focused }) => <Punto activo={focused} letra="Y" />,
        }}
      />
    </Tabs>
  );
}
