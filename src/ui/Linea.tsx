import { View } from 'react-native';
import { ESTADO_PEDIDO, PASOS, fechaHora } from '@/lib/negocio';
import type { EstadoPedido, EventoPedido } from '@/lib/tipos';
import { Micro, Parrafo } from './componentes';
import { C, E } from './tema';

/** Línea de tiempo del pedido: lo que reemplaza al "¿ya salió mi encargo?". */
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
      <View style={{ paddingVertical: E.sm }}>
        <Parrafo style={{ fontWeight: '700', color: info.color }}>
          {info.etiqueta}
        </Parrafo>
        <Parrafo suave>{info.detalle}</Parrafo>
      </View>
    );
  }

  const actual = PASOS.indexOf(estado);
  const cuando = new Map(eventos.map((e) => [e.estado_nuevo, e.creado_en]));

  return (
    <View>
      {PASOS.map((paso, i) => {
        const info = ESTADO_PEDIDO[paso];
        const hecho = i <= actual;
        const esActual = i === actual;
        const ultimo = i === PASOS.length - 1;

        return (
          <View key={paso} style={{ flexDirection: 'row' }}>
            <View style={{ alignItems: 'center', width: 28 }}>
              <View
                style={{
                  width: esActual ? 16 : 12,
                  height: esActual ? 16 : 12,
                  borderRadius: 8,
                  backgroundColor: hecho ? info.color : C.borde,
                  borderWidth: esActual ? 3 : 0,
                  borderColor: `${info.color}44`,
                  marginTop: 4,
                }}
              />
              {!ultimo && (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 26,
                    backgroundColor: i < actual ? info.color : C.borde,
                  }}
                />
              )}
            </View>

            <View style={{ flex: 1, paddingBottom: ultimo ? 0 : E.md }}>
              <Parrafo
                style={{
                  fontWeight: esActual ? '800' : '600',
                  color: hecho ? C.texto : C.textoSuave,
                  fontSize: 14.5,
                }}>
                {info.etiqueta}
              </Parrafo>
              {esActual && <Parrafo suave>{info.detalle}</Parrafo>}
              {cuando.has(paso) && <Micro>{fechaHora(cuando.get(paso))}</Micro>}
            </View>
          </View>
        );
      })}
    </View>
  );
}
