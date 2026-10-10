import { Ionicons } from '@expo/vector-icons';
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
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/ui/Texto';
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
  hace,
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
  Reputacion,
} from '@/lib/tipos';
import {
  Aviso,
  Avatar,
  Boton,
  Campo,
  Cargando,
  Chip,
  Dato,
  Entrada,
  Estrellas,
  Etiqueta,
  Opciones,
  Seccion,
  Separador,
  Tarjeta,
  TarjetaDegradada,
  Vacio,
  type NombreIcono,
} from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { ICONO_ESTADO, estiloCategoria, iconoCategoria } from '@/ui/iconos';
import { Linea } from '@/ui/Linea';
import { OfertaItem } from '@/ui/OfertaItem';
import { useEscritorio } from '@/ui/escritorio';
import { C, E, G, R } from '@/ui/tema';

const YAPE_NUMERO = process.env.EXPO_PUBLIC_YAPE_NUMERO ?? '999 999 999';
const YAPE_TITULAR = process.env.EXPO_PUBLIC_YAPE_TITULAR ?? 'Encárgalo S.A.C.';

type Paso = {
  icono: NombreIcono;
  titulo: string;
  texto: string;
  fondo: string;
};

/**
 * Qué le toca hacer a quien está mirando, en una frase. Es lo primero que se
 * ve al abrir un pedido: en la demostración, las dos cuentas abren el mismo
 * pedido y cada una ve su propio «siguiente paso».
 */
function siguientePaso(opts: {
  pedido: Pedido;
  pago: Pago | null;
  ofertas: number;
  soyCliente: boolean;
  soyComprador: boolean;
  propia: Oferta | null;
}): Paso | null {
  const { pedido, pago, ofertas, soyCliente, soyComprador, propia } = opts;
  const e = pedido.estado;

  if (e === 'cancelado') return null;
  if (e === 'en_disputa') {
    return {
      icono: 'alert-circle',
      titulo: 'Caso en revisión',
      texto: 'El dinero sigue retenido mientras el equipo revisa la disputa.',
      fondo: G.peligro,
    };
  }

  if (soyCliente) {
    if (e === 'publicado')
      return ofertas > 0
        ? {
            icono: 'git-compare',
            titulo: `Tienes ${ofertas} oferta${ofertas === 1 ? '' : 's'}`,
            texto: 'Compara precio, fecha y reputación, y elige la que prefieras.',
            fondo: G.accion,
          }
        : {
            icono: 'megaphone',
            titulo: 'Esperando ofertas',
            texto: 'Los compradores externos verificados ya ven tu pedido. Te avisaremos.',
            fondo: G.marca,
          };
    if (e === 'aceptado')
      return pago?.estado === 'en_revision'
        ? {
            icono: 'hourglass',
            titulo: 'Validando tu pago',
            texto: 'En cuanto confirmemos que llegó, queda retenido y el comprador puede comprar.',
            fondo: G.alerta,
          }
        : {
            icono: 'wallet',
            titulo: `Paga ${soles(pago?.total_cobrado)} para asegurarlo`,
            texto: 'Tu dinero queda retenido por Encárgalo hasta que recibas el producto.',
            fondo: G.accion,
          };
    if (e === 'pagado' || e === 'comprado' || e === 'en_viaje')
      return {
        icono: 'shield-checkmark',
        titulo: 'Tu dinero está protegido',
        texto: 'Nadie lo recibe hasta que confirmes la entrega. Sigue el avance abajo.',
        fondo: G.dinero,
      };
    if (e === 'entregado')
      return {
        icono: 'cube',
        titulo: '¿Ya lo tienes en tus manos?',
        texto: 'Revísalo y confirma la recepción para liberar el pago.',
        fondo: G.accion,
      };
    if (e === 'confirmado')
      return {
        icono: 'checkmark-done-circle',
        titulo: 'Pedido completado',
        texto: 'Califica la experiencia: es lo que hace confiable al próximo cliente.',
        fondo: G.dinero,
      };
  }

  if (soyComprador) {
    if (e === 'aceptado')
      return {
        icono: 'time',
        titulo: 'Te eligieron. Espera el pago',
        texto: 'No compres todavía: te avisaremos cuando el dinero esté retenido.',
        fondo: G.alerta,
      };
    if (SIGUIENTE_PASO_COMPRADOR[e])
      return {
        icono: e === 'pagado' ? 'cart' : e === 'comprado' ? 'airplane' : 'cube',
        titulo:
          e === 'pagado'
            ? 'El pago está retenido: ya puedes comprar'
            : 'Te toca actualizar el avance',
        texto: 'Marca cada paso: el cliente lo ve al instante y sube tu puntualidad.',
        fondo: G.accion,
      };
    if (e === 'entregado')
      return {
        icono: 'hourglass',
        titulo: 'Esperando la confirmación del cliente',
        texto: `Al confirmar, recibes ${soles(pago?.monto_liberado)}.`,
        fondo: G.marca,
      };
    if (e === 'confirmado')
      return {
        icono: 'cash',
        titulo: `Pago liberado: ${soles(pago?.monto_liberado)}`,
        texto: 'Buen trabajo. Califica al cliente para cerrar el pedido.',
        fondo: G.dinero,
      };
  }

  if (e === 'publicado' && !soyCliente) {
    return propia
      ? {
          icono: 'paper-plane',
          titulo: 'Tu oferta está enviada',
          texto: 'El cliente está comparando. Te avisaremos si elige la tuya.',
          fondo: G.marca,
        }
      : {
          icono: 'pricetag',
          titulo: 'Envía tu oferta',
          texto: 'Pon tu precio final y la fecha en que lo entregas.',
          fondo: G.accion,
        };
  }
  return null;
}

