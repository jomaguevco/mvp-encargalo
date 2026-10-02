import { router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { urlPublica } from '@/lib/api';
import { ESTADO_PEDIDO, diasHasta, fecha, soles } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import { Chip, Parrafo, Tarjeta } from './componentes';
import { C, E, R } from './tema';

/** Un dato del pedido con su icono. Se leen de un barrido, no leyendo. */
function Meta({
  icono,
  children,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  children: string;
}) {
  return (
    <View style={s.meta}>
      <Ionicons name={icono} size={13} color={C.textoSuave} />
      <Text style={s.metaTexto}>{children}</Text>
    </View>
  );
}

export function PedidoCard({ pedido, pie }: { pedido: Pedido; pie?: string }) {
  const info = ESTADO_PEDIDO[pedido.estado];
  const dias = diasHasta(pedido.fecha_limite);

  // La urgencia decide el color: vencido en rojo, tres días o menos en
  // naranja. Es el dato por el que un comprador externo elige qué pedido
  // mirar primero, así que tiene que saltar a la vista.
  const urgente = dias <= 3;
  const tonoPlazo = dias < 0 ? C.rojo : urgente ? C.naranja : C.textoSuave;

  return (
    <Tarjeta onPress={() => router.push(`/pedido/${pedido.id}`)}>
      <View style={s.cabecera}>
        <Parrafo style={s.titulo} numberOfLines={2}>
          {pedido.titulo}
        </Parrafo>
        <Chip texto={info.etiqueta} color={info.color} />
      </View>

      {!!pedido.descripcion && (
        <Parrafo suave style={{ marginTop: E.xs }} numberOfLines={2}>
          {pedido.descripcion}
        </Parrafo>
      )}

      {!!pedido.imagen_path && (
        <Image
          source={{ uri: urlPublica('productos', pedido.imagen_path) ?? undefined }}
          style={s.foto}
          resizeMode="cover"
        />
      )}

      <View style={s.metas}>
        <Meta icono="pricetags-outline">{pedido.categoria}</Meta>
        <Meta icono="location-outline">{pedido.ciudad_entrega}</Meta>
        {pedido.valor_referencial != null && (
          <Meta icono="cash-outline">{`Ref. ${soles(pedido.valor_referencial)}`}</Meta>
        )}
      </View>

      <View style={s.pieFila}>
        <View style={[s.plazo, urgente && { backgroundColor: `${tonoPlazo}14` }]}>
          <Ionicons
            name={dias < 0 ? 'alert-circle' : 'time-outline'}
            size={13}
            color={tonoPlazo}
          />
          <Text style={[s.plazoTexto, { color: tonoPlazo }]}>
            {dias < 0
              ? `Venció el ${fecha(pedido.fecha_limite)}`
              : dias === 0
                ? 'Lo necesita hoy'
                : `En ${dias} día${dias === 1 ? '' : 's'}`}
          </Text>
        </View>

        {!!pie && <Text style={s.pieTexto}>{pie}</Text>}
      </View>
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: E.md,
  },
  titulo: { fontWeight: '800', flex: 1, fontSize: 16, letterSpacing: -0.2 },

  foto: {
    width: '100%',
    height: 140,
    borderRadius: R.md,
    marginTop: E.md,
    backgroundColor: C.superficieSuave,
  },

  metas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: E.md,
    marginTop: E.md,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTexto: { fontSize: 12.5, color: C.textoSuave, fontWeight: '600' },

  pieFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: E.md,
    gap: E.sm,
  },
  plazo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    marginLeft: -8,
  },
  plazoTexto: { fontSize: 12.5, fontWeight: '700' },

  pieTexto: { fontSize: 12.5, fontWeight: '800', color: C.azul },
});
