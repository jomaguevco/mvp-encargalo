import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/ctx/auth';
import * as api from '@/lib/api';
import {
  CANCELABLES,
  DISPUTABLES,
  ESTADO_PAGO,
  ESTADO_PEDIDO,
  SIGUIENTE_PASO_COMPRADOR,
  diasHasta,
  fecha,
  fechaHora,
  soles,
} from '@/lib/negocio';
import type {
  DesglosePrecio,
  EventoPedido,
  Mensaje,
  MetodoPago,
  Oferta,
  OfertaConReputacion,
  Pago,
  Pedido,
} from '@/lib/tipos';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Chip,
  Dato,
  Micro,
  Opciones,
  Parrafo,
  Separador,
  Subtitulo,
  Tarjeta,
} from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { Linea } from '@/ui/Linea';
import { OfertaItem } from '@/ui/OfertaItem';
import { C, E, R } from '@/ui/tema';

const YAPE_NUMERO = process.env.EXPO_PUBLIC_YAPE_NUMERO ?? '999 999 999';
const YAPE_TITULAR = process.env.EXPO_PUBLIC_YAPE_TITULAR ?? 'Encárgalo S.A.C.';

export default function DetallePedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navegacion = useNavigation();
  const { perfil, esOperador } = useAuth();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [ofertas, setOfertas] = useState<OfertaConReputacion[]>([]);
  const [propia, setPropia] = useState<Oferta | null>(null);
  const [pago, setPago] = useState<Pago | null>(null);
  const [eventos, setEventos] = useState<EventoPedido[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [limite, setLimite] = useState<string | null>(null);
  const [motivoCancelar, setMotivoCancelar] = useState('');

  const soyCliente = !!pedido && pedido.cliente_id === perfil?.id;
  const soyComprador = !!pago && pago.comprador_id === perfil?.id;

  const cargar = useCallback(async () => {
    if (!id) return;
    const p = await api.verPedido(id);
    setPedido(p);
    if (!p) return;
    const [ofs, pg, evs, msgs, mia] = await Promise.all([
      api.ofertasDelPedido(id),
      api.pagoDelPedido(id),
      api.eventosDelPedido(id),
      api.mensajesDelPedido(id),
      api.miOferta(id),
    ]);
    setOfertas(ofs);
    setPago(pg);
    setEventos(evs);
    setMensajes(msgs);
    setPropia(mia);
    // Plazo del cliente para confirmar. Sale de `dias_para_confirmar` en la
    // tabla config, no de un número escrito aquí.
    setLimite(p.estado === 'entregado' ? await api.fechaLimiteConfirmacion(id) : null);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        await cargar();
      } finally {
        setCargando(false);
      }
    })();
  }, [cargar]);

  useEffect(() => {
    if (pedido) {
      navegacion.setOptions({ title: pedido.titulo.slice(0, 28) });
    }
  }, [pedido, navegacion]);

  // El chat se actualiza solo. Sin realtime, un sondeo cada 12 segundos basta
  // para una conversación de dos personas y evita el «recarga para ver si te
  // contestaron», que era el motivo por el que la gente pedía el WhatsApp.
  useEffect(() => {
    if (!id || !(soyCliente || soyComprador)) return;
    const reloj = setInterval(() => {
      api
        .mensajesDelPedido(id)
        .then(setMensajes)
        .catch(() => undefined);
    }, 12_000);
    return () => clearInterval(reloj);
  }, [id, soyCliente, soyComprador]);

  async function accion(clave: string, fn: () => Promise<unknown>) {
    setOcupado(clave);
    try {
      await fn();
      await cargar();
    } catch (e) {
      avisar('No se pudo completar', (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  if (cargando) return <Cargando texto="Cargando el pedido…" />;
  if (!pedido) {
    return (
      <View style={{ padding: E.xl }}>
        <Aviso tono="error" titulo="No encontramos este pedido">
          Puede que haya sido cancelado o que no tengas acceso a él.
        </Aviso>
      </View>
    );
  }

  const info = ESTADO_PEDIDO[pedido.estado];
  const masBarata = ofertas.length
    ? Math.min(...ofertas.map((o) => o.precio_final))
    : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
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
        {/* ---------------------------------------------------- resumen */}
        <Tarjeta>
          <Chip texto={info.etiqueta} color={info.color} />
          <Parrafo style={{ fontSize: 18, fontWeight: '800', marginTop: E.sm }}>
            {pedido.titulo}
          </Parrafo>
          {!!pedido.descripcion && (
            <Parrafo suave style={{ marginTop: E.xs }}>
              {pedido.descripcion}
            </Parrafo>
          )}
          {!!pedido.url_producto && (
            <Pressable onPress={() => Linking.openURL(pedido.url_producto!)}>
              <Parrafo
                style={{ color: C.naranja, fontWeight: '700', marginTop: E.sm }}
                numberOfLines={1}>
                Ver el producto original ↗
              </Parrafo>
            </Pressable>
          )}
          {!!pedido.imagen_path && (
            <Image
              source={{
                uri: api.urlPublica('productos', pedido.imagen_path) ?? undefined,
              }}
              style={{
                width: '100%',
                height: 190,
                borderRadius: R.md,
                marginTop: E.md,
                backgroundColor: C.borde,
              }}
              resizeMode="cover"
            />
          )}
          <Separador />
          <Dato etiqueta="Categoría" valor={pedido.categoria} />
          <Dato etiqueta="Cantidad" valor={String(pedido.cantidad)} />
          <Dato etiqueta="Entrega en" valor={pedido.ciudad_entrega} />
          <Dato etiqueta="Fecha límite" valor={fecha(pedido.fecha_limite)} />
          {pedido.valor_referencial != null && (
            <Dato
              etiqueta="Valor referencial"
              valor={soles(pedido.valor_referencial)}
            />
          )}
        </Tarjeta>

        {/* ---------------------------------------------------- seguimiento */}
        <Subtitulo style={{ marginTop: E.md }}>Seguimiento</Subtitulo>
        <Tarjeta>
          <Linea estado={pedido.estado} eventos={eventos} />
        </Tarjeta>

        {pago && (soyCliente || soyComprador) && (
          <Boton
            titulo={
              soyCliente
                ? 'Ver la reputación del comprador externo'
                : 'Ver la reputación del cliente'
            }
            variante="fantasma"
            onPress={() =>
              router.push(
                `/reputacion/${soyCliente ? pago.comprador_id : pago.cliente_id}`,
              )
            }
          />
        )}

        {/* ---------------------------------------------------- ofertas */}
        {pedido.estado === 'publicado' && soyCliente && (
          <>
            <Subtitulo style={{ marginTop: E.md }}>
              {ofertas.length === 0
                ? 'Aún no hay ofertas'
                : `${ofertas.length} oferta${ofertas.length === 1 ? '' : 's'} recibida${
                    ofertas.length === 1 ? '' : 's'
                  }`}
            </Subtitulo>
            {ofertas.length === 0 ? (
              <Aviso tono="info">
                Los compradores externos verificados ya pueden ver tu pedido. En cuanto
                alguien oferte te avisaremos. No pagas nada hasta elegir.
              </Aviso>
            ) : (
              <Parrafo suave style={{ marginBottom: E.md }}>
                Compara precio, fecha y reputación. La más barata no siempre es la mejor
                decisión.
              </Parrafo>
            )}
            {ofertas.map((o) => (
              <OfertaItem
                key={o.id}
                oferta={o}
                masBarata={o.precio_final === masBarata}
                puedeAceptar
                aceptando={ocupado === `aceptar-${o.id}`}
                onAceptar={async () => {
                  const seguro = await confirmar(
                    'Elegir esta oferta',
                    `Vas a aceptar la oferta de ${soles(
                      o.precio_final,
                    )} con entrega el ${fecha(
                      o.fecha_entrega,
                    )}.\n\nLas demás ofertas quedarán descartadas y se generará tu orden de pago.`,
                    'Aceptar oferta',
                  );
                  if (!seguro) return;
                  accion(`aceptar-${o.id}`, () => api.aceptarOferta(o.id));
                }}
              />
            ))}
          </>
        )}

        {/* ---------------------------------------------------- ofertar */}
        {pedido.estado === 'publicado' && !soyCliente && (
          <FormularioOferta
            pedido={pedido}
            propia={propia}
            ocupado={ocupado === 'ofertar'}
            retirando={ocupado === 'retirar'}
            onOfertar={(precio, fechaEntrega, nota) =>
              accion('ofertar', () =>
                api.ofertar(pedido.id, precio, fechaEntrega, nota),
              )
            }
            onRetirar={async () => {
              const seguro = await confirmar(
                'Retirar la oferta',
                'El cliente dejará de verla. Podrás volver a ofertar mientras el pedido siga abierto.',
                'Retirar',
                true,
              );
              if (!seguro) return;
              accion('retirar', () => api.retirarOferta(propia!.id));
            }}
          />
        )}

        {/* ---------------------------------------------------- pago */}
        {pago && (
          <PanelPago
            pago={pago}
            soyCliente={soyCliente}
            esOperador={esOperador}
            ocupado={ocupado}
            onReportar={(metodo, codigo, uri) =>
              accion('reportar', () =>
                api.reportarPago({
                  pedidoId: pedido.id,
                  metodo,
                  codigoOperacion: codigo,
                  comprobanteUri: uri,
                }),
              )
            }
            onConfirmarRetencion={() =>
              accion('retener', () => api.confirmarRetencion(pedido.id))
            }
          />
        )}

        {/* ------------------------------------ acciones del comprador */}
        {soyComprador && SIGUIENTE_PASO_COMPRADOR[pedido.estado] && (
          <Tarjeta>
            <Subtitulo>Tu turno</Subtitulo>
            <Parrafo suave style={{ marginBottom: E.md }}>
              El cliente ve cada paso que marcas. Mantenerlo informado es lo que sube tu
              puntualidad y tu reputación.
            </Parrafo>
            <Boton
              titulo={SIGUIENTE_PASO_COMPRADOR[pedido.estado]!.accion}
              variante="secundario"
              cargando={ocupado === 'avanzar'}
              onPress={() =>
                accion('avanzar', () =>
                  api.avanzarPedido(
                    pedido.id,
                    SIGUIENTE_PASO_COMPRADOR[pedido.estado]!.siguiente,
                  ),
                )
              }
            />
          </Tarjeta>
        )}

        {/* ------------------------------------ confirmación del cliente */}
        {soyCliente && pedido.estado === 'entregado' && (
          <Tarjeta style={{ borderColor: C.verde, borderWidth: 2 }}>
            <Subtitulo>¿Recibiste tu pedido?</Subtitulo>
            <Parrafo suave style={{ marginBottom: E.md }}>
              Revisa que sea lo que pediste antes de confirmar. Al confirmar, liberamos{' '}
              {soles(pago?.monto_liberado)} al comprador externo y ya no podremos
              retenerlo.
            </Parrafo>

            {!!limite && (
              <Aviso
                tono={diasHasta(limite.slice(0, 10)) < 0 ? 'alerta' : 'info'}
                titulo="Tu plazo para revisar">
                {diasHasta(limite.slice(0, 10)) < 0
                  ? `El plazo venció el ${fecha(limite)}. Si no respondes, el equipo puede revisar el caso y cerrar el pedido.`
                  : `Tienes hasta el ${fecha(limite)} para confirmar o abrir una disputa. Después de esa fecha el equipo revisa el caso.`}
              </Aviso>
            )}

            <Boton
              titulo="Sí, lo recibí conforme"
              cargando={ocupado === 'confirmar'}
              onPress={async () => {
                const seguro = await confirmar(
                  'Confirmar recepción',
                  'Esta acción libera el pago y no se puede deshacer. ¿Recibiste tu producto conforme?',
                  'Sí, confirmo',
                );
                if (!seguro) return;
                accion('confirmar', () => api.confirmarRecepcion(pedido.id));
              }}
            />
          </Tarjeta>
        )}

        {/* ------------------------------------ disputa */}
        {(soyCliente || soyComprador) && DISPUTABLES.includes(pedido.estado) && (
          <PanelDisputa
            soyCliente={soyCliente}
            ocupado={ocupado === 'disputa'}
            onAbrir={(motivo, evidencia) =>
              accion('disputa', () =>
                api.abrirDisputaConEvidencia({
                  pedidoId: pedido.id,
                  motivo,
                  evidenciaUri: evidencia,
                }),
              )
            }
          />
        )}

        {/* ------------------------------------ cancelar */}
        {soyCliente && CANCELABLES.includes(pedido.estado) && (
          <Tarjeta>
            <Subtitulo>¿Ya no lo necesitas?</Subtitulo>
            <Parrafo suave style={{ marginBottom: E.md }}>
              Puedes cancelar mientras no hayas reportado el pago. Las ofertas recibidas
              quedan descartadas y quien ofertó recibe un aviso. Si ya pagaste, el caso
              se cierra por disputa para que el equipo te devuelva el dinero.
            </Parrafo>
            <Campo
              etiqueta="¿Por qué lo cancelas?"
              value={motivoCancelar}
              onChangeText={setMotivoCancelar}
              placeholder="Ej.: ya lo conseguí en una tienda local"
              ayuda="Quien te ofertó recibe este motivo en su aviso"
              maxLength={200}
            />
            <Boton
              titulo="Cancelar el pedido"
              variante="peligro"
              cargando={ocupado === 'cancelar'}
              onPress={async () => {
                if (motivoCancelar.trim().length < 5) {
                  avisar('Falta el motivo', 'Cuéntale en pocas palabras a quien te ofertó por qué cancelas.');
                  return;
                }
                const seguro = await confirmar(
                  'Cancelar el pedido',
                  'Se descartarán las ofertas recibidas y el pedido dejará de estar visible. No se puede deshacer.',
                  'Cancelar el pedido',
                  true,
                );
                if (!seguro) return;
                accion('cancelar', () =>
                  api.cancelarPedido(pedido.id, motivoCancelar.trim()),
                );
              }}
            />
          </Tarjeta>
        )}

        {/* ---------------------------------------------------- calificar */}
        {pedido.estado === 'confirmado' && (soyCliente || soyComprador) && (
          <PanelCalificacion
            pedidoId={pedido.id}
            ocupado={ocupado === 'calificar'}
            onCalificar={(puntaje, comentario) =>
              accion('calificar', () =>
                api.calificar(pedido.id, puntaje, comentario),
              )
            }
          />
        )}

        {/* ---------------------------------------------------- chat */}
        {(soyCliente || soyComprador) && pedido.estado !== 'publicado' && (
          <Chat
            mensajes={mensajes}
            yo={perfil?.id ?? ''}
            onEnviar={(texto) =>
              accion('mensaje', () => api.enviarMensaje(pedido.id, texto))
            }
            enviando={ocupado === 'mensaje'}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =====================================================================
//  Formulario de oferta
// =====================================================================
function FormularioOferta({
  pedido,
  propia,
  ocupado,
  onOfertar,
  onRetirar,
  retirando,
}: {
  pedido: Pedido;
  propia: Oferta | null;
  ocupado: boolean;
  onOfertar: (precio: number, fechaEntrega: string, nota: string) => void;
  onRetirar: () => void;
  retirando: boolean;
}) {
  const [precio, setPrecio] = useState('');
  const [dias, setDias] = useState('21');
  const [nota, setNota] = useState('');
  const [desglose, setDesglose] = useState<DesglosePrecio | null>(null);

  useEffect(() => {
    const n = Number(precio);
    if (!precio || Number.isNaN(n) || n <= 0) {
      setDesglose(null);
      return;
    }
    let vivo = true;
    api
      .desglosePrecio(n)
      .then((d) => vivo && setDesglose(d))
      .catch(() => vivo && setDesglose(null));
    return () => {
      vivo = false;
    };
  }, [precio]);

  if (propia) {
    return (
      <Tarjeta>
        <Subtitulo>Tu oferta está enviada</Subtitulo>
        <Dato etiqueta="Precio ofertado" valor={soles(propia.precio_final)} fuerte />
        <Dato etiqueta="Fecha de entrega" valor={fecha(propia.fecha_entrega)} />
        <Separador />
        <Parrafo suave style={{ marginBottom: E.md }}>
          El cliente está comparando las ofertas. Te avisaremos si elige la tuya.
        </Parrafo>
        {propia.estado === 'enviada' && (
          <Boton
            titulo="Retirar mi oferta"
            variante="fantasma"
            cargando={retirando}
            onPress={onRetirar}
          />
        )}
      </Tarjeta>
    );
  }

  function enDias(n: number) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  return (
    <Tarjeta>
      <Subtitulo>Enviar mi oferta</Subtitulo>
      <Parrafo suave style={{ marginBottom: E.md }}>
        Indica el precio final que le cobrarías al cliente, ya con tu recompensa
        incluida. La fecha límite del cliente es {fecha(pedido.fecha_limite)}.
      </Parrafo>

      <Campo
        etiqueta="Precio final para el cliente (S/)"
        value={precio}
        onChangeText={setPrecio}
        keyboardType="decimal-pad"
        placeholder="491.40"
      />

      <View style={{ marginBottom: E.lg }}>
        <Parrafo style={{ fontWeight: '700', fontSize: 13, marginBottom: E.sm }}>
          ¿En cuánto tiempo lo entregas?
        </Parrafo>
        <Opciones
          valor={dias}
          onChange={setDias}
          opciones={[
            { valor: '7', etiqueta: '1 semana' },
            { valor: '14', etiqueta: '2 semanas' },
            { valor: '21', etiqueta: '3 semanas' },
            { valor: '35', etiqueta: '5 semanas' },
          ]}
        />
      </View>

      <Campo
        etiqueta="Nota para el cliente"
        value={nota}
        onChangeText={setNota}
        multiline
        style={{ height: 76, textAlignVertical: 'top' }}
        placeholder="Ej.: Viajo a Miami el 5 de octubre, lo traigo en ese viaje."
      />

      {desglose && (
        <View
          style={{
            backgroundColor: C.verdeClaro,
            borderRadius: R.md,
            padding: E.md,
            marginBottom: E.lg,
          }}>
          <Parrafo style={{ fontWeight: '800', color: C.verde, marginBottom: E.xs }}>
            Tú recibirías {soles(desglose.recibe_comprador)}
          </Parrafo>
          <Micro>
            Encárgalo descuenta {soles(desglose.tarifa_comprador)} de tarifa de servicio
            al liberar el pago. El cliente pagará {soles(desglose.total)} en total.
          </Micro>
        </View>
      )}

      <Boton
        titulo="Enviar oferta"
        cargando={ocupado}
        deshabilitado={!precio || Number(precio) <= 0}
        onPress={() => onOfertar(Number(precio), enDias(Number(dias)), nota.trim())}
      />
    </Tarjeta>
  );
}

// =====================================================================
//  Panel de pago (escrow)
// =====================================================================
function PanelPago({
  pago,
  soyCliente,
  esOperador,
  ocupado,
  onReportar,
  onConfirmarRetencion,
}: {
  pago: Pago;
  soyCliente: boolean;
  esOperador: boolean;
  ocupado: string | null;
  onReportar: (metodo: MetodoPago, codigo: string, uri: string) => void;
  onConfirmarRetencion: () => void;
}) {
  const [metodo, setMetodo] = useState<MetodoPago>('yape');
  const [codigo, setCodigo] = useState('');
  const [comprobante, setComprobante] = useState<string | null>(null);
  const info = ESTADO_PAGO[pago.estado];

  async function elegirComprobante() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]) setComprobante(res.assets[0].uri);
  }

  return (
    <Tarjeta style={{ borderColor: info.color, borderWidth: 1.5 }}>
      <Chip texto={info.etiqueta} color={info.color} />
      <Parrafo suave style={{ marginTop: E.sm }}>
        {info.detalle}
      </Parrafo>

      <Separador />

      <Dato etiqueta="Producto y recompensa" valor={soles(pago.monto_encargo)} />
      <Dato
        etiqueta="Comisión de servicio Encárgalo"
        valor={soles(pago.comision_cliente)}
      />
      <Dato etiqueta="Procesamiento del pago" valor={soles(pago.cargo_procesamiento)} />
      <Separador />
      <Dato etiqueta="Total a pagar" valor={soles(pago.total_cobrado)} fuerte />

      {!soyCliente && (
        <>
          <Separador />
          <Dato etiqueta="Recibirás al entregar" valor={soles(pago.monto_liberado)} fuerte />
        </>
      )}

      {soyCliente && pago.estado === 'pendiente' && (
        <View style={{ marginTop: E.lg }}>
          <Aviso tono="info" titulo="Cómo pagar">
            Yapea {soles(pago.total_cobrado)} al {YAPE_NUMERO} ({YAPE_TITULAR}) y sube
            la captura. Tu dinero queda retenido por Encárgalo: el comprador externo no
            lo recibe hasta que tú confirmes que llegó tu producto.
          </Aviso>

          <Parrafo style={{ fontWeight: '700', fontSize: 13, marginBottom: E.sm }}>
            Método de pago
          </Parrafo>
          <View style={{ marginBottom: E.lg }}>
            <Opciones
              valor={metodo}
              onChange={setMetodo}
              opciones={[
                { valor: 'yape' as MetodoPago, etiqueta: 'Yape' },
                { valor: 'plin' as MetodoPago, etiqueta: 'Plin' },
                { valor: 'transferencia' as MetodoPago, etiqueta: 'Transferencia' },
              ]}
            />
          </View>

          <Campo
            etiqueta="Código de operación"
            value={codigo}
            onChangeText={setCodigo}
            placeholder="El número que aparece en tu constancia"
          />

          <Pressable
            onPress={elegirComprobante}
            style={{
              borderWidth: 2,
              borderStyle: comprobante ? 'solid' : 'dashed',
              borderColor: comprobante ? C.verde : C.borde,
              borderRadius: R.md,
              padding: E.lg,
              alignItems: 'center',
              marginBottom: E.lg,
            }}>
            <Text style={{ color: comprobante ? C.verde : C.azul, fontWeight: '700' }}>
              {comprobante ? 'Comprobante listo · tocar para cambiar' : 'Subir captura del pago'}
            </Text>
          </Pressable>

          <Boton
            titulo="Ya pagué"
            cargando={ocupado === 'reportar'}
            deshabilitado={!codigo.trim() || !comprobante}
            onPress={() => onReportar(metodo, codigo.trim(), comprobante!)}
          />
        </View>
      )}

      {pago.estado === 'en_revision' && (
        <View style={{ marginTop: E.md }}>
          <Aviso tono="alerta" titulo="Validando tu pago">
            Recibimos tu comprobante ({pago.codigo_operacion}). En cuanto confirmemos que
            el dinero llegó, el pedido pasa a «pago retenido».
          </Aviso>
          {/* Durante el piloto la retención la confirma a mano el equipo.
              El botón solo aparece para quien figura en la tabla operadores. */}
          {esOperador && (
            <Boton
              titulo="Equipo: el dinero llegó, retener"
              variante="secundario"
              cargando={ocupado === 'retener'}
              onPress={onConfirmarRetencion}
            />
          )}
        </View>
      )}

      {pago.estado === 'retenido' && (
        <Aviso tono="exito" titulo="Tu dinero está protegido">
          Encárgalo retiene {soles(pago.total_cobrado)}. No se transfiere a nadie hasta
          que confirmes que recibiste tu pedido conforme.
        </Aviso>
      )}

      {pago.estado === 'liberado' && (
        <>
          <Separador />
          <Dato etiqueta="Liberado el" valor={fechaHora(pago.liberado_en)} />
        </>
      )}
    </Tarjeta>
  );
}

// =====================================================================
//  Disputa
//  La abren las dos partes y en cualquier estado con dinero retenido, no
//  solo el cliente al final: el comprador externo que ya compró y no puede
//  entregar también necesita una salida que no sea desaparecer.
// =====================================================================
function PanelDisputa({
  soyCliente,
  ocupado,
  onAbrir,
}: {
  soyCliente: boolean;
  ocupado: boolean;
  onAbrir: (motivo: string, evidencia: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [evidencia, setEvidencia] = useState<string | null>(null);

  async function elegirEvidencia() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]) setEvidencia(res.assets[0].uri);
  }

  if (!abierto) {
    return (
      <Tarjeta>
        <Boton
          titulo="Tengo un problema con este pedido"
          variante="fantasma"
          onPress={() => setAbierto(true)}
        />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta style={{ borderColor: C.rojo, borderWidth: 1.5 }}>
      <Subtitulo>Abrir una disputa</Subtitulo>
      <Parrafo suave style={{ marginBottom: E.md }}>
        {soyCliente
          ? 'El pedido queda congelado y tu dinero sigue retenido mientras el equipo revisa el caso. Nadie recibe el pago hasta que se resuelva.'
          : 'Úsalo si no vas a poder entregar o si el cliente no responde. El equipo revisa el caso y decide qué pasa con el dinero retenido.'}
      </Parrafo>

      <Campo
        etiqueta="¿Qué pasó?"
        value={motivo}
        onChangeText={setMotivo}
        multiline
        style={{ height: 96, textAlignVertical: 'top' }}
        placeholder="Describe el problema: fechas, qué se acordó y qué ocurrió."
        ayuda="Mínimo 10 caracteres. Mientras más concreto, más rápido se resuelve."
      />

      <Pressable
        onPress={elegirEvidencia}
        style={{
          borderWidth: 2,
          borderStyle: evidencia ? 'solid' : 'dashed',
          borderColor: evidencia ? C.verde : C.borde,
          borderRadius: R.md,
          padding: E.md,
          alignItems: 'center',
          marginBottom: E.lg,
        }}>
        <Text style={{ color: evidencia ? C.verde : C.azul, fontWeight: '700' }}>
          {evidencia
            ? 'Evidencia lista · tocar para cambiar'
            : 'Adjuntar una foto (opcional)'}
        </Text>
      </Pressable>

      <Boton
        titulo="Abrir disputa"
        variante="peligro"
        cargando={ocupado}
        deshabilitado={motivo.trim().length < 10}
        onPress={async () => {
          const seguro = await confirmar(
            'Abrir disputa',
            'El pedido queda congelado hasta que el equipo revise el caso.',
            'Abrir disputa',
            true,
          );
          if (!seguro) return;
          onAbrir(motivo.trim(), evidencia);
          setAbierto(false);
          setMotivo('');
          setEvidencia(null);
        }}
      />
      <View style={{ height: E.sm }} />
      <Boton titulo="Cancelar" variante="fantasma" onPress={() => setAbierto(false)} />
    </Tarjeta>
  );
}

// =====================================================================
//  Calificación
// =====================================================================
function PanelCalificacion({
  pedidoId,
  ocupado,
  onCalificar,
}: {
  pedidoId: string;
  ocupado: boolean;
  onCalificar: (puntaje: number, comentario: string) => void;
}) {
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [yaCalifique, setYaCalifique] = useState<boolean | null>(null);

  useEffect(() => {
    api.miCalificacion(pedidoId).then((c) => {
      setYaCalifique(!!c);
      if (c) {
        setPuntaje(c.puntaje);
        setComentario(c.comentario);
      }
    });
  }, [pedidoId]);

  if (yaCalifique === null) return null;

  return (
    <Tarjeta>
      <Subtitulo>{yaCalifique ? 'Tu calificación' : 'Califica esta experiencia'}</Subtitulo>
      <Parrafo suave style={{ marginBottom: E.md }}>
        {yaCalifique
          ? 'Gracias. Tu calificación ya forma parte de la reputación pública.'
          : 'Tu calificación es lo que hará que el próximo cliente pueda confiar.'}
      </Parrafo>

      <View style={{ flexDirection: 'row', gap: E.sm, marginBottom: E.lg }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            disabled={yaCalifique}
            onPress={() => setPuntaje(n)}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: n <= puntaje ? C.naranja : C.blanco,
              borderWidth: 1.5,
              borderColor: n <= puntaje ? C.naranja : C.borde,
            }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '800',
                color: n <= puntaje ? C.blanco : C.textoSuave,
              }}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      {!yaCalifique && (
        <>
          <Campo
            etiqueta="Comentario"
            value={comentario}
            onChangeText={setComentario}
            multiline
            style={{ height: 76, textAlignVertical: 'top' }}
            placeholder="¿Cómo te fue? Opcional."
          />
          <Boton
            titulo="Enviar calificación"
            cargando={ocupado}
            deshabilitado={puntaje === 0}
            onPress={() => onCalificar(puntaje, comentario.trim())}
          />
        </>
      )}
    </Tarjeta>
  );
}

// =====================================================================
//  Chat interno
// =====================================================================
function Chat({
  mensajes,
  yo,
  onEnviar,
  enviando,
}: {
  mensajes: Mensaje[];
  yo: string;
  onEnviar: (texto: string) => void;
  enviando: boolean;
}) {
  const [texto, setTexto] = useState('');

  return (
    <Tarjeta>
      <Subtitulo>Conversación</Subtitulo>
      <Parrafo suave style={{ marginBottom: E.md }}>
        Todo queda dentro de la app. No hace falta intercambiar números de teléfono.
      </Parrafo>

      {mensajes.length === 0 ? (
        <Micro style={{ textAlign: 'center', paddingVertical: E.md }}>
          Todavía no hay mensajes.
        </Micro>
      ) : (
        mensajes.map((m) => {
          const mio = m.emisor_id === yo;
          return (
            <View
              key={m.id}
              style={{
                alignSelf: mio ? 'flex-end' : 'flex-start',
                backgroundColor: mio ? C.azulClaro : C.fondo,
                borderRadius: R.md,
                padding: E.sm + 2,
                marginBottom: E.sm,
                maxWidth: '85%',
              }}>
              <Parrafo style={{ fontSize: 14 }}>{m.cuerpo}</Parrafo>
              <Micro style={{ marginTop: 2 }}>{fechaHora(m.creado_en)}</Micro>
            </View>
          );
        })
      )}

      <View style={{ flexDirection: 'row', gap: E.sm, marginTop: E.sm }}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje…"
          placeholderTextColor="#98A6B8"
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: C.borde,
            borderRadius: R.md,
            paddingHorizontal: E.md,
            paddingVertical: 11,
            backgroundColor: C.blanco,
            color: C.texto,
          }}
        />
        <Boton
          titulo="Enviar"
          cargando={enviando}
          deshabilitado={!texto.trim()}
          style={{ height: 46, paddingHorizontal: E.lg }}
          onPress={() => {
            onEnviar(texto.trim());
            setTexto('');
          }}
        />
      </View>
    </Tarjeta>
  );
}
