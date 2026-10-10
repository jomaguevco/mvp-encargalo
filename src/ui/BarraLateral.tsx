import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/ctx/auth';
import { Avatar } from './componentes';
import { ANCHO_LATERAL } from './escritorio';
import { C, E, R } from './tema';

type Icono = keyof typeof Ionicons.glyphMap;

/**
 * Navegación de la versión web en escritorio: la misma lista de pestañas, de
 * pie a la izquierda, con la marca arriba y la acción principal (publicar un
 * pedido) siempre a mano. Recibe lo mismo que la barra inferior, así que las
 * pestañas, su orden y cuáles se ocultan siguen definidos en (app)/_layout.
 */
export function BarraLateral({
  state,
  descriptors,
  navigation,
  iconos,
}: BottomTabBarProps & {
  iconos: Record<string, { apagado: Icono; encendido: Icono }>;
}) {
  const { perfil, verificado, avisosPendientes } = useAuth();
  const enRevision = perfil?.verificacion === 'en_revision';

  return (
    <View style={s.barra}>
      <LinearGradient
        colors={['#0B2A48', '#0E3255', '#123E6A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Brillo coral de la marca, como en la página pública */}
      <View style={s.brillo} />
      <Pressable
        onPress={() => {
          // Volver a la página pública, fuera de la aplicación.
          if (typeof window !== 'undefined') window.location.href = '/';
        }}
        style={s.marca}
        accessibilityRole="link"
        accessibilityLabel="Ir a la página de Encárgalo">
        <Image source={require('../../assets/images/icon.png')} style={s.logo} />
        <Text style={s.marcaTexto}>Encárgalo</Text>
      </Pressable>

      <Pressable
        // Igual que el botón de Mis pedidos: sin identidad verificada no se publica.
        onPress={() => !enRevision && router.push(verificado ? '/publicar' : '/verificacion')}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          s.publicar,
          (hovered || pressed) && { backgroundColor: '#D95A24' },
        ]}>
        <Ionicons name={verificado ? 'add' : 'shield-checkmark'} size={20} color={C.blanco} />
        <Text style={s.publicarTexto}>
          {verificado
            ? 'Publicar pedido'
            : enRevision
              ? 'Verificación en revisión'
              : 'Verificar identidad'}
        </Text>
      </Pressable>

      <View style={s.lista}>
        {state.routes.map((ruta, i) => {
          const { options } = descriptors[ruta.key];
          // Las pestañas con `href: null` (la consola para quien no es del
          // equipo) llegan con display: 'none'.
          const estilo = StyleSheet.flatten(options.tabBarItemStyle) as
            { display?: string } | undefined;
          if (estilo?.display === 'none') return null;

          const activo = state.index === i;
          const icono = iconos[ruta.name];
          const globo = ruta.name === 'avisos' ? avisosPendientes : 0;

          return (
            <Pressable
              key={ruta.key}
              accessibilityRole="link"
              accessibilityState={{ selected: activo }}
              onPress={() => {
                const evento = navigation.emit({
                  type: 'tabPress',
                  target: ruta.key,
                  canPreventDefault: true,
                });
                if (!activo && !evento.defaultPrevented) navigation.navigate(ruta.name);
              }}
              style={({ hovered }: { hovered?: boolean }) => [
                s.item,
                activo ? s.itemActivo : hovered && s.itemEncima,
              ]}>
              {activo && <View style={s.indicador} />}
              {icono && (
                <Ionicons
                  name={activo ? icono.encendido : icono.apagado}
                  size={20}
                  color={activo ? C.naranja : 'rgba(255,255,255,0.7)'}
                />
              )}
              <Text style={[s.itemTexto, activo && s.itemTextoActivo]}>
                {typeof options.title === 'string' ? options.title : ruta.name}
              </Text>
              {globo > 0 && (
                <View style={s.globo}>
                  <Text style={s.globoTexto}>{globo > 9 ? '9+' : globo}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => router.push('/(app)/perfil')} style={s.usuario}>
        <Avatar
          nombre={perfil?.nombre_completo}
          tamano={36}
          verificado={perfil?.verificacion === 'verificado'}
        />
        <View style={{ flex: 1 }}>
          <Text style={s.usuarioNombre} numberOfLines={1}>
            {perfil?.nombre_completo || 'Mi cuenta'}
          </Text>
          <Text style={s.usuarioEstado} numberOfLines={1}>
            {perfil?.verificacion === 'verificado' ? 'Identidad verificada' : 'Sin verificar'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  barra: {
    width: ANCHO_LATERAL,
    height: '100%',
    backgroundColor: C.azul,
    overflow: 'hidden',
    paddingHorizontal: E.md,
    paddingTop: E.xl,
    paddingBottom: E.lg,
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm + 2,
    paddingHorizontal: E.sm,
  },
  logo: { width: 40, height: 40, borderRadius: 11 },
  marcaTexto: {
    color: C.blanco,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  publicar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: E.xs,
    backgroundColor: C.naranja,
    borderRadius: R.md,
    paddingVertical: E.md,
    marginTop: E.xl,
    marginBottom: E.lg,
  },
  publicarTexto: { color: C.blanco, fontWeight: '800', fontSize: 15 },
  lista: { flex: 1, gap: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    paddingHorizontal: E.md,
    paddingVertical: E.sm + 3,
    borderRadius: R.sm,
  },
  itemEncima: { backgroundColor: 'rgba(255,255,255,0.06)' },
  itemActivo: { backgroundColor: 'rgba(255,255,255,0.12)' },
  indicador: {
    position: 'absolute',
    left: -E.md,
    top: 8,
    bottom: 8,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: C.naranja,
  },
  brillo: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    left: -190,
    bottom: -150,
    backgroundColor: 'rgba(238,108,52,0.18)',
  },
  itemTexto: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  itemTextoActivo: { color: C.blanco, fontWeight: '800' },
  globo: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: C.rojo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globoTexto: { color: C.blanco, fontSize: 11, fontWeight: '800' },
  usuario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm + 2,
    padding: E.sm + 2,
    borderRadius: R.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  usuarioNombre: { color: C.blanco, fontWeight: '700', fontSize: 14 },
  usuarioEstado: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
