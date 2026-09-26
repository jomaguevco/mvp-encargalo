import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { misEntregas, misOfertasEnviadas } from '@/lib/api';
import {
  ESTADO_OFERTA,
  SIGUIENTE_PASO_COMPRADOR,
  fecha,
  soles,
} from '@/lib/negocio';
import type { OfertaEnviada, Pedido } from '@/lib/tipos';
import {
  Cargando,
  Chip,
  Micro,
  Parrafo,
  Subtitulo,
  Tarjeta,
  Vacio,
} from '@/ui/componentes';
import { PedidoCard } from '@/ui/PedidoCard';
import { E } from '@/ui/tema';

export default function Entregas() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [ofertas, setOfertas] = useState<OfertaEnviada[]>([]);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [pe, of] = await Promise.all([misEntregas(), misOfertasEnviadas()]);
      setPedidos(pe);
      setOfertas(of);
    } catch {
      setPedidos([]);
      setOfertas([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (pedidos === null) return <Cargando texto="Cargando tus entregas…" />;

  // Las ofertas de pedidos que ya me adjudicaron aparecen abajo como entrega:
  // aquí solo van las que todavía esperan respuesta del cliente.
  const adjudicados = new Set(pedidos.map((p) => p.id));
  const esperando = ofertas.filter((o) => !adjudicados.has(o.pedido_id));

  return (
    <ScrollView
      contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={async () => {
            setRefrescando(true);
            await cargar();
            setRefrescando(false);
          }}
        />
      }>
      {esperando.length > 0 && (
        <>
          <Subtitulo>Ofertas esperando respuesta ({esperando.length})</Subtitulo>
          <Parrafo suave style={{ marginBottom: E.md }}>
            El cliente está comparando. Puedes retirarlas desde el pedido mientras nadie
            las acepte.
          </Parrafo>
          {esperando.map((o) => {
            const eo = ESTADO_OFERTA[o.estado_oferta];
            return (
              <Tarjeta
                key={o.oferta_id}
                onPress={() => router.push(`/pedido/${o.pedido_id}`)}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: E.md,
                  }}>
                  <Parrafo style={{ fontWeight: '700', flex: 1 }}>{o.titulo}</Parrafo>
                  <Chip texto={eo.etiqueta} color={eo.color} />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: E.sm,
                  }}>
                  <Micro>{o.categoria}</Micro>
                  <Micro>
                    {soles(o.precio_final)} · entrega {fecha(o.fecha_entrega)}
                  </Micro>
                </View>
              </Tarjeta>
            );
          })}
          <View style={{ height: E.md }} />
        </>
      )}

      {pedidos.length > 0 && (
        <>
          <Subtitulo>Pedidos que estoy trayendo ({pedidos.length})</Subtitulo>
          <View style={{ height: E.sm }} />
          {pedidos.map((p) => (
            <PedidoCard
              key={p.id}
              pedido={p}
              pie={SIGUIENTE_PASO_COMPRADOR[p.estado]?.accion ?? undefined}
            />
          ))}
        </>
      )}

      {pedidos.length === 0 && esperando.length === 0 && (
        <Vacio
          titulo="Todavía no has ofertado"
          detalle="Entra a «Ofertar», elige un pedido abierto y propón tu precio. Cuando un cliente acepte, el pedido aparecerá aquí y podrás ir marcando el avance hasta la entrega."
        />
      )}
    </ScrollView>
  );
}
