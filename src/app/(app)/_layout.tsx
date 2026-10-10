import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/ui/Texto';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/ctx/auth';
import { BarraLateral } from '@/ui/BarraLateral';
import { Cargando } from '@/ui/componentes';
import { useEscritorio } from '@/ui/escritorio';
import { C, E, F } from '@/ui/tema';

/**
 * Icono de una pestaña.
 *
 * Antes eran letras dentro de un círculo —«P», «O», «E», «A», «=», «Y»— para
 * no añadir una librería de iconos. El ahorro no valía lo que costaba: «=»
 * para la consola del equipo y «Y» para el perfil no significan nada, y una
 * barra inferior con seis letras sueltas es lo primero que hace que una
 * aplicación parezca sin terminar.
 *
 * Los iconos dicen además de qué va el negocio: el avión es «lo que estoy
 * trayendo» y el escudo es el equipo que custodia el dinero.
 */
function Icono({
  nombre,
  activo,
  globo,
}: {
  nombre: keyof typeof Ionicons.glyphMap;
  activo: boolean;
  globo?: number;
}) {
  return (
    <View
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        // La píldora detrás del icono activo: se lee de un vistazo en qué
        // pestaña estás, sin depender solo del color.
        backgroundColor: activo ? C.naranjaClaro : 'transparent',
      }}>
      <Ionicons name={nombre} size={22} color={activo ? C.naranja : C.textoSuave} />

      {!!globo && globo > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: 4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: C.rojo,
            alignItems: 'center',
            justifyContent: 'center',
            // Un aro del color de la barra separa el globo del icono cuando
            // los dos quedan encima.
            borderWidth: 2,
            borderColor: C.blanco,
          }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: C.blanco }}>
            {globo > 9 ? '9+' : globo}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Los dos estados de un icono de Ionicons: contorno y relleno. */
const par = (base: string) =>
  ({
    apagado: `${base}-outline`,
    encendido: base,
  }) as {
    apagado: keyof typeof Ionicons.glyphMap;
    encendido: keyof typeof Ionicons.glyphMap;
  };

const ICONOS = {
  pedidos: par('cube'),
  explorar: par('compass'),
  entregas: par('airplane'),
  avisos: par('notifications'),
  operador: par('shield-checkmark'),
  perfil: par('person-circle'),
};

export default function AppLayout() {
  const { sesion, cargando, esOperador, avisosPendientes } = useAuth();
  // Con la navegación por gestos de Android la barra del sistema queda encima:
  // la altura de la barra de pestañas tiene que sumarla.
  const insets = useSafeAreaInsets();
  // En un navegador ancho: barra lateral y contenido centrado (ui/escritorio).
  const { es: escritorio, margenPestana } = useEscritorio();

  if (cargando) return <Cargando texto="Cargando…" />;
  if (!sesion) return <Redirect href="/entrar" />;

  return (
    <Tabs
      tabBar={escritorio ? (props) => <BarraLateral {...props} iconos={ICONOS} /> : undefined}
      screenOptions={{
        tabBarPosition: escritorio ? 'left' : 'bottom',
        // Cada pestaña dibuja su propia cabecera en Monte (ui/componentes →
        // Cabecera), con cifras y acciones; la barra de navegación quedaba
        // corta para eso.
        headerShown: false,
        tabBarActiveTintColor: C.naranja,
        tabBarInactiveTintColor: C.textoSuave,
        tabBarStyle: {
          backgroundColor: C.blanco,
          borderTopColor: C.borde,
          borderTopWidth: 1,
          height: 66 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: F.cuerpo600,
          marginBottom: 6,
          marginTop: 2,
        },
        sceneStyle: escritorio
          ? {
              backgroundColor: C.fondo,
              paddingHorizontal: margenPestana,
              paddingTop: E.xl,
            }
          : { backgroundColor: C.fondo },
      }}>
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          headerTitle: 'Mis pedidos',
          tabBarIcon: ({ focused }) => (
            <Icono
              nombre={focused ? ICONOS.pedidos.encendido : ICONOS.pedidos.apagado}
              activo={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explorar"
        options={{
          title: 'Ofertar',
          headerTitle: 'Pedidos abiertos',
          tabBarIcon: ({ focused }) => (
            <Icono
              nombre={focused ? ICONOS.explorar.encendido : ICONOS.explorar.apagado}
              activo={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="entregas"
        options={{
          title: 'Entregas',
          headerTitle: 'Lo que estoy trayendo',
          tabBarIcon: ({ focused }) => (
            <Icono
              nombre={focused ? ICONOS.entregas.encendido : ICONOS.entregas.apagado}
              activo={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Avisos',
          headerTitle: 'Avisos',
          tabBarIcon: ({ focused }) => (
            <Icono
              nombre={focused ? ICONOS.avisos.encendido : ICONOS.avisos.apagado}
              activo={focused}
              globo={avisosPendientes}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="operador"
        options={{
          title: 'Equipo',
          headerTitle: 'Consola del equipo',
          href: esOperador ? '/(app)/operador' : null,
          tabBarIcon: ({ focused }) => (
            <Icono
              nombre={focused ? ICONOS.operador.encendido : ICONOS.operador.apagado}
              activo={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          headerTitle: 'Mi perfil',
          tabBarIcon: ({ focused }) => (
            <Icono
              nombre={focused ? ICONOS.perfil.encendido : ICONOS.perfil.apagado}
              activo={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