export default function DetallePedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navegacion = useNavigation();
  const { perfil, esOperador } = useAuth();
  const { es: escritorio } = useEscritorio();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [ofertas, setOfertas] = useState<OfertaConReputacion[]>([]);
  const [propia, setPropia] = useState<Oferta | null>(null);
  const [pago, setPago] = useState<Pago | null>(null);
  const [eventos, setEventos] = useState<EventoPedido[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [contraparte, setContraparte] = useState<Reputacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [limite, setLimite] = useState<string | null>(null);
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const [verCancelar, setVerCancelar] = useState(false);

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

    // La otra parte del pedido, para mostrar con quién estás tratando
    if (pg) {
      const uid = perfil?.id;
      const otro =
        pg.cliente_id === uid ? pg.comprador_id : pg.comprador_id === uid ? pg.cliente_id : null;
      setContraparte(otro ? await api.reputacionDe(otro) : null);
    } else if (p.cliente_id !== perfil?.id) {
      setContraparte(await api.reputacionDe(p.cliente_id));
    } else {
      setContraparte(null);
    }
  }, [id, perfil?.id]);

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

  /** Ejecuta la acción y recarga. Devuelve true si la acción salió bien. */
  async function accion(clave: string, fn: () => Promise<unknown>): Promise<boolean> {
    setOcupado(clave);
    try {
      await fn();
    } catch (e) {
      avisar('No se pudo completar', (e as Error).message);
      setOcupado(null);
      return false;
    }
    // Si la recarga falla, la acción igual ya quedó hecha: no se reporta como error
    await cargar().catch(() => undefined);
    setOcupado(null);
    return true;
  }

  if (cargando) return <Cargando texto="Cargando el pedido…" />;
  if (!pedido) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fondo }}>
        <Vacio
          icono="search-outline"
          titulo="No encontramos este pedido"
          detalle="Puede que haya sido cancelado o que no tengas acceso a él."
          accion="Volver"
          onAccion={() => router.back()}
        />
      </View>
    );
  }

  const info = ESTADO_PEDIDO[pedido.estado];
  const masBarata = ofertas.length ? Math.min(...ofertas.map((o) => o.precio_final)) : null;
  const masRapida = ofertas.length ? ofertas.map((o) => o.fecha_entrega).sort()[0] : null;
  const foto = pedido.imagen_path ? api.urlPublica('productos', pedido.imagen_path) : null;
  const dias = diasHasta(pedido.fecha_limite);
  const paso = siguientePaso({
    pedido,
    pago,
    ofertas: ofertas.length,
    soyCliente,
    soyComprador,
    propia,
  });
  const participo = soyCliente || soyComprador;

  const bloquePortada = (
    <>
        {/* ---------------------------------------------------- portada */}
        <Entrada>
          <View style={s.portada}>
            {foto ? (
              // contain y no cover: es la foto del producto que se pide, tiene
              // que verse entera, como en una tienda.
              <View style={[s.portadaMarco, escritorio && s.portadaMarcoGrande]}>
                <Image source={{ uri: foto }} style={s.portadaFoto} resizeMode="contain" />
              </View>
            ) : (
              <View
                style={[
                  s.portadaMarco,
                  escritorio && s.portadaMarcoGrande,
                  s.portadaIcono,
                  { backgroundColor: estiloCategoria(pedido.categoria).fondo },
                ]}>
                <Ionicons
                  name={estiloCategoria(pedido.categoria).icono}
                  size={64}
                  color={estiloCategoria(pedido.categoria).color}
                />
              </View>
            )}
            <View style={s.portadaCuerpo}>
              <Chip texto={info.etiqueta} color={info.color} icono={ICONO_ESTADO[pedido.estado]} />
              <Text style={[s.titulo, escritorio && { fontSize: 26 }]}>{pedido.titulo}</Text>
              {pedido.valor_referencial != null && (
                <View style={s.precioFila}>
                  <Text style={s.precio}>{soles(pedido.valor_referencial)}</Text>
                  <Text style={s.precioEtiqueta}>valor referencial del producto</Text>
                </View>
              )}
              {!!pedido.descripcion && <Text style={s.descripcion}>{pedido.descripcion}</Text>}
              {!!pedido.url_producto && (
                <Pressable
                  onPress={() => Linking.openURL(pedido.url_producto!)}
                  style={({ pressed }) => [s.enlace, pressed && { opacity: 0.8 }]}>
                  <Ionicons name="open-outline" size={16} color={C.naranja} />
                  <Text style={s.enlaceTexto} numberOfLines={1}>
                    Ver el producto original
                  </Text>
                </Pressable>
              )}
  
              <View style={s.datos}>
                <DatoCaja
                  icono={iconoCategoria(pedido.categoria)}
                  etiqueta="Categoría"
                  valor={pedido.categoria}
                />
                <DatoCaja
                  icono="layers-outline"
                  etiqueta="Cantidad"
                  valor={String(pedido.cantidad)}
                />
                <DatoCaja
                  icono="location-outline"
                  etiqueta="Entrega en"
                  valor={pedido.ciudad_entrega}
                />
                <DatoCaja
                  icono="calendar-outline"
                  etiqueta="Fecha límite"
                  valor={fecha(pedido.fecha_limite)}
                  alerta={pedido.estado === 'publicado' && dias <= 3}
                />
                <DatoCaja
                  icono="time-outline"
                  etiqueta="Publicado"
                  valor={hace(pedido.creado_en)}
                />
              </View>
            </View>
          </View>
        </Entrada>
    </>
  );

  const bloqueAcciones = (
    <>
        {/* ---------------------------------------------------- siguiente paso */}
        {paso && (
          <Entrada i={1}>
            <TarjetaDegradada fondo={paso.fondo} style={{ padding: E.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: E.md }}>
                <View style={s.pasoIcono}>
                  <Ionicons name={paso.icono} size={24} color={C.sobreOscuro} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pasoAnte}>Siguiente paso</Text>
                  <Text style={s.pasoTitulo}>{paso.titulo}</Text>
                  <Text style={s.pasoTexto}>{paso.texto}</Text>
                </View>
              </View>
            </TarjetaDegradada>
          </Entrada>
        )}
  
        {/* ---------------------------------------------------- contraparte */}
        {contraparte && (
          <Entrada i={2}>
            <Tarjeta onPress={() => router.push(`/reputacion/${contraparte.perfil_id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: E.md }}>
                <Avatar
                  nombre={contraparte.nombre_completo}
                  tamano={48}
                  verificado={contraparte.verificacion === 'verificado'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.contraparteRol}>
                    {soyCliente ? 'Te lo trae' : participo ? 'Tu cliente' : 'Lo pide'}
                  </Text>
                  <Text style={s.contraparteNombre} numberOfLines={1}>
                    {contraparte.nombre_completo}
                  </Text>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Estrellas valor={Number(contraparte.calificacion ?? 0)} tamano={12} />
                    <Text style={s.contraparteMeta}>
                      {contraparte.pedidos_cumplidos} cumplido
                      {contraparte.pedidos_cumplidos === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textoSuave} />
              </View>
            </Tarjeta>
          </Entrada>
        )}
  
        {/* ---------------------------------------------------- ofertas */}
        {pedido.estado === 'publicado' && soyCliente && (
          <>
            <Seccion
              titulo={ofertas.length === 0 ? 'Ofertas' : 'Ofertas recibidas'}
              icono="pricetags-outline"
              conteo={ofertas.length}
              style={{ marginTop: E.md }}
            />
            {ofertas.length === 0 ? (
              <Tarjeta style={{ alignItems: 'center', paddingVertical: E.xl }}>
                <View style={s.esperaIcono}>
                  <Ionicons name="hourglass-outline" size={28} color={C.azulMedio} />
                </View>
                <Text style={s.esperaTitulo}>Aún no hay ofertas</Text>
                <Text style={s.esperaTexto}>
                  En cuanto alguien oferte te avisaremos. No pagas nada hasta elegir.
                </Text>
              </Tarjeta>
            ) : (
              <Text style={s.nota}>
                La más barata no siempre es la mejor decisión: mira también la reputación.
              </Text>
            )}
            {ofertas.map((o, i) => (
              <Entrada key={o.id} i={i}>
                <OfertaItem
                  oferta={o}
                  masBarata={ofertas.length > 1 && o.precio_final === masBarata}
                  masRapida={ofertas.length > 1 && o.fecha_entrega === masRapida}
                  puedeAceptar
                  aceptando={ocupado === `aceptar-${o.id}`}
                  onAceptar={async () => {
                    const seguro = await confirmar(
                      'Elegir esta oferta',
                      `Vas a aceptar la oferta de ${soles(o.precio_final)} con entrega el ${fecha(
                        o.fecha_entrega,
                      )}.\n\nLas demás ofertas quedarán descartadas y se generará tu orden de pago.`,
                      'Aceptar oferta',
                    );
                    if (!seguro) return;
                    accion(`aceptar-${o.id}`, () => api.aceptarOferta(o.id));
                  }}
                />
              </Entrada>
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
              accion('ofertar', () => api.ofertar(pedido.id, precio, fechaEntrega, nota))
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
            onConfirmarRetencion={() => accion('retener', () => api.confirmarRetencion(pedido.id))}
          />
        )}
  
        {/* ------------------------------------ acciones del comprador */}
        {soyComprador && SIGUIENTE_PASO_COMPRADOR[pedido.estado] && (
          <Tarjeta style={{ borderColor: `${C.naranja}66`, borderWidth: 1.5 }}>
            <Seccion titulo="Tu turno" icono="flash-outline" style={{ marginTop: 0 }} />
            <Text style={s.nota}>
              El cliente ve cada paso que marcas. Mantenerlo informado es lo que sube tu puntualidad
              y tu reputación.
            </Text>
            <Boton
              titulo={SIGUIENTE_PASO_COMPRADOR[pedido.estado]!.accion}
              icono={ICONO_ESTADO[SIGUIENTE_PASO_COMPRADOR[pedido.estado]!.siguiente]}
              cargando={ocupado === 'avanzar'}
              onPress={() =>
                accion('avanzar', () =>
                  api.avanzarPedido(pedido.id, SIGUIENTE_PASO_COMPRADOR[pedido.estado]!.siguiente),
                )
              }
            />
          </Tarjeta>
        )}
  
        {/* ------------------------------------ confirmación del cliente */}
        {soyCliente && pedido.estado === 'entregado' && (
          <Tarjeta style={{ borderColor: C.verde, borderWidth: 2 }}>
            <Seccion titulo="¿Recibiste tu pedido?" icono="cube-outline" style={{ marginTop: 0 }} />
            <Text style={s.nota}>
              Revisa que sea lo que pediste antes de confirmar. Al confirmar, liberamos{' '}
              {soles(pago?.monto_liberado)} al comprador externo y ya no podremos retenerlo.
            </Text>
  
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
              icono="checkmark-done"
              variante="exito"
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
  
        {/* ---------------------------------------------------- calificar */}
        {pedido.estado === 'confirmado' && participo && (
          <PanelCalificacion
            pedidoId={pedido.id}
            ocupado={ocupado === 'calificar'}
            onCalificar={(puntaje, comentario) =>
              accion('calificar', () => api.calificar(pedido.id, puntaje, comentario))
            }
          />
        )}
    </>
  );

  const bloqueSeguimiento = (
    <>
        {/* ---------------------------------------------------- seguimiento */}
        <Seccion titulo="Seguimiento" icono="git-network-outline" style={{ marginTop: E.md }} />
        <Tarjeta>
          <Linea estado={pedido.estado} eventos={eventos} />
        </Tarjeta>
    </>
  );

  const bloqueFinal = (
    <>
        {/* ---------------------------------------------------- chat */}
        {participo && pedido.estado !== 'publicado' && (
          <Chat
            mensajes={mensajes}
            yo={perfil?.id ?? ''}
            otro={contraparte?.nombre_completo ?? ''}
            onEnviar={(texto) => accion('mensaje', () => api.enviarMensaje(pedido.id, texto))}
            enviando={ocupado === 'mensaje'}
          />
        )}
  
        {/* ------------------------------------ disputa */}
        {participo && DISPUTABLES.includes(pedido.estado) && (
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
        {soyCliente && CANCELABLES.includes(pedido.estado) && pago?.estado !== 'en_revision' && (
          <Tarjeta>
            {!verCancelar ? (
              <Pressable onPress={() => setVerCancelar(true)} style={s.plegado}>
                <Ionicons name="close-circle-outline" size={20} color={C.rojo} />
                <Text style={[s.plegadoTexto, { color: C.rojo }]}>Ya no lo necesito</Text>
                <Ionicons name="chevron-down" size={18} color={C.textoSuave} />
              </Pressable>
            ) : (
              <>
                <Seccion
                  titulo="Cancelar el pedido"
                  icono="close-circle-outline"
                  style={{ marginTop: 0 }}
                />
                <Text style={s.nota}>
                  Puedes cancelar mientras no hayas reportado el pago. Las ofertas recibidas quedan
                  descartadas y quien ofertó recibe un aviso.
                </Text>
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
                      avisar(
                        'Falta el motivo',
                        'Cuéntale en pocas palabras a quien te ofertó por qué cancelas.',
                      );
                      return;
                    }
                    const seguro = await confirmar(
                      'Cancelar el pedido',
                      'Se descartarán las ofertas recibidas y el pedido dejará de estar visible. No se puede deshacer.',
                      'Cancelar el pedido',
                      true,
                    );
                    if (!seguro) return;
                    accion('cancelar', () => api.cancelarPedido(pedido.id, motivoCancelar.trim()));
                  }}
                />
                <Boton
                  titulo="Mejor no"
                  variante="fantasma"
                  onPress={() => setVerCancelar(false)}
                  style={{ marginTop: E.sm }}
                />
              </>
            )}
          </Tarjeta>
        )}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <ScrollView
        contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={async () => {
              setRefrescando(true);
              await cargar().catch(() => undefined);
              setRefrescando(false);
            }}
          />
        }>
        {escritorio ? (
          // En escritorio, como la página de un producto: a la izquierda lo
          // que se pide (foto, datos, avance) y a la derecha lo que hay que
          // hacer (siguiente paso, ofertas, pago, chat).
          <View style={s.columnas}>
            <View style={s.columnaProducto}>
              {bloquePortada}
              {bloqueSeguimiento}
            </View>
            <View style={s.columnaAcciones}>
              {bloqueAcciones}
              {bloqueFinal}
            </View>
          </View>
        ) : (
          <>
            {bloquePortada}
            {bloqueAcciones}
            {bloqueSeguimiento}
            {bloqueFinal}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Caja de dato del pedido: icono, etiqueta y valor, en rejilla de dos. */
function DatoCaja({
  icono,
  etiqueta,
  valor,
  alerta,
}: {
  icono: NombreIcono;
  etiqueta: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <View style={[s.datoCaja, alerta && { backgroundColor: C.naranjaClaro }]}>
      <Ionicons name={icono} size={16} color={alerta ? C.naranja : C.azulMedio} />
      <View style={{ flex: 1 }}>
        <Text style={s.datoEtiqueta}>{etiqueta}</Text>
        <Text style={[s.datoValor, alerta && { color: C.naranja }]} numberOfLines={1}>
          {valor}
        </Text>
      </View>
    </View>
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
  // Solo plazos que caben en la fecha límite del cliente; si ninguno cabe,
  // se ofrece justo los días que quedan.
  const diasHastaLimite = Math.max(
    1,
    Math.floor(
      (new Date(`${pedido.fecha_limite}T12:00:00`).getTime() - new Date().setHours(12, 0, 0, 0)) /
        86_400_000,
    ),
  );
  const plazos = [
    { valor: '7', etiqueta: '1 semana' },
    { valor: '14', etiqueta: '2 semanas' },
    { valor: '21', etiqueta: '3 semanas' },
    { valor: '35', etiqueta: '5 semanas' },
  ].filter((o) => Number(o.valor) <= diasHastaLimite);
  if (plazos.length === 0) {
    plazos.push({
      valor: String(diasHastaLimite),
      etiqueta: `${diasHastaLimite} día${diasHastaLimite === 1 ? '' : 's'}`,
    });
  }
  const [dias, setDias] = useState(plazos[Math.min(2, plazos.length - 1)].valor);
  const precioNum = Number(precio.replace(',', '.'));
  const [nota, setNota] = useState('');
  const [desglose, setDesglose] = useState<DesglosePrecio | null>(null);

  useEffect(() => {
    const n = Number(precio.replace(',', '.'));
    if (!precio || Number.isNaN(n) || n <= 0) {
      setDesglose(null);
      return;
    }
    let vivo = true;
    // Un respiro para no pedir el desglose en cada tecla
    const reloj = setTimeout(() => {
      api
        .desglosePrecio(n)
        .then((d) => vivo && setDesglose(d))
        .catch(() => vivo && setDesglose(null));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [precio]);

  if (propia) {
    return (
      <Tarjeta style={{ borderColor: `${C.azulMedio}55`, borderWidth: 1.5 }}>
        <Seccion
          titulo="Tu oferta está enviada"
          icono="paper-plane-outline"
          style={{ marginTop: 0 }}
        />
        <View style={s.ofertaPropia}>
          <View>
            <Text style={s.datoEtiqueta}>Precio ofertado</Text>
            <Text style={s.ofertaPropiaPrecio}>{soles(propia.precio_final)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.datoEtiqueta}>Entrega</Text>
            <Text style={s.datoValor}>{fecha(propia.fecha_entrega)}</Text>
          </View>
        </View>
        <Text style={[s.nota, { marginTop: E.md }]}>
          El cliente está comparando las ofertas. Te avisaremos si elige la tuya.
        </Text>
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

  // Fecha local (no UTC): de noche en Perú, toISOString ya daría el día siguiente
  function enDias(n: number) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  return (
    <Tarjeta>
      <Seccion titulo="Enviar mi oferta" icono="pricetag-outline" style={{ marginTop: 0 }} />
      <Text style={s.nota}>
        Indica el precio final que le cobrarías al cliente, ya con tu recompensa incluida. La fecha
        límite del cliente es el {fecha(pedido.fecha_limite)}.
      </Text>

      <Campo
        etiqueta="Precio final para el cliente (S/)"
        icono="cash-outline"
        value={precio}
        onChangeText={setPrecio}
        keyboardType="decimal-pad"
        placeholder={
          pedido.valor_referencial ? String(Math.round(pedido.valor_referencial * 1.15)) : '491.40'
        }
      />

      <Etiqueta>¿En cuánto tiempo lo entregas?</Etiqueta>
      <View style={{ marginBottom: E.lg }}>
        <Opciones valor={dias} onChange={setDias} opciones={plazos} />
        <Text style={[s.datoEtiqueta, { marginTop: E.sm }]}>
          Entregarías el {fecha(enDias(Number(dias)))}
        </Text>
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
        <View style={s.desglose}>
          <View style={s.desgloseFila}>
            <Text style={s.desgloseEtiqueta}>El cliente paga</Text>
            <Text style={s.desgloseValor}>{soles(desglose.total)}</Text>
          </View>
          <View style={s.desgloseFila}>
            <Text style={s.desgloseEtiqueta}>Tarifa de servicio</Text>
            <Text style={s.desgloseValor}>− {soles(desglose.tarifa_comprador)}</Text>
          </View>
          <View style={[s.desgloseFila, s.desgloseTotal]}>
            <Text style={[s.desgloseEtiqueta, { color: C.verde, fontWeight: '800' }]}>
              Tú recibes al entregar
            </Text>
            <Text style={s.desgloseRecibe}>{soles(desglose.recibe_comprador)}</Text>
          </View>
        </View>
      )}

      <Boton
        titulo="Enviar oferta"
        icono="paper-plane"
        cargando={ocupado}
        deshabilitado={!precio || Number.isNaN(precioNum) || precioNum <= 0}
        onPress={() => onOfertar(precioNum, enDias(Number(dias)), nota.trim())}
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
  const protegido = pago.estado === 'retenido' || pago.estado === 'liberado';

  async function elegirComprobante() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]) setComprobante(res.assets[0].uri);
  }

  return (
    <>
      <Seccion
        titulo="Pago protegido"
        icono="shield-checkmark-outline"
        style={{ marginTop: E.md }}
      />
      <TarjetaDegradada
        fondo={protegido ? G.dinero : pago.estado === 'reembolsado' ? G.marca : G.noche}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip
            texto={info.etiqueta}
            color={C.sobreOscuro}
            fondo="rgba(242,235,225,0.14)"
            icono={protegido ? 'lock-closed' : 'time'}
          />
          <Ionicons name="shield-checkmark" size={26} color={C.trigo} />
        </View>
        <Text style={s.dineroEtiqueta}>
          {soyCliente ? 'Total a pagar' : 'Recibirás al entregar'}
        </Text>
        <Text style={s.dineroMonto}>
          {soles(soyCliente ? pago.total_cobrado : pago.monto_liberado)}
        </Text>
        <Text style={s.dineroDetalle}>{info.detalle}</Text>
      </TarjetaDegradada>

      <Tarjeta>
        <Dato
          icono="pricetag-outline"
          etiqueta="Producto y recompensa"
          valor={soles(pago.monto_encargo)}
        />
        <Dato
          icono="briefcase-outline"
          etiqueta="Comisión de servicio"
          valor={soles(pago.comision_cliente)}
        />
        <Dato
          icono="card-outline"
          etiqueta="Procesamiento del pago"
          valor={soles(pago.cargo_procesamiento)}
        />
        <Separador />
        <Dato etiqueta="Total que paga el cliente" valor={soles(pago.total_cobrado)} fuerte />
        {!soyCliente && (
          <>
            <Dato
              icono="remove-circle-outline"
              etiqueta="Tarifa al comprador externo"
              valor={`− ${soles(pago.tarifa_comprador)}`}
            />
            <Dato
              etiqueta="Recibe el comprador externo"
              valor={soles(pago.monto_liberado)}
              fuerte
            />
          </>
        )}

        {soyCliente && pago.estado === 'pendiente' && (
          <View style={{ marginTop: E.lg }}>
            <View style={s.yape}>
              <View style={s.yapeIcono}>
                <Ionicons name="phone-portrait" size={22} color={C.blanco} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.yapeEtiqueta}>Yapea {soles(pago.total_cobrado)} al</Text>
                <Text selectable style={s.yapeNumero}>
                  {YAPE_NUMERO}
                </Text>
                <Text style={s.yapeTitular}>{YAPE_TITULAR}</Text>
              </View>
            </View>
            <Text style={[s.nota, { marginTop: E.md }]}>
              Después sube la captura. El comprador externo no recibe tu dinero hasta que confirmes
              que llegó tu producto.
            </Text>

            <Etiqueta>Método de pago</Etiqueta>
            <View style={{ marginBottom: E.lg }}>
              <Opciones
                valor={metodo}
                onChange={setMetodo}
                opciones={[
                  {
                    valor: 'yape' as MetodoPago,
                    etiqueta: 'Yape',
                    icono: 'phone-portrait-outline',
                  },
                  {
                    valor: 'plin' as MetodoPago,
                    etiqueta: 'Plin',
                    icono: 'phone-portrait-outline',
                  },
                  {
                    valor: 'transferencia' as MetodoPago,
                    etiqueta: 'Transferencia',
                    icono: 'business-outline',
                  },
                ]}
              />
            </View>

            <Campo
              etiqueta="Código de operación"
              icono="barcode-outline"
              value={codigo}
              onChangeText={setCodigo}
              placeholder="El número que aparece en tu constancia"
            />

            <Pressable
              onPress={elegirComprobante}
              style={({ pressed }) => [
                s.comprobante,
                comprobante && s.comprobanteListo,
                pressed && { opacity: 0.85 },
              ]}>
              {comprobante ? (
                <>
                  <Image
                    source={{ uri: comprobante }}
                    style={s.comprobanteImagen}
                    resizeMode="cover"
                  />
                  <View style={s.comprobantePie}>
                    <Ionicons name="checkmark-circle" size={16} color={C.verde} />
                    <Text style={s.comprobantePieTexto}>
                      Comprobante listo · tocar para cambiar
                    </Text>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', gap: E.xs }}>
                  <Ionicons name="cloud-upload-outline" size={28} color={C.azulMedio} />
                  <Text style={s.comprobanteTexto}>Subir captura del pago</Text>
                </View>
              )}
            </Pressable>

            <Boton
              titulo="Ya pagué"
              icono="checkmark-circle"
              cargando={ocupado === 'reportar'}
              deshabilitado={!codigo.trim() || !comprobante}
              onPress={() => onReportar(metodo, codigo.trim(), comprobante!)}
            />
          </View>
        )}

        {pago.estado === 'en_revision' && (
          <View style={{ marginTop: E.md }}>
            <Aviso tono="alerta" titulo="Validando el pago">
              Recibimos el comprobante ({pago.codigo_operacion}). En cuanto el equipo confirme que
              el dinero llegó, el pedido pasa a «pago retenido».
            </Aviso>
            {/* Durante el piloto la retención la confirma a mano el equipo.
                El botón solo aparece para quien figura en la tabla operadores. */}
            {esOperador && (
              <Boton
                titulo="Equipo: el dinero llegó, retener"
                icono="lock-closed"
                variante="secundario"
                cargando={ocupado === 'retener'}
                onPress={onConfirmarRetencion}
              />
            )}
          </View>
        )}

        {pago.estado === 'liberado' && (
          <>
            <Separador />
            <Dato
              icono="lock-open-outline"
              etiqueta="Liberado el"
              valor={fechaHora(pago.liberado_en)}
            />
          </>
        )}
      </Tarjeta>
    </>
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
  onAbrir: (motivo: string, evidencia: string | null) => Promise<boolean>;
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
        <Pressable onPress={() => setAbierto(true)} style={s.plegado}>
          <Ionicons name="flag-outline" size={20} color={C.ambar} />
          <Text style={[s.plegadoTexto, { color: C.ambar }]}>
            Tengo un problema con este pedido
          </Text>
          <Ionicons name="chevron-down" size={18} color={C.textoSuave} />
        </Pressable>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta style={{ borderColor: C.rojo, borderWidth: 1.5 }}>
      <Seccion titulo="Abrir una disputa" icono="flag-outline" style={{ marginTop: 0 }} />
      <Text style={s.nota}>
        {soyCliente
          ? 'El pedido queda congelado y tu dinero sigue retenido mientras el equipo revisa el caso. Nadie recibe el pago hasta que se resuelva.'
          : 'Úsalo si no vas a poder entregar o si el cliente no responde. El equipo revisa el caso y decide qué pasa con el dinero retenido.'}
      </Text>

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
        style={[s.comprobante, evidencia && s.comprobanteListo, { padding: E.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: E.sm }}>
          <Ionicons
            name={evidencia ? 'checkmark-circle' : 'attach'}
            size={20}
            color={evidencia ? C.verde : C.azulMedio}
          />
          <Text style={[s.comprobanteTexto, evidencia && { color: C.verde }]}>
            {evidencia ? 'Evidencia lista · tocar para cambiar' : 'Adjuntar una foto (opcional)'}
          </Text>
        </View>
      </Pressable>

      <Boton
        titulo="Abrir disputa"
        icono="flag"
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
          // Si falla, lo escrito se conserva para reintentar
          if (!(await onAbrir(motivo.trim(), evidencia))) return;
          setAbierto(false);
          setMotivo('');
          setEvidencia(null);
        }}
      />
      <Boton
        titulo="Cancelar"
        variante="fantasma"
        onPress={() => setAbierto(false)}
        style={{ marginTop: E.sm }}
      />
    </Tarjeta>
  );
}

// =====================================================================
//  Calificación
// =====================================================================
const PALABRAS = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', '¡Excelente!'];

function PanelCalificacion({
  pedidoId,
  ocupado,
  onCalificar,
}: {
  pedidoId: string;
  ocupado: boolean;
  onCalificar: (puntaje: number, comentario: string) => Promise<boolean>;
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
    <Tarjeta style={{ alignItems: 'center' }}>
      <View style={s.calificarIcono}>
        <Ionicons name={yaCalifique ? 'heart' : 'star'} size={28} color={C.estrella} />
      </View>
      <Text style={s.calificarTitulo}>
        {yaCalifique ? 'Tu calificación' : 'Califica esta experiencia'}
      </Text>
      <Text style={[s.nota, { textAlign: 'center' }]}>
        {yaCalifique
          ? 'Gracias. Tu calificación ya forma parte de la reputación pública.'
          : 'Tu calificación es lo que hará que el próximo cliente pueda confiar.'}
      </Text>

      <Estrellas valor={puntaje} tamano={38} onCambiar={yaCalifique ? undefined : setPuntaje} />
      <Text style={s.calificarPalabra}>{PALABRAS[puntaje] || 'Toca una estrella'}</Text>

      {yaCalifique ? (
        !!comentario && <Text style={s.calificarComentario}>“{comentario}”</Text>
      ) : (
        <View style={{ alignSelf: 'stretch', marginTop: E.lg }}>
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
            icono="send"
            cargando={ocupado}
            deshabilitado={puntaje === 0}
            onPress={async () => {
              if (await onCalificar(puntaje, comentario.trim())) setYaCalifique(true);
            }}
          />
        </View>
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
  otro,
  onEnviar,
  enviando,
}: {
  mensajes: Mensaje[];
  yo: string;
  otro: string;
  onEnviar: (texto: string) => void;
  enviando: boolean;
}) {
  const [texto, setTexto] = useState('');

  return (
    <>
      <Seccion
        titulo="Conversación"
        icono="chatbubbles-outline"
        conteo={mensajes.length}
        style={{ marginTop: E.md }}
      />
      <Tarjeta style={{ padding: E.md }}>
        <View style={s.chatAviso}>
          <Ionicons name="lock-closed" size={12} color={C.textoSuave} />
          <Text style={s.chatAvisoTexto}>
            Todo queda dentro de la app. No hace falta intercambiar números.
          </Text>
        </View>

        {mensajes.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: E.lg }}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color={C.bordeFuerte} />
            <Text style={[s.nota, { marginTop: E.sm, marginBottom: 0 }]}>
              Todavía no hay mensajes. Saluda para coordinar la entrega.
            </Text>
          </View>
        ) : (
          mensajes.map((m) => {
            const mio = m.emisor_id === yo;
            return (
              <View key={m.id} style={[s.burbujaFila, mio && { justifyContent: 'flex-end' }]}>
                {!mio && <Avatar nombre={otro} tamano={28} />}
                <View style={[s.burbuja, mio ? s.burbujaMia : s.burbujaSuya]}>
                  <Text style={[s.burbujaTexto, mio && { color: C.blanco }]}>{m.cuerpo}</Text>
                  <Text style={[s.burbujaHora, mio && { color: 'rgba(242,235,225,0.7)' }]}>
                    {hace(m.creado_en)}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        <View style={s.chatEntrada}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={C.grisTexto}
            multiline
            style={s.chatCampo}
          />
          <Pressable
            disabled={!texto.trim() || enviando}
            onPress={() => {
              onEnviar(texto.trim());
              setTexto('');
            }}
            accessibilityLabel="Enviar mensaje"
            style={({ pressed }) => [
              s.chatEnviar,
              (!texto.trim() || enviando) && { opacity: 0.4 },
              pressed && { transform: [{ scale: 0.94 }] },
            ]}>
            <Ionicons name="send" size={18} color={C.blanco} />
          </Pressable>
        </View>
      </Tarjeta>
    </>
  );
}

const s = StyleSheet.create({
  portada: {
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    overflow: 'hidden',
    marginBottom: E.md,
    borderWidth: 1,
    borderColor: C.borde,
  },
  portadaMarco: {
    width: '100%',
    height: 260,
    backgroundColor: C.blanco,
    borderBottomWidth: 1,
    borderBottomColor: C.borde,
    padding: E.md,
  },
  portadaMarcoGrande: { height: 420, padding: E.xl },
  portadaFoto: { width: '100%', height: '100%' },
  portadaIcono: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  precioFila: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: E.sm, marginTop: E.sm },
  precio: { fontSize: 26, fontWeight: '800', color: C.azul, letterSpacing: -0.6 },
  precioEtiqueta: { fontSize: 13, color: C.textoSuave },
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: E.xl },
  columnaProducto: { flex: 1.15, minWidth: 0 },
  columnaAcciones: { flex: 1, minWidth: 0 },
  portadaCuerpo: { padding: E.lg + 2 },
  titulo: {
    fontSize: 21,
    fontWeight: '800',
    color: C.texto,
    letterSpacing: -0.4,
    marginTop: E.sm,
  },
  descripcion: { fontSize: 14.5, color: C.textoSuave, lineHeight: 21, marginTop: E.xs },
  enlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.naranjaClaro,
    paddingHorizontal: E.md,
    paddingVertical: E.sm,
    borderRadius: 999,
    marginTop: E.md,
  },
  enlaceTexto: { color: C.naranjaOscuro, fontWeight: '600', fontSize: 13.5 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: E.sm, marginTop: E.lg },
  datoCaja: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm,
    backgroundColor: C.superficieSuave,
    borderRadius: R.md,
    padding: E.sm + 2,
  },
  datoEtiqueta: { fontSize: 11.5, color: C.textoSuave, fontWeight: '600' },
  datoValor: { fontSize: 14, color: C.texto, fontWeight: '600' },

  pasoIcono: {
    width: 50,
    height: 50,
    borderRadius: R.md,
    backgroundColor: 'rgba(242,235,225,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoAnte: {
    color: C.trigo,
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  pasoTitulo: {
    color: C.sobreOscuro,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  pasoTexto: { color: 'rgba(242,235,225,0.85)', fontSize: 13.5, lineHeight: 19, marginTop: 2 },

  contraparteRol: { fontSize: 12, color: C.textoSuave, fontWeight: '700' },
  contraparteNombre: { fontSize: 16, color: C.texto, fontWeight: '800' },
  contraparteMeta: { fontSize: 12, color: C.textoSuave },

  nota: { fontSize: 14, color: C.textoSuave, lineHeight: 21, marginBottom: E.md },

  esperaIcono: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.md,
  },
  esperaTitulo: { fontSize: 16.5, fontWeight: '800', color: C.azul },
  esperaTexto: {
    fontSize: 14,
    color: C.textoSuave,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },

  ofertaPropia: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: C.azulFondo,
    borderRadius: R.md,
    padding: E.md,
  },
  ofertaPropiaPrecio: { fontSize: 24, fontWeight: '800', color: C.azul, letterSpacing: -0.6 },

  desglose: {
    backgroundColor: C.verdeClaro,
    borderRadius: R.md,
    padding: E.md,
    marginBottom: E.lg,
    gap: 6,
  },
  desgloseFila: { flexDirection: 'row', justifyContent: 'space-between' },
  desgloseEtiqueta: { fontSize: 13.5, color: C.verdeOscuro },
  desgloseValor: { fontSize: 13.5, color: C.verdeOscuro, fontWeight: '700' },
  desgloseTotal: {
    borderTopWidth: 1,
    borderTopColor: `${C.verde}40`,
    paddingTop: 8,
    marginTop: 2,
    alignItems: 'center',
  },
  desgloseRecibe: { fontSize: 20, color: C.verde, fontWeight: '800' },

  dineroEtiqueta: {
    color: C.trigo,
    fontSize: 13,
    fontWeight: '600',
    marginTop: E.lg,
  },
  dineroMonto: { color: C.sobreOscuro, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  dineroDetalle: { color: 'rgba(242,235,225,0.85)', fontSize: 13.5, lineHeight: 19, marginTop: 4 },

  yape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    backgroundColor: '#F3EBFF',
    borderRadius: R.md,
    padding: E.md,
    borderWidth: 1,
    borderColor: '#DCC8FB',
  },
  yapeIcono: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#742284',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yapeEtiqueta: { fontSize: 12.5, color: '#5B1A69', fontWeight: '700' },
  yapeNumero: { fontSize: 22, color: '#4A1356', fontWeight: '800', letterSpacing: 1 },
  yapeTitular: { fontSize: 12.5, color: '#5B1A69' },

  comprobante: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.bordeFuerte,
    borderRadius: R.md,
    padding: E.lg,
    marginBottom: E.lg,
    backgroundColor: C.azulFondo,
    overflow: 'hidden',
    alignItems: 'center',
  },
  comprobanteListo: { borderStyle: 'solid', borderColor: C.verde, padding: 0 },
  comprobanteTexto: { color: C.azul, fontWeight: '800', fontSize: 14.5 },
  comprobanteImagen: { width: '100%', height: 160 },
  comprobantePie: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: E.sm },
  comprobantePieTexto: { color: C.verde, fontWeight: '800', fontSize: 13 },

  plegado: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  plegadoTexto: { flex: 1, fontSize: 15, fontWeight: '800' },

  calificarIcono: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.trigoClaro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.md,
  },
  calificarTitulo: { fontSize: 18, fontWeight: '800', color: C.azul, marginBottom: E.xs },
  calificarPalabra: { fontSize: 14, fontWeight: '800', color: C.ambar, marginTop: E.sm },
  calificarComentario: {
    fontSize: 15,
    color: C.texto,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: E.md,
  },

  chatAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: C.superficieSuave,
    paddingHorizontal: E.md,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: E.md,
  },
  chatAvisoTexto: { fontSize: 11.5, color: C.textoSuave, fontWeight: '600' },
  burbujaFila: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: E.sm },
  burbuja: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: E.md,
    paddingVertical: E.sm + 1,
  },
  burbujaMia: { backgroundColor: C.azul, borderBottomRightRadius: 5 },
  burbujaSuya: { backgroundColor: C.superficieSuave, borderBottomLeftRadius: 5 },
  burbujaTexto: { fontSize: 14.5, color: C.texto, lineHeight: 20 },
  burbujaHora: { fontSize: 10.5, color: C.textoSuave, marginTop: 2, alignSelf: 'flex-end' },
  chatEntrada: { flexDirection: 'row', alignItems: 'flex-end', gap: E.sm, marginTop: E.sm },
  chatCampo: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 22,
    paddingHorizontal: E.lg,
    paddingTop: 11,
    paddingBottom: 11,
    maxHeight: 110,
    backgroundColor: C.blanco,
    color: C.texto,
    fontSize: 15,
  },
  chatEnviar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: C.naranja,
  },
});
