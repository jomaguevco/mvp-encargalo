import { router } from 'expo-router';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { urlPublica } from '@/lib/api';
import { ESTADO_PEDIDO, PASOS, diasHasta, fecha, soles } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import { Chip, Progreso, Tarjeta } from './componentes';
import { ICONO_ESTADO, estiloCategoria, iconoCategoria } from './iconos';
import { C, E, R } from './tema';

/** Un dato del pedido con su icono. Se leen de un barrido, no leyendo. */
function Meta({ icono, children }: { icono: keyof typeof Ionicons.glyphMap; children: string }) {
  return (
    <View style={s.meta}>
      <Ionicons name={icono} size={13} color={C.textoSuave} />
      <Text style={s.metaTexto} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** La foto del producto, o el icono de su categoría sobre su color si no hay foto. */
function Foto({ pedido, style, icono }: { pedido: Pedido; style: object; icono: number }) {
  const foto = pedido.imagen_path ? urlPublica('productos', pedido.imagen_path) : null;
  const cat = estiloCategoria(pedido.categoria);
  if (foto) return <Image source={{ uri: foto }} style={style} resizeMode="contain" />;
  return (
    <View style={[style, s.sinFoto, { backgroundColor: cat.fondo }]}>
      <Ionicons name={cat.icono} size={icono} color={cat.color} />
    </View>
  );
}

/**
 * Plazo del pedido. La urgencia decide el color: vencido en rojo, tres días o
 * menos en Terracota. Es el dato por el que un comprador externo elige qué
 * pedido mirar primero, así que tiene que saltar a la vista.
 */
function plazo(pedido: Pedido) {
  const dias = diasHasta(pedido.fecha_limite);
  const urgente = dias <= 3;
  return {
    urgente,
    color: dias < 0 ? C.rojo : urgente ? C.naranjaOscuro : C.textoSuave,
    icono: (dias < 0 ? 'alert-circle' : 'time-outline') as keyof typeof Ionicons.glyphMap,
    texto:
      dias < 0
        ? `Venció el ${fecha(pedido.fecha_limite)}`
        : dias === 0
          ? 'Lo necesita hoy'
          : `Faltan ${dias} día${dias === 1 ? '' : 's'}`,
  };
}

/**
 * Tarjeta de un pedido en las listas.
 *
 * - `producto` (por defecto): vertical, como en una tienda. Foto grande
 *   arriba con el estado encima, título, precio y avance. Va en cuadrícula.
 * - `fila`: horizontal y compacta, para listas de una columna.
 */
export function PedidoCard({
  pedido,
  pie,
  variante = 'producto',
  style,
}: {
  pedido: Pedido;
  pie?: string;
  variante?: 'producto' | 'fila';
  style?: ViewStyle;
}) {
  const info = ESTADO_PEDIDO[pedido.estado];
  const paso = PASOS.indexOf(pedido.estado);
  const activo = paso >= 0 && pedido.estado !== 'confirmado';
  const p = plazo(pedido);
  const abrir = () => router.push(`/pedido/${pedido.id}`);

  if (variante === 'fila') {
    return (
      <Tarjeta onPress={abrir} style={{ padding: E.md, ...style }}>
        <View style={s.fila}>
          <Foto pedido={pedido} style={s.miniatura} icono={26} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Chip texto={info.etiqueta} color={info.color} icono={ICONO_ESTADO[pedido.estado]} />
            <Text style={s.filaTitulo} numberOfLines={2}>
              {pedido.titulo}
            </Text>
            <View style={[s.metas, { marginTop: 4 }]}>
              <Meta icono="location-outline">{pedido.ciudad_entrega}</Meta>
              {activo && (
                <Text style={[s.metaTexto, { color: p.color }]}>{p.texto}</Text>
              )}
            </View>
          </View>
          {pedido.valor_referencial != null && (
            <Text style={s.filaPrecio}>{soles(pedido.valor_referencial)}</Text>
          )}
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

  return (
    <Tarjeta onPress={abrir} style={{ ...s.producto, ...style }}>
      <View style={s.vitrina}>
        <Foto pedido={pedido} style={s.vitrinaFoto} icono={44} />
        {/* El estado va sobre la foto, en una pastilla blanca: se lee sin tapar el producto. */}
        <View style={s.sobreFoto}>
          <View style={s.pastilla}>
            <Ionicons name={ICONO_ESTADO[pedido.estado]} size={12} color={info.color} />
            <Text style={[s.pastillaTexto, { color: info.color }]} numberOfLines={1}>
              {info.etiqueta}
            </Text>
          </View>
        </View>
        {activo && p.urgente && (
          <View style={[s.urgente, { backgroundColor: p.color }]}>
            <Ionicons name={p.icono} size={11} color={C.blanco} />
            <Text style={s.urgenteTexto}>{p.texto}</Text>
          </View>
        )}
      </View>

      <View style={s.cuerpo}>
        <View style={s.metas}>
          <Meta icono={iconoCategoria(pedido.categoria)}>{pedido.categoria}</Meta>
        </View>
        <Text style={s.titulo} numberOfLines={2}>
          {pedido.titulo}
        </Text>

        {/* El precio abajo del todo, alineado entre tarjetas de la misma fila. */}
        <View style={{ flex: 1 }} />
        {pedido.valor_referencial != null ? (
          <Text style={s.precio}>{soles(pedido.valor_referencial)}</Text>
        ) : (
          <Text style={s.sinPrecio}>Sin valor referencial</Text>
        )}
        <View style={s.lugar}>
          <Meta icono="location-outline">{pedido.ciudad_entrega}</Meta>
          {activo && !p.urgente && (
            <Text style={[s.metaTexto, { color: p.color }]} numberOfLines={1}>
              {p.texto}
            </Text>
          )}
        </View>

        {paso >= 0 && (
          <View style={{ marginTop: E.sm }}>
            <Progreso hechos={paso + 1} total={PASOS.length} color={info.color} />
          </View>
        )}
      </View>

      {!!pie && (
        <View style={s.pieProducto}>
          <Text style={s.pieTexto} numberOfLines={1}>
            {pie}
          </Text>
          <Ionicons name="arrow-forward" size={15} color={C.naranjaOscuro} />
        </View>
      )}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  // ---------------------------------------------------------------- producto
  producto: { padding: 0, overflow: 'hidden', flex: 1, marginBottom: 0 },
  vitrina: {
    aspectRatio: 4 / 3,
    backgroundColor: C.blanco,
    borderBottomWidth: 1,
    borderBottomColor: C.borde,
  },
  // Absoluta y no height: 100%: en la web un porcentaje dentro de un
  // aspectRatio da altura cero y la foto no se ve.
  vitrinaFoto: { position: 'absolute', top: E.sm, left: E.sm, right: E.sm, bottom: E.sm },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  sobreFoto: { position: 'absolute', top: E.sm, left: E.sm, right: E.sm },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: C.borde,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pastillaTexto: { fontSize: 11.5, fontWeight: '600' },
  urgente: {
    position: 'absolute',
    bottom: E.sm,
    left: E.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  urgenteTexto: { fontSize: 11, fontWeight: '600', color: C.blanco },
  cuerpo: { padding: E.md, flex: 1 },
  titulo: {
    fontWeight: '600',
    fontSize: 14.5,
    color: C.texto,
    marginTop: 4,
    lineHeight: 19,
    minHeight: 38,
  },
  precio: {
    fontSize: 19,
    fontWeight: '800',
    color: C.azul,
    letterSpacing: -0.4,
    marginTop: E.sm,
  },
  sinPrecio: { fontSize: 13, color: C.grisTexto, marginTop: E.sm },
  lugar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 2,
  },
  pieProducto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: E.xs,
    paddingHorizontal: E.md,
    paddingVertical: E.sm + 2,
    borderTopWidth: 1,
    borderTopColor: C.borde,
    backgroundColor: C.superficieSuave,
  },

  // ---------------------------------------------------------------- fila
  fila: { flexDirection: 'row', gap: E.md, alignItems: 'center' },
  miniatura: {
    width: 72,
    height: 72,
    borderRadius: R.md,
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    overflow: 'hidden',
  },
  filaTitulo: { fontWeight: '600', fontSize: 15, color: C.texto, marginTop: 4, lineHeight: 20 },
  filaPrecio: { fontSize: 16, fontWeight: '700', color: C.azul },
  pieAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: E.md,
    paddingTop: E.sm + 2,
    borderTopWidth: 1,
    borderTopColor: C.borde,
  },

  // ---------------------------------------------------------------- comunes
  metas: { flexDirection: 'row', flexWrap: 'wrap', gap: E.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaTexto: { fontSize: 12, color: C.textoSuave, fontWeight: '500', flexShrink: 1 },
  pieTexto: { fontSize: 13.5, fontWeight: '600', color: C.naranjaOscuro, flexShrink: 1 },
});
