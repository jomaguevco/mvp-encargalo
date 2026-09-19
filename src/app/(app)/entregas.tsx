import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { misEntregas } from '@/lib/api';
import { SIGUIENTE_PASO_COMPRADOR } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import { Cargando, Vacio } from '@/ui/componentes';
import { PedidoCard } from '@/ui/PedidoCard';
import { E } from '@/ui/tema';

export default function Entregas() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await misEntregas());
    } catch {
      setPedidos([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (pedidos === null) return <Cargando texto="Cargando tus entregas…" />;

  return (
    <FlatList
      data={pedidos}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: E.lg }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={async () => {
            setRefrescando(true);
            await cargar();
            setRefrescando(false);
          }}
        />
      }
      renderItem={({ item }) => (
        <PedidoCard
          pedido={item}
          pie={SIGUIENTE_PASO_COMPRADOR[item.estado]?.accion ?? undefined}
        />
      )}
      ListEmptyComponent={
        <Vacio
          titulo="Aún no te han aceptado ninguna oferta"
          detalle="Cuando un cliente acepte tu oferta, el pedido aparecerá aquí y podrás ir marcando el avance hasta la entrega."
        />
      }
    />
  );
}
