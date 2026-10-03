import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as api from '@/lib/api';
import { ESTADO_PEDIDO, fechaHora, hace, soles } from '@/lib/negocio';
import type {
  ConfirmacionVencida,
  DisputaAbierta,
  PagoPendiente,
  ResultadoDni,
  VerificacionPendiente,
} from '@/lib/tipos';
import {
  Avatar,
  Boton,
  Cabecera,
  Cargando,
  Chip,
  Cifra,
  Dato,
  Entrada,
  FilaCifras,
  Micro,
  Parrafo,
  Seccion,
  Separador,
  Tarjeta,
  Vacio,
} from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { C, E, G, R } from '@/ui/tema';

type Cola = 'verificaciones' | 'pagos' | 'vencidas' | 'disputas';

/** Lo que dijo RENIEC, como insignia: verde, rojo o gris. */
function InsigniaReniec({ r }: { r: ResultadoDni | null }) {
  const conf =
    r === 'coincide'
      ? { texto: 'RENIEC: el nombre coincide', color: C.verde, icono: 'checkmark-circle' as const }
      : r === 'no_coincide'
        ? { texto: 'RENIEC: el nombre NO coincide', color: C.rojo, icono: 'warning' as const }
        : r === 'no_existe'
          ? { texto: 'RENIEC no reconoce este DNI', color: C.rojo, icono: 'close-circle' as const }
          : { texto: 'Sin validar con RENIEC', color: C.grisTexto, icono: 'help-circle' as const };
  return <Chip texto={conf.texto} color={conf.color} icono={conf.icono} />;
}

/**
 * Consola del equipo. Existe porque durante el piloto el pago retenido se
 * opera a mano: alguien tiene que mirar el comprobante de Yape y confirmar
 * que el dinero llegó. Cuando entre la pasarela, esta pantalla se apaga.
 *
 * Las cuatro cifras de la cabecera son también filtros: tocar una deja solo
 * esa cola, que es lo que se quiere cuando hay varias cosas esperando.
 */
