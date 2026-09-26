import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { marcarAvisosLeidos, misAvisos } from '@/lib/api';
import { TIPO_AVISO, hace } from '@/lib/negocio';
import type { Aviso } from '@/lib/tipos';
import { Boton, Cargando, Chip, Micro, Parrafo, Tarjeta, Vacio } from '@/ui/componentes';
import { C, E } from '@/ui/tema';

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

  return (
    <FlatList
      data={avisos}
      keyExtractor={(a) => String(a.id)}
      contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}
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
        sinLeer > 0 ? (
          <View style={{ marginBottom: E.md }}>
            <Boton
              titulo={`Marcar los ${sinLeer} como leídos`}
              variante="fantasma"
              onPress={marcarTodo}
            />
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const t = TIPO_AVISO[item.tipo] ?? { etiqueta: 'Aviso', color: C.azulMedio };
        return (
          <Tarjeta
            onPress={() => abrir(item)}
            style={
              item.leido
                ? undefined
                : { borderColor: t.color, borderWidth: 1.5, backgroundColor: C.blanco }
            }>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: E.sm,
              }}>
              <Chip texto={t.etiqueta} color={t.color} />
              <Micro>{hace(item.creado_en)}</Micro>
            </View>
            <Parrafo style={{ fontWeight: '700', marginTop: E.sm }}>
              {item.titulo}
            </Parrafo>
            {!!item.cuerpo && (
              <Parrafo suave style={{ marginTop: E.xs }}>
                {item.cuerpo}
              </Parrafo>
            )}
            {!!item.pedido_id && (
              <Micro style={{ color: C.azul, fontWeight: '700', marginTop: E.sm }}>
                Ver el pedido
              </Micro>
            )}
          </Tarjeta>
        );
      }}
      ListEmptyComponent={
        <Vacio
          titulo="No tienes avisos"
          detalle="Aquí aparecerán las ofertas que recibas, cada movimiento del dinero y los mensajes de tus pedidos."
        />
      }
    />
  );
}
