import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Slot, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import * as api from '@/lib/api';
import { Cargando, Vacio } from '@/ui/componentes';
import { useEscritorio, ANCHO_LATERAL } from '@/ui/escritorio';
import { Logo } from '@/ui/Logo';
import { Text } from '@/ui/Texto';
import { C, E, R } from '@/ui/tema';

type Icono = keyof typeof Ionicons.glyphMap;

/** Las secciones del panel, en el orden en que se usan en el día a día. */
const SECCIONES: { ruta: string; titulo: string; icono: Icono; cola?: 'identidad' | 'operacion' }[] = [
  { ruta: '/admin', titulo: 'Resumen', icono: 'stats-chart' },
  { ruta: '/admin/verificaciones', titulo: 'Verificaciones', icono: 'id-card', cola: 'identidad' },
  { ruta: '/admin/cuentas', titulo: 'Cuentas', icono: 'people' },
  { ruta: '/admin/pedidos', titulo: 'Pedidos', icono: 'cube' },
  { ruta: '/admin/pagos', titulo: 'Pagos', icono: 'wallet' },
  { ruta: '/admin/operacion', titulo: 'Operación', icono: 'shield-checkmark', cola: 'operacion' },
  { ruta: '/admin/equipo', titulo: 'Equipo y roles', icono: 'key' },
  { ruta: '/admin/configuracion', titulo: 'Configuración', icono: 'settings' },
  { ruta: '/admin/bitacora', titulo: 'Bitácora', icono: 'document-text' },
];

/**
 * Panel de administración (/admin).
 *
 * Solo entra quien está en la tabla `administradores`. La pantalla no es la
 * barrera: cada función admin_* de la base vuelve a comprobarlo, así que un
 * usuario que forzara la ruta vería solo errores.
 */
