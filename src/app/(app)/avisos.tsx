import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/ctx/auth';
import { marcarAvisosLeidos, misAvisos } from '@/lib/api';
import { TIPO_AVISO, hace } from '@/lib/negocio';
import type { Aviso } from '@/lib/tipos';
import { Cabecera, Cargando, Entrada, Vacio } from '@/ui/componentes';
import { ICONO_AVISO } from '@/ui/iconos';
import { C, E, R, sombra } from '@/ui/tema';

/** «Hoy», «Ayer», «Esta semana», «Antes». */
function grupoDe(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.floor((hoy.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return 'Esta semana';
  return 'Antes';
}

/**
 * Bandeja de avisos. Los crean los triggers de la base de datos sobre los
 * mismos hechos que ya registra la bitácora, así que lo que se ve aquí es
 * exactamente lo que pasó con el pedido y con el dinero, no un resumen que
 * la app arme por su cuenta.
 */
export default function Avisos() {
  const { refrescarAvisos } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setAvisos(await misAvisos());
    } catch {
      setAvisos([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (avisos === null) return <Cargando texto="Cargando tus avisos…" />;

  const sinLeer = avisos.filter((a) => !a.leido).length;

  async function marcarTodo() {
    await marcarAvisosLeidos();
    await Promise.all([cargar(), refrescarAvisos()]);
  }

  async function abrir(aviso: Aviso) {
    if (!aviso.leido) {
      await marcarAvisosLeidos([aviso.id]);
      setAvisos((prev) =>
        (prev ?? []).map((a) => (a.id === aviso.id ? { ...a, leido: true } : a)),
      );
      refrescarAvisos();
    }
    if (aviso.pedido_id) router.push(`/pedido/${aviso.pedido_id}`);
  }

  const secciones: { title: string; data: Aviso[] }[] = [];
  for (const a of avisos) {
    const g = grupoDe(a.creado_en);
    const ultima = secciones[secciones.length - 1];
    if (ultima?.title === g) ultima.data.push(a);
    else secciones.push({ title: g, data: [a] });
  }

  return (
    <SectionList
      style={{ backgroundColor: C.fondo }}
      sections={secciones}
      keyExtractor={(a) => String(a.id)}
      contentContainerStyle={{ paddingBottom: E.xxl }}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={async () => {
            setRefrescando(true);
            await Promise.all([cargar(), refrescarAvisos()]);
            setRefrescando(false);
          }}
        />
      }
      ListHeaderComponent={
        <Cabecera
          titulo="Avisos"
          subtitulo={
            sinLeer > 0
              ? `Tienes ${sinLeer} aviso${sinLeer === 1 ? '' : 's'} sin leer`
              : 'Estás al día'
          }
          derecha={
            sinLeer > 0 ? (
              <Pressable onPress={marcarTodo} style={s.marcar} hitSlop={6}>
                <Ionicons name="checkmark-done" size={16} color={C.blanco} />
                <Text style={s.marcarTexto}>Marcar leídos</Text>
              </Pressable>
            ) : (
              <View style={s.campana}>
                <Ionicons name="notifications" size={24} color={C.blanco} />
              </View>
            )
          }
        />
      }
      renderSectionHeader={({ section }) => (
        <Text style={s.grupo}>{section.title}</Text>
      )}
      renderItem={({ item, index }) => {
        const t = TIPO_AVISO[item.tipo] ?? { etiqueta: 'Aviso', color: C.azulMedio };
        return (
          <Entrada i={index} style={{ paddingHorizontal: E.lg }}>
            <Pressable
              onPress={() => abrir(item)}
              style={({ pressed }) => [
                s.aviso,
                !item.leido && s.avisoNuevo,
                pressed && { opacity: 0.85 },
              ]}>
              <View style={[s.icono, { backgroundColor: `${t.color}18` }]}>
                <Ionicons
                  name={ICONO_AVISO[item.tipo] ?? 'notifications'}
                  size={20}
                  color={t.color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.filaTitulo}>
                  <Text style={[s.tipo, { color: t.color }]}>{t.etiqueta}</Text>
                  <Text style={s.hace}>{hace(item.creado_en)}</Text>
                </View>
                <Text style={[s.titulo, !item.leido && { fontWeight: '800' }]}>
                  {item.titulo}
                </Text>
                {!!item.cuerpo && (
                  <Text style={s.cuerpo} numberOfLines={3}>
                    {item.cuerpo}
                  </Text>
                )}
                {!!item.pedido_id && (
                  <View style={s.ver}>
                    <Text style={s.verTexto}>Ver el pedido</Text>
                    <Ionicons name="chevron-forward" size={14} color={C.naranja} />
                  </View>
                )}
              </View>
              {!item.leido && <View style={s.punto} />}
            </Pressable>
          </Entrada>
        );
      }}
      ListEmptyComponent={
        <Vacio
          icono="notifications-off-outline"
          titulo="No tienes avisos"
          detalle="Aquí aparecerán las ofertas que recibas, cada movimiento del dinero y los mensajes de tus pedidos."
        />
      }
    />
  );
}

const s = StyleSheet.create({
  marcar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: E.md,
    paddingVertical: E.sm,
    borderRadius: 999,
  },
  marcarTexto: { color: C.blanco, fontWeight: '800', fontSize: 13 },
  campana: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grupo: {
    fontSize: 12.5,
    fontWeight: '800',
    color: C.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: E.lg,
    marginTop: E.lg,
    marginBottom: E.sm,
  },
  aviso: {
    flexDirection: 'row',
    gap: E.md,
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    padding: E.md + 2,
    marginBottom: E.sm,
    borderWidth: 1,
    borderColor: C.borde,
  },
  avisoNuevo: { borderColor: `${C.naranja}55`, ...sombra(2) },
  icono: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', gap: E.sm },
  tipo: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  hace: { fontSize: 12, color: C.textoSuave },
  titulo: { fontSize: 15, fontWeight: '700', color: C.texto, marginTop: 3, lineHeight: 20 },
  cuerpo: { fontSize: 13.5, color: C.textoSuave, marginTop: 3, lineHeight: 19 },
  ver: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: E.sm },
  verTexto: { fontSize: 13, fontWeight: '800', color: C.naranja },
  punto: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.naranja,
    marginTop: 4,
  },
});