export default function Operador() {
  const [verificaciones, setVerificaciones] = useState<VerificacionPendiente[]>([]);
  const [pagos, setPagos] = useState<PagoPendiente[]>([]);
  const [disputas, setDisputas] = useState<DisputaAbierta[]>([]);
  const [vencidas, setVencidas] = useState<ConfirmacionVencida[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [cola, setCola] = useState<Cola | null>(null);

  const cargar = useCallback(async () => {
    const [v, p, d, c] = await Promise.all([
      api.pendientesVerificacion(),
      api.pendientesPago(),
      api.disputasAbiertas(),
      api.confirmacionesVencidas(),
    ]);
    setVerificaciones(v);
    setPagos(p);
    setDisputas(d);
    setVencidas(c);

    // URLs firmadas para poder mirar los documentos sin hacerlos públicos
    const pares: [string, string][] = [];
    for (const x of v) {
      for (const ruta of [x.dni_frente_path, x.selfie_path]) {
        if (ruta) {
          const u = await api.urlFirmada('documentos', ruta);
          if (u) pares.push([ruta, u]);
        }
      }
    }
    for (const x of p) {
      if (x.comprobante_path) {
        const u = await api.urlFirmada('comprobantes', x.comprobante_path);
        if (u) pares.push([x.comprobante_path, u]);
      }
    }
    for (const x of d) {
      if (x.evidencia_path) {
        const u = await api.urlFirmada('comprobantes', x.evidencia_path);
        if (u) pares.push([x.evidencia_path, u]);
      }
    }
    setUrls(Object.fromEntries(pares));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      cargar()
        .catch(() => undefined)
        .finally(() => setCargando(false));
    }, [cargar]),
  );

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

  if (cargando) return <Cargando texto="Cargando las colas del equipo…" />;

  const vacio =
    verificaciones.length === 0 &&
    pagos.length === 0 &&
    disputas.length === 0 &&
    vencidas.length === 0;
  const ver = (c: Cola) => !cola || cola === c;
  const alternar = (c: Cola) => setCola(cola === c ? null : c);

  return (
    <ScrollView
      style={{ backgroundColor: C.fondo }}
      contentContainerStyle={{ paddingBottom: E.xxl }}
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
      <Cabecera
        antetitulo="Operación manual del piloto"
        titulo="Consola del equipo"
        subtitulo="Confirma un pago solo después de verlo en la cuenta."
        colores={G.noche}>
        <FilaCifras>
          <Cifra
            claro
            icono="id-card"
            valor={String(verificaciones.length)}
            etiqueta="Identidad"
            onPress={() => alternar('verificaciones')}
          />
          <Cifra
            claro
            icono="wallet"
            valor={String(pagos.length)}
            etiqueta="Pagos"
            onPress={() => alternar('pagos')}
          />
          <Cifra
            claro
            icono="alarm"
            valor={String(vencidas.length)}
            etiqueta="Vencidos"
            onPress={() => alternar('vencidas')}
          />
          <Cifra
            claro
            icono="flag"
            valor={String(disputas.length)}
            etiqueta="Disputas"
            onPress={() => alternar('disputas')}
          />
        </FilaCifras>
      </Cabecera>

      <View style={{ padding: E.lg }}>
        {!!cola && (
          <View style={s.filtro}>
            <Ionicons name="funnel" size={14} color={C.azulMedio} />
            <Text style={s.filtroTexto}>Mostrando solo una cola</Text>
            <Text style={s.filtroQuitar} onPress={() => setCola(null)}>
              Ver todas
            </Text>
          </View>
        )}

        {vacio && (
          <Vacio
            icono="sparkles-outline"
            titulo="Todo al día"
            detalle="No hay verificaciones, pagos, disputas ni plazos vencidos esperando."
          />
        )}

        {/* ------------------------------------------------ verificaciones */}
        {verificaciones.length > 0 && ver('verificaciones') && (
          <>
            <Seccion
              titulo="Verificaciones por revisar"
              icono="id-card-outline"
              conteo={verificaciones.length}
            />
            {verificaciones.map((v, i) => (
              <Entrada key={v.perfil_id} i={i}>
                <Tarjeta>
                  <View style={s.persona}>
                    <Avatar nombre={v.nombre_completo} tamano={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.titulo}>{v.nombre_completo}</Text>
                      <Text style={s.meta}>Solicitó {hace(v.solicitado_en)}</Text>
                    </View>
                  </View>
                  <View style={{ marginVertical: E.md }}>
                    <InsigniaReniec r={v.dni_validacion} />
                  </View>
                  <Dato icono="card-outline" etiqueta="DNI declarado" valor={v.dni ?? '—'} />
                  <Dato icono="call-outline" etiqueta="Celular" valor={v.telefono ?? '—'} />

                  <View style={s.fotos}>
                    {[
                      ['Documento', v.dni_frente_path],
                      ['Selfie', v.selfie_path],
                    ].map(
                      ([etiqueta, ruta]) =>
                        ruta &&
                        urls[ruta] && (
                          <View key={ruta} style={{ flex: 1 }}>
                            <Image
                              source={{ uri: urls[ruta] }}
                              style={s.foto}
                              resizeMode="cover"
                            />
                            <Micro style={{ textAlign: 'center', marginTop: 4 }}>
                              {etiqueta}
                            </Micro>
                          </View>
                        ),
                    )}
                  </View>
                  <Micro>
                    Compara que el rostro de la selfie corresponda al del documento y que el
                    número coincida con el declarado.
                  </Micro>

                  <Separador />
                  <Boton
                    titulo="Aprobar verificación"
                    icono="checkmark-circle"
                    variante="exito"
                    cargando={ocupado === `ok-${v.perfil_id}`}
                    onPress={() =>
                      accion(`ok-${v.perfil_id}`, async () => {
                        await api.resolverVerificacion(v.perfil_id, true);
                        // Retención mínima: la función ya descartó las rutas en la
                        // base; esto borra los archivos del bucket, que era el paso
                        // que quedaba a mano en el panel de Supabase.
                        try {
                          await api.borrarDocumentos([v.dni_frente_path, v.selfie_path]);
                        } catch (e) {
                          avisar('Verificación aprobada', (e as Error).message);
                        }
                      })
                    }
                  />
                  <View style={{ height: E.sm }} />
                  <Boton
                    titulo="Rechazar"
                    icono="close"
                    variante="fantasma"
                    cargando={ocupado === `no-${v.perfil_id}`}
                    onPress={async () => {
                      const seguro = await confirmar(
                        'Rechazar verificación',
                        `Se rechazará la verificación de ${v.nombre_completo} y tendrá que volver a enviar sus documentos.`,
                        'Rechazar',
                        true,
                      );
                      if (!seguro) return;
                      accion(`no-${v.perfil_id}`, () =>
                        api.resolverVerificacion(
                          v.perfil_id,
                          false,
                          'Las imágenes no permiten validar tu identidad. Vuelve a enviarlas con buena luz y sin reflejos.',
                        ),
                      );
                    }}
                  />
                </Tarjeta>
              </Entrada>
            ))}
          </>
        )}

        {/* ------------------------------------------------ pagos */}
        {pagos.length > 0 && ver('pagos') && (
          <>
            <Seccion
              titulo="Pagos por confirmar"
              icono="wallet-outline"
              conteo={pagos.length}
              style={{ marginTop: E.md }}
            />
            {pagos.map((p, i) => (
              <Entrada key={p.pedido_id} i={i}>
                <Tarjeta>
                  <Text style={s.titulo}>{p.titulo}</Text>
                  <Text style={s.monto}>{soles(p.total_cobrado)}</Text>
                  <Dato icono="person-outline" etiqueta="Cliente" valor={p.cliente} />
                  <Dato
                    icono="phone-portrait-outline"
                    etiqueta="Método"
                    valor={(p.metodo ?? '—').toUpperCase()}
                  />
                  <Dato
                    icono="barcode-outline"
                    etiqueta="Código de operación"
                    valor={p.codigo_operacion ?? '—'}
                  />
                  <Dato
                    icono="time-outline"
                    etiqueta="Reportado"
                    valor={fechaHora(p.reportado_en)}
                  />

                  {p.comprobante_path && urls[p.comprobante_path] && (
                    <Image
                      source={{ uri: urls[p.comprobante_path] }}
                      style={s.comprobante}
                      resizeMode="contain"
                    />
                  )}

                  <Boton
                    titulo="El dinero llegó · retener"
                    icono="lock-closed"
                    variante="exito"
                    cargando={ocupado === `pago-${p.pedido_id}`}
                    onPress={async () => {
                      const seguro = await confirmar(
                        'Confirmar retención',
                        `¿Verificaste en la cuenta que llegaron ${soles(
                          p.total_cobrado,
                        )} con el código ${p.codigo_operacion}?`,
                        'Sí, confirmo',
                      );
                      if (!seguro) return;
                      accion(`pago-${p.pedido_id}`, () =>
                        api.confirmarRetencion(p.pedido_id),
                      );
                    }}
                  />
                  <View style={{ height: E.sm }} />
                  <Boton
                    titulo="Ver el pedido"
                    variante="fantasma"
                    onPress={() => router.push(`/pedido/${p.pedido_id}`)}
                  />
                </Tarjeta>
              </Entrada>
            ))}
          </>
        )}

        {/* ------------------------------------------------ plazos vencidos */}
        {vencidas.length > 0 && ver('vencidas') && (
          <>
            <Seccion
              titulo="Plazos de confirmación vencidos"
              icono="alarm-outline"
              conteo={vencidas.length}
              style={{ marginTop: E.md }}
            />
            <Parrafo suave style={{ marginBottom: E.md }}>
              El comprador externo marcó la entrega y el cliente no confirmó dentro del
              plazo de config («dias_para_confirmar»). Antes de liberar, revisa el chat del
              pedido.
            </Parrafo>
            {vencidas.map((c, i) => (
              <Entrada key={c.pedido_id} i={i}>
                <Tarjeta style={{ borderColor: C.ambar, borderWidth: 1.5 }}>
                  <Text style={s.titulo}>{c.titulo}</Text>
                  <View style={{ marginVertical: E.sm }}>
                    <Chip
                      texto={`${c.dias_vencido} día${c.dias_vencido === 1 ? '' : 's'} vencido`}
                      color={C.ambar}
                      icono="alarm"
                    />
                  </View>
                  <Dato icono="person-outline" etiqueta="Cliente" valor={c.cliente} />
                  <Dato icono="airplane-outline" etiqueta="Comprador externo" valor={c.comprador} />
                  <Dato etiqueta="Monto retenido" valor={soles(c.monto)} fuerte />
                  <Dato icono="cube-outline" etiqueta="Entregado" valor={fechaHora(c.entregado_en)} />
                  <Dato icono="alarm-outline" etiqueta="Venció" valor={fechaHora(c.vence_en)} />
                  <Separador />
                  <Boton
                    titulo="Liberar el pago al comprador externo"
                    icono="lock-open"
                    variante="secundario"
                    cargando={ocupado === `venc-${c.pedido_id}`}
                    onPress={async () => {
                      const seguro = await confirmar(
                        'Liberar por vencimiento',
                        `¿Revisaste el pedido y el chat? Se liberarán ${soles(
                          c.monto,
                        )} y el pedido quedará confirmado.`,
                        'Sí, liberar',
                      );
                      if (!seguro) return;
                      accion(`venc-${c.pedido_id}`, () =>
                        api.liberarPorVencimiento(c.pedido_id),
                      );
                    }}
                  />
                  <View style={{ height: E.sm }} />
                  <Boton
                    titulo="Abrir el pedido y su chat"
                    variante="fantasma"
                    onPress={() => router.push(`/pedido/${c.pedido_id}`)}
                  />
                </Tarjeta>
              </Entrada>
            ))}
          </>
        )}

        {/* ------------------------------------------------ disputas */}
        {disputas.length > 0 && ver('disputas') && (
          <>
            <Seccion
              titulo="Disputas abiertas"
              icono="flag-outline"
              conteo={disputas.length}
              style={{ marginTop: E.md }}
            />
            {disputas.map((d, i) => (
              <Entrada key={d.disputa_id} i={i}>
                <Tarjeta style={{ borderColor: C.rojo, borderWidth: 1.5 }}>
                  <Text style={s.titulo}>{d.titulo}</Text>
                  <Dato icono="person-outline" etiqueta="La abrió" valor={d.abierta_por} />
                  <Dato
                    icono="cube-outline"
                    etiqueta="Estado del pedido"
                    valor={ESTADO_PEDIDO[d.estado_pedido]?.etiqueta ?? d.estado_pedido}
                  />
                  <Dato etiqueta="Monto retenido" valor={soles(d.monto)} fuerte />
                  <Dato icono="time-outline" etiqueta="Abierta" valor={fechaHora(d.creado_en)} />
                  <Separador />
                  <View style={s.cita}>
                    <Ionicons name="chatbox-ellipses-outline" size={16} color={C.rojo} />
                    <Parrafo suave style={{ flex: 1 }}>
                      “{d.motivo}”
                    </Parrafo>
                  </View>

                  {d.evidencia_path && urls[d.evidencia_path] && (
                    <Image
                      source={{ uri: urls[d.evidencia_path] }}
                      style={s.comprobante}
                      resizeMode="contain"
                    />
                  )}

                  <Separador />
                  <Micro style={{ marginBottom: E.sm }}>
                    Antes de decidir, lee el chat del pedido: es la única fuente que tienen
                    las dos partes y queda registrada.
                  </Micro>
                  <Boton
                    titulo="Reembolsar al cliente"
                    icono="return-down-back"
                    variante="peligro"
                    cargando={ocupado === `dc-${d.disputa_id}`}
                    onPress={async () => {
                      const seguro = await confirmar(
                        'Reembolsar al cliente',
                        `Se devolverán ${soles(d.monto)} al cliente y el pedido se cerrará.`,
                        'Reembolsar',
                        true,
                      );
                      if (!seguro) return;
                      accion(`dc-${d.disputa_id}`, () =>
                        api.resolverDisputa(
                          d.disputa_id,
                          true,
                          'Resuelta a favor del cliente tras revisar la evidencia.',
                        ),
                      );
                    }}
                  />
                  <View style={{ height: E.sm }} />
                  <Boton
                    titulo="Liberar al comprador externo"
                    icono="lock-open"
                    variante="secundario"
                    cargando={ocupado === `db-${d.disputa_id}`}
                    onPress={async () => {
                      const seguro = await confirmar(
                        'Liberar al comprador externo',
                        `Se liberarán ${soles(d.monto)} al comprador externo y el pedido se cerrará.`,
                        'Liberar',
                      );
                      if (!seguro) return;
                      accion(`db-${d.disputa_id}`, () =>
                        api.resolverDisputa(
                          d.disputa_id,
                          false,
                          'Resuelta a favor del comprador externo: la entrega quedó acreditada.',
                        ),
                      );
                    }}
                  />
                  <View style={{ height: E.sm }} />
                  <Boton
                    titulo="Abrir el chat del pedido"
                    variante="fantasma"
                    onPress={() => router.push(`/pedido/${d.pedido_id}`)}
                  />
                  <View style={{ height: E.sm }} />
                  <Boton
                    titulo="Ver el historial de quien la abrió"
                    variante="fantasma"
                    onPress={() => router.push(`/reputacion/${d.abierta_por_id}`)}
                  />
                </Tarjeta>
              </Entrada>
            ))}
          </>
        )}

        {verificaciones.length > 0 && (
          <Micro style={{ marginTop: E.lg, lineHeight: 18 }}>
            Al aprobar una verificación, la app descarta las rutas y borra las imágenes del
            bucket «documentos» en la misma operación. Queda solo el número de DNI, que es
            la retención mínima que exige la Ley N° 29733.
          </Micro>
        )}

        <View style={{ height: E.lg }} />
        <Boton
          titulo="Ver la política de datos"
          icono="document-text-outline"
          variante="fantasma"
          onPress={() => router.push('/legal')}
        />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  filtro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm,
    backgroundColor: C.azulClaro,
    paddingHorizontal: E.md,
    paddingVertical: E.sm + 2,
    borderRadius: R.md,
    marginBottom: E.md,
  },
  filtroTexto: { flex: 1, color: C.azul, fontWeight: '700', fontSize: 13.5 },
  filtroQuitar: { color: C.naranja, fontWeight: '800', fontSize: 13.5 },
  persona: { flexDirection: 'row', alignItems: 'center', gap: E.md },
  titulo: { fontSize: 16, fontWeight: '800', color: C.texto },
  meta: { fontSize: 12.5, color: C.textoSuave, marginTop: 2 },
  monto: {
    fontSize: 26,
    fontWeight: '800',
    color: C.verde,
    letterSpacing: -0.6,
    marginVertical: E.xs,
  },
  fotos: { flexDirection: 'row', gap: E.sm, marginVertical: E.md },
  foto: { height: 140, borderRadius: R.sm, backgroundColor: C.borde },
  comprobante: {
    height: 220,
    borderRadius: R.sm,
    marginVertical: E.md,
    backgroundColor: C.borde,
  },
  cita: { flexDirection: 'row', gap: E.sm, alignItems: 'flex-start' },
});
