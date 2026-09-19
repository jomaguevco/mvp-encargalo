import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { misPedidos } from '@/lib/api';
import { ESTADO_VERIFICACION } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import { Aviso, Boton, Cargando, Vacio } from '@/ui/componentes';
import { PedidoCard } from '@/ui/PedidoCard';
import { E } from '@/ui/tema';

export default function MisPedidos() {
  const { perfil, verificado, refrescarPerfil } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await misPedidos());
    } catch {
      setPedidos([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refrescarPerfil();
      cargar();
    }, [cargar, refrescarPerfil]),
  );

  async function refrescar() {
    setRefrescando(true);
    await Promise.all([cargar(), refrescarPerfil()]);
    setRefrescando(false);
  }

  if (pedidos === null) return <Cargando texto="Cargando tus pedidos…" />;

  const v = perfil ? ESTADO_VERIFICACION[perfil.verificacion] : null;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: E.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} />
        }
        ListHeaderComponent={
          !verificado && v ? (
            <Aviso
              tono={perfil?.verificacion === 'rechazado' ? 'error' : 'alerta'}
              titulo={v.etiqueta}>
              {v.detalle}
              {perfil?.verificacion === 'rechazado' && perfil.motivo_rechazo
                ? `\n\nMotivo: ${perfil.motivo_rechazo}`
                : ''}
            </Aviso>
          ) : null
        }
        renderItem={({ item }) => <PedidoCard pedido={item} />}
        ListEmptyComponent={
          <Vacio
            titulo="Todavía no has pedido nada"
            detalle="Publica lo que quieres traer del extranjero y deja que los compradores externos verificados compitan por tu pedido."
          />
        }
      />

      <View style={{ position: 'absolute', left: E.lg, right: E.lg, bottom: E.lg }}>
        <Boton
          titulo={
            verificado ? 'Publicar un pedido' : 'Verifica tu identidad para publicar'
          }
          onPress={() =>
            router.push(verificado ? '/publicar' : '/verificacion')
          }
        />
      </View>
    </View>
  );
}
