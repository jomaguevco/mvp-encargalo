import { router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { urlPublica } from '@/lib/api';
import { ESTADO_PEDIDO, PASOS, diasHasta, fecha, soles } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import { Chip, Progreso, Tarjeta } from './componentes';
import { ICONO_ESTADO, iconoCategoria } from './iconos';
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

/**
 * Tarjeta de un pedido en las listas.
 *
 * A la izquierda, la foto del producto o el icono de su categoría: es lo que
 * permite reconocer un pedido sin leer el título. Abajo, la barra de los siete
 * pasos: de un vistazo se ve cuánto le falta.
 */
export function PedidoCard({ pedido, pie }: { pedido: Pedido; pie?: string }) {
  const info = ESTADO_PEDIDO[pedido.estado];
  const dias = diasHasta(pedido.fecha_limite);
  const paso = PASOS.indexOf(pedido.estado);
  const activo = paso >= 0 && pedido.estado !== 'confirmado';

  // La urgencia decide el color: vencido en rojo, tres días o menos en
  // naranja. Es el dato por el que un comprador externo elige qué pedido
  // mirar primero, así que tiene que saltar a la vista.
  const urgente = dias <= 3;
  const tonoPlazo = dias < 0 ? C.rojo : urgente ? C.naranja : C.textoSuave;
  const foto = pedido.imagen_path ? urlPublica('productos', pedido.imagen_path) : null;

  return (
    <Tarjeta onPress={() => router.push(`/pedido/${pedido.id}`)} style={s.tarjeta}>
      <View style={s.fila}>
        {foto ? (
          <Image source={{ uri: foto }} style={s.miniatura} resizeMode="cover" />
        ) : (
          <View style={[s.miniatura, s.miniaturaIcono]}>
            <Ionicons name={iconoCategoria(pedido.categoria)} size={26} color={C.azulMedio} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Chip texto={info.etiqueta} color={info.color} icono={ICONO_ESTADO[pedido.estado]} />
          <Text style={s.titulo} numberOfLines={2}>
            {pedido.titulo}
          </Text>
          {!!pedido.descripcion && (
            <Text style={s.descripcion} numberOfLines={1}>
              {pedido.descripcion}
            </Text>
          )}
        </View>
      </View>

      <View style={s.metas}>
        <Meta icono={iconoCategoria(pedido.categoria)}>{pedido.categoria}</Meta>
        <Meta icono="location-outline">{pedido.ciudad_entrega}</Meta>
        {pedido.cantidad > 1 && <Meta icono="layers-outline">{`${pedido.cantidad} unidades`}</Meta>}
      </View>

      {paso >= 0 && (
        <View style={{ marginTop: E.md }}>
          <Progreso hechos={paso + 1} total={PASOS.length} color={info.color} />
        </View>
      )}

      <View style={s.pieFila}>
        {activo ? (
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
                  : `Faltan ${dias} día${dias === 1 ? '' : 's'}`}
            </Text>
          </View>
        ) : (
          <Text style={s.plazoTexto}>{fecha(pedido.actualizado_en)}</Text>
        )}

        {pedido.valor_referencial != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.refEtiqueta}>Valor ref.</Text>
            <Text style={s.refValor}>{soles(pedido.valor_referencial)}</Text>
          </View>
        ) : null}
      </View>

      {!!pie && (
        <View style={s.pieAccion}>
          <Text style={s.pieTexto}>{pie}</Text>
          <Ionicons name="arrow-forward" size={16} color={C.naranja} />
        </View>
      )}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  tarjeta: { padding: E.lg },
  fila: { flexDirection: 'row', gap: E.md, alignItems: 'flex-start' },
  miniatura: {
    width: 64,
    height: 64,
    borderRadius: R.md,
    backgroundColor: C.superficieSuave,
  },
  miniaturaIcono: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.azulClaro,
  },
  titulo: {
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
    color: C.texto,
    marginTop: 6,
    lineHeight: 21,
  },
  descripcion: { fontSize: 13.5, color: C.textoSuave, marginTop: 2 },

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
  plazoTexto: { fontSize: 12.5, fontWeight: '700', color: C.textoSuave },
  refEtiqueta: { fontSize: 11, color: C.textoSuave, fontWeight: '600' },
  refValor: { fontSize: 15, color: C.azul, fontWeight: '800' },

  pieAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: E.md,
    paddingTop: E.md,
    borderTopWidth: 1,
    borderTopColor: C.borde,
  },
  pieTexto: { fontSize: 14, fontWeight: '800', color: C.naranja },
});
