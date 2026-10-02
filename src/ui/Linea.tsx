import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ESTADO_PEDIDO, PASOS, fechaHora } from '@/lib/negocio';
import type { EstadoPedido, EventoPedido } from '@/lib/tipos';
import { Micro, Parrafo } from './componentes';
import { C, E } from './tema';

/**
 * Línea de tiempo del pedido: lo que reemplaza al «¿ya salió mi encargo?».
 *
 * Es la pieza que más se mira de la aplicación, porque es la respuesta a la
 * pregunta por la que alguien abre Encárgalo. Tres estados visuales bien
 * distintos, y no tres círculos del mismo tamaño:
 *
 *   hecho     círculo relleno con un visto dentro
 *   actual    círculo hueco con aro, del color del estado
 *   pendiente círculo gris pequeño
 *
 * El visto importa más de lo que parece: un círculo relleno solo se entiende
 * comparándolo con los de al lado, y un visto se entiende solo.
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
          <Ionicons
            name={estado === 'cancelado' ? 'close-circle' : 'alert-circle'}
            size={22}
            color={info.color}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Parrafo style={{ fontWeight: '800', color: info.color }}>
            {info.etiqueta}
          </Parrafo>
          <Parrafo suave>{info.detalle}</Parrafo>
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
        const hecho = i < actual;
        const esActual = i === actual;
        const ultimo = i === PASOS.length - 1;
        const color = hecho || esActual ? info.color : C.borde;

        return (
          <View key={paso} style={{ flexDirection: 'row' }}>
            <View style={s.columna}>
              {hecho ? (
                <View style={[s.punto, { backgroundColor: color }]}>
                  <Ionicons name="checkmark" size={13} color={C.blanco} />
                </View>
              ) : esActual ? (
                <View
                  style={[
                    s.punto,
                    s.puntoActual,
                    { borderColor: color, backgroundColor: `${color}1A` },
                  ]}>
                  <View style={[s.corazon, { backgroundColor: color }]} />
                </View>
              ) : (
                <View style={s.puntoPendiente} />
              )}

              {!ultimo && (
                <View
                  style={[
                    s.tallo,
                    { backgroundColor: i < actual ? info.color : C.borde },
                  ]}
                />
              )}
            </View>

            <View style={{ flex: 1, paddingBottom: ultimo ? 0 : E.md }}>
              <Parrafo
                style={{
                  fontWeight: esActual ? '800' : hecho ? '700' : '600',
                  color: hecho || esActual ? C.texto : C.textoSuave,
                  fontSize: 15,
                }}>
                {info.etiqueta}
              </Parrafo>
              {esActual && <Parrafo suave>{info.detalle}</Parrafo>}
              {cuando.has(paso) && (
                <Micro style={{ marginTop: 2 }}>{fechaHora(cuando.get(paso))}</Micro>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  columna: { alignItems: 'center', width: 32 },

  punto: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  puntoActual: { borderWidth: 2.5 },
  // El punto central del estado actual: pequeño, para que se lea como «aquí»
  // y no como «terminado».
  corazon: { width: 7, height: 7, borderRadius: 4 },
  puntoPendiente: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.borde,
    marginTop: 7,
  },

  tallo: { width: 2.5, flex: 1, minHeight: 24, borderRadius: 2, marginTop: 2 },

  corte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    paddingVertical: E.sm,
  },
  corteAro: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
