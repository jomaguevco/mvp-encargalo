import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { pedidosAbiertos } from '@/lib/api';
import type { Pedido } from '@/lib/tipos';
import { Aviso, Boton, Cargando, Vacio } from '@/ui/componentes';
import { PedidoCard } from '@/ui/PedidoCard';
import { E } from '@/ui/tema';

export default function Explorar() {
  const { perfil, verificado } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    if (!verificado) {
      setPedidos([]);
      return;
    }
    try {
      setPedidos(await pedidosAbiertos());
    } catch {
      setPedidos([]);
    }
  }, [verificado]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (pedidos === null) return <Cargando texto="Buscando pedidos abiertos…" />;

  if (!verificado) {
    return (
      <View style={{ padding: E.lg }}>
        <Aviso tono="alerta" titulo="Verifica tu identidad">
          Para ver los pedidos abiertos y enviar ofertas necesitas validar tu DNI. Es la
          garantía que le damos al cliente de que sabe quién le va a traer su producto.
        </Aviso>
        <Boton titulo="Verificar mi identidad" onPress={() => router.push('/verificacion')} />
      </View>
    );
  }

  if (!perfil?.es_comprador) {
    return (
      <View style={{ padding: E.lg }}>
        <Aviso tono="info" titulo="Activa tu cuenta como comprador externo">
          Si viajas al extranjero o traes productos con frecuencia, puedes ganar dinero
          con el espacio de tu maleta. Actívalo desde tu perfil.
        </Aviso>
        <Boton
          titulo="Ir a mi perfil"
          variante="secundario"
          onPress={() => router.push('/(app)/perfil')}
        />
      </View>
    );
  }

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
      renderItem={({ item }) => <PedidoCard pedido={item} pie="Ver y ofertar" />}
      ListEmptyComponent={
        <Vacio
          titulo="No hay pedidos abiertos ahora"
          detalle="Cuando alguien publique un encargo aparecerá aquí. Desliza hacia abajo para actualizar."
        />
      }
    />
  );
}
