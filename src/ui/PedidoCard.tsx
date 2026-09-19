import { router } from 'expo-router';
import { View } from 'react-native';
import { ESTADO_PEDIDO, diasHasta, fecha, soles } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import { Chip, Micro, Parrafo, Tarjeta } from './componentes';
import { C, E } from './tema';

export function PedidoCard({
  pedido,
  pie,
}: {
  pedido: Pedido;
  pie?: string;
}) {
  const info = ESTADO_PEDIDO[pedido.estado];
  const dias = diasHasta(pedido.fecha_limite);

  return (
    <Tarjeta onPress={() => router.push(`/pedido/${pedido.id}`)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: E.md }}>
        <Parrafo style={{ fontWeight: '700', flex: 1 }}>{pedido.titulo}</Parrafo>
        <Chip texto={info.etiqueta} color={info.color} />
      </View>

      {!!pedido.descripcion && (
        <Parrafo suave style={{ marginTop: E.xs }} numberOfLines={2}>
          {pedido.descripcion}
        </Parrafo>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: E.md, marginTop: E.md }}>
        <Micro>{pedido.categoria}</Micro>
        <Micro>·</Micro>
        <Micro>{pedido.ciudad_entrega}</Micro>
        {pedido.valor_referencial != null && (
          <>
            <Micro>·</Micro>
            <Micro>Ref. {soles(pedido.valor_referencial)}</Micro>
          </>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: E.sm,
        }}>
        <Micro
          style={{
            color: dias < 0 ? C.rojo : dias <= 3 ? C.naranja : C.textoSuave,
            fontWeight: dias <= 3 ? '700' : '400',
          }}>
          {dias < 0
            ? `Venció el ${fecha(pedido.fecha_limite)}`
            : dias === 0
              ? 'Lo necesita hoy'
              : `Lo necesita en ${dias} día${dias === 1 ? '' : 's'}`}
        </Micro>
        {!!pie && <Micro style={{ fontWeight: '700', color: C.azul }}>{pie}</Micro>}
      </View>
    </Tarjeta>
  );
}
