import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ESTADO_PEDIDO, PASOS, fechaHora } from '@/lib/negocio';
import type { EstadoPedido, EventoPedido } from '@/lib/tipos';
import { ICONO_ESTADO } from './iconos';
import { C, E } from './tema';

/**
 * Línea de tiempo del pedido: lo que reemplaza al «¿ya salió mi encargo?».
 *
 * Es la pieza que más se mira de la aplicación, porque es la respuesta a la
 * pregunta por la que alguien abre Encárgalo. Tres estados visuales bien
 * distintos:
 *
 *   hecho     círculo relleno con un visto dentro
 *   actual    círculo grande con el icono del estado y un halo
 *   pendiente círculo gris con el icono apagado
 */
export function Linea({
  estado,
  eventos,
}: {
  estado: EstadoPedido;
  eventos: EventoPedido[];
}) {
  if (estado === 'cancelado' || estado === 'en_disputa') {
    const info = ESTADO_PEDIDO[estado];
    return (
      <View style={s.corte}>
        <View style={[s.corteAro, { backgroundColor: `${info.color}14` }]}>
          <Ionicons name={ICONO_ESTADO[estado]} size={24} color={info.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.etiqueta, { color: info.color, fontWeight: '800' }]}>
            {info.etiqueta}
          </Text>
          <Text style={s.detalle}>{info.detalle}</Text>
        </View>
      </View>
    );
  }

  const actual = PASOS.indexOf(estado);
  const cuando = new Map(eventos.map((e) => [e.estado_nuevo, e.creado_en]));

  return (
    <View>
      {PASOS.map((paso, i) => {
        const info = ESTADO_PEDIDO[paso];
        // El último paso hecho es también «hecho» cuando el pedido ya terminó
        const hecho = i < actual || (paso === 'confirmado' && estado === 'confirmado');
        const esActual = i === actual && !hecho;
        const ultimo = i === PASOS.length - 1;

        return (
          <View key={paso} style={{ flexDirection: 'row' }}>
            <View style={s.columna}>
              {hecho ? (
                <View style={[s.punto, { backgroundColor: C.verde }]}>
                  <Ionicons name="checkmark" size={15} color={C.blanco} />
                </View>
              ) : esActual ? (
                <View style={[s.halo, { backgroundColor: `${info.color}22` }]}>
                  <View style={[s.punto, { backgroundColor: info.color }]}>
                    <Ionicons name={ICONO_ESTADO[paso]} size={14} color={C.blanco} />
                  </View>
                </View>
              ) : (
                <View style={[s.punto, s.puntoPendiente]}>
                  <Ionicons name={ICONO_ESTADO[paso]} size={13} color="#AAB6C5" />
                </View>
              )}

              {!ultimo && (
                <View
                  style={[s.tallo, { backgroundColor: i < actual ? C.verde : C.borde }]}
                />
              )}
            </View>

            <View style={{ flex: 1, paddingBottom: ultimo ? 0 : E.lg, paddingTop: esActual ? 6 : 3 }}>
              <Text
                style={[
                  s.etiqueta,
                  {
                    fontWeight: esActual ? '800' : hecho ? '700' : '600',
                    color: hecho || esActual ? C.texto : C.textoSuave,
                  },
                ]}>
                {info.etiqueta}
              </Text>
              {esActual && <Text style={s.detalle}>{info.detalle}</Text>}
              {cuando.has(paso) && (
                <Text style={s.cuando}>{fechaHora(cuando.get(paso))}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  columna: { alignItems: 'center', width: 44 },
  punto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginBottom: -6,
  },
  puntoPendiente: { backgroundColor: C.superficieSuave, borderWidth: 1.5, borderColor: C.borde },
  tallo: { width: 2.5, flex: 1, minHeight: 20, borderRadius: 2, marginVertical: 3 },

  etiqueta: { fontSize: 15, color: C.texto },
  detalle: { fontSize: 13.5, color: C.textoSuave, lineHeight: 19, marginTop: 2 },
  cuando: { fontSize: 12, color: C.textoSuave, fontWeight: '600', marginTop: 2 },

  corte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    paddingVertical: E.sm,
  },
  corteAro: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