export default function AdminLayout() {
  const { cargando, sesion, esAdmin, perfil, salir } = useAuth();
  const { es: escritorio } = useEscritorio();
  const ruta = usePathname();
  // El permiso llega un instante después de la sesión: se confirma aquí para
  // no mostrar «sin permiso» a un administrador que acaba de entrar.
  const [confirmado, setConfirmado] = useState<boolean | null>(null);
  const [colas, setColas] = useState({ identidad: 0, operacion: 0 });

  useEffect(() => {
    if (!sesion) return;
    if (esAdmin) {
      setConfirmado(true);
      return;
    }
    api.soyAdmin().then(setConfirmado).catch(() => setConfirmado(false));
  }, [sesion, esAdmin]);

  // Globos de pendientes en la barra: se refrescan al cambiar de sección.
  useEffect(() => {
    if (!confirmado) return;
    Promise.allSettled([
      api.pendientesVerificacion(),
      api.pendientesPago(),
      api.disputasAbiertas(),
      api.confirmacionesVencidas(),
    ]).then((r) => {
      const n = (i: number) => (r[i].status === 'fulfilled' ? (r[i] as PromiseFulfilledResult<unknown[]>).value.length : 0);
      setColas({ identidad: n(0), operacion: n(1) + n(2) + n(3) });
    });
  }, [confirmado, ruta]);

  if (cargando) return <Cargando texto="Abriendo el panel…" />;
  if (!sesion) return <Redirect href="/entrar" />;
  if (confirmado === null) return <Cargando texto="Comprobando permisos…" />;

  if (!confirmado) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fondo, justifyContent: 'center', padding: E.xl }}>
        <Vacio
          icono="lock-closed-outline"
          titulo="Esta sección es solo para administradores"
          detalle="Tu cuenta no tiene permiso para el panel de administración."
          accion="Volver a Encárgalo"
          onAccion={() => router.replace('/(app)/pedidos')}
        />
      </View>
    );
  }

  const activa = (r: string) => (r === '/admin' ? ruta === '/admin' : ruta.startsWith(r));

  const items = SECCIONES.map((sec) => {
    const on = activa(sec.ruta);
    const globo = sec.cola ? colas[sec.cola] : 0;
    return (
      <Pressable
        key={sec.ruta}
        accessibilityRole="link"
        accessibilityState={{ selected: on }}
        onPress={() => router.push(sec.ruta as never)}
        style={({ hovered }: { hovered?: boolean }) => [
          escritorio ? s.item : s.itemChico,
          on ? s.itemActivo : hovered && s.itemEncima,
        ]}>
        <Ionicons
          name={(on ? sec.icono : `${sec.icono}-outline`) as Icono}
          size={escritorio ? 19 : 17}
          color={on ? C.trigo : C.sobreOscuroSuave}
        />
        <Text style={[s.itemTexto, on && s.itemTextoActivo]}>{sec.titulo}</Text>
        {globo > 0 && (
          <View style={s.globo}>
            <Text style={s.globoTexto}>{globo > 99 ? '99+' : globo}</Text>
          </View>
        )}
      </Pressable>
    );
  });

  if (!escritorio) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fondo }}>
        <View style={s.superior}>
          <View style={s.superiorFila}>
            <Logo tamano={26} oscuro />
            <Text style={s.superiorTitulo}>Administración</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={salir} hitSlop={8} accessibilityLabel="Cerrar sesión">
              <Ionicons name="log-out-outline" size={20} color={C.sobreOscuro} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: E.xs, paddingHorizontal: E.md }}>
            {items}
          </ScrollView>
        </View>
        <Slot />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.fondo }}>
      <View style={s.lateral}>
        <View style={s.marca}>
          <Logo tamano={32} oscuro />
        </View>
        <View style={s.rol}>
          <Ionicons name="shield-checkmark" size={14} color={C.trigo} />
          <Text style={s.rolTexto}>Panel de administración</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2 }}>
          {items}
        </ScrollView>

        <View style={s.pie}>
          <Pressable
            onPress={() => perfil && router.push(`/admin/cuenta/${perfil.id}`)}
            accessibilityRole="link"
            accessibilityLabel="Mi cuenta en el panel"
            style={({ hovered }: { hovered?: boolean }) => [s.yo, hovered && s.itemEncima]}>
            <Ionicons name="person-circle-outline" size={20} color={C.sobreOscuroSuave} />
            <View style={{ flex: 1 }}>
              <Text style={s.pieNombre} numberOfLines={1}>
                {perfil?.nombre_completo || 'Administración'}
              </Text>
              <Text style={s.pieRol}>Administrador</Text>
            </View>
          </Pressable>
          <Pressable onPress={salir} style={s.salir}>
            <Ionicons name="log-out-outline" size={17} color={C.sobreOscuroSuave} />
            <Text style={s.salirTexto}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  lateral: {
    width: ANCHO_LATERAL + 16,
    height: '100%',
    backgroundColor: C.azul,
    paddingHorizontal: E.md,
    paddingTop: E.xl,
    paddingBottom: E.lg,
    gap: E.md,
  },
  marca: { paddingHorizontal: E.sm },
  rol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: E.sm,
    marginBottom: E.sm,
  },
  rolTexto: { fontSize: 12, fontWeight: '700', color: C.trigo, letterSpacing: 0.6, textTransform: 'uppercase' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    paddingHorizontal: E.md,
    height: 42,
    borderRadius: R.md,
  },
  itemChico: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: E.md,
    height: 36,
    borderRadius: 18,
  },
  itemActivo: { backgroundColor: 'rgba(242,235,225,0.12)' },
  itemEncima: { backgroundColor: 'rgba(242,235,225,0.06)' },
  itemTexto: { fontSize: 14.5, fontWeight: '600', color: C.sobreOscuroSuave },
  itemTextoActivo: { color: C.sobreOscuro },
  globo: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: C.naranja,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globoTexto: { fontSize: 11, fontWeight: '700', color: C.blanco },
  pie: { gap: E.sm, borderTopWidth: 1, borderColor: 'rgba(242,235,225,0.12)', paddingTop: E.md },
  pieNombre: { fontSize: 13.5, fontWeight: '700', color: C.sobreOscuro },
  pieRol: { fontSize: 12, color: C.sobreOscuroSuave },
  yo: { flexDirection: 'row', alignItems: 'center', gap: E.sm, padding: E.xs, borderRadius: R.sm },
  salir: { flexDirection: 'row', alignItems: 'center', gap: E.sm, padding: E.xs },
  salirTexto: { fontSize: 13.5, color: C.sobreOscuroSuave },
  superior: { backgroundColor: C.azul, paddingTop: E.lg, paddingBottom: E.sm, gap: E.sm },
  superiorFila: { flexDirection: 'row', alignItems: 'center', gap: E.sm, paddingHorizontal: E.lg },
  superiorTitulo: { fontSize: 17, fontWeight: '800', color: C.sobreOscuro },
});
