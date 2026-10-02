import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Linking, RefreshControl, ScrollView, View } from 'react-native';
import * as api from '@/lib/api';
import { fechaHora, soles } from '@/lib/negocio';
import type {
  ConfirmacionVencida,
  DisputaAbierta,
  PagoPendiente,
  VerificacionPendiente,
} from '@/lib/tipos';
import {
  Aviso,
  Boton,
  Cargando,
  Dato,
  Micro,
  Parrafo,
  Separador,
  Subtitulo,
  Tarjeta,
  Vacio,
} from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { C, E, R } from '@/ui/tema';

/**
 * Consola del equipo. Existe porque durante el piloto el pago retenido se
 * opera a mano: alguien tiene que mirar el comprobante de Yape y confirmar
 * que el dinero llegó. Cuando entre la pasarela, esta pantalla se apaga.
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

  return (
    <ScrollView
      contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}
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
      <Aviso tono="alerta" titulo="Operación manual del piloto">
        Aquí se valida a mano lo que más adelante hará la pasarela y el proveedor de
        identidad. Confirma un pago solo después de verlo en la cuenta.
      </Aviso>

      {vacio && (
        <Vacio
          titulo="Todo al día"
          detalle="No hay verificaciones, pagos, disputas ni plazos vencidos esperando."
        />
      )}

      {/* ------------------------------------------------ verificaciones */}
      {verificaciones.length > 0 && (
        <>
          <Subtitulo>Verificaciones por revisar ({verificaciones.length})</Subtitulo>
          {verificaciones.map((v) => (
            <Tarjeta key={v.perfil_id}>
              <Parrafo style={{ fontWeight: '700' }}>{v.nombre_completo}</Parrafo>
              <Dato etiqueta="DNI declarado" valor={v.dni ?? '—'} />
              <Dato
                etiqueta="Contraste con RENIEC"
                valor={
                  v.dni_validacion === 'coincide'
                    ? 'El nombre coincide'
                    : v.dni_validacion === 'no_coincide'
                      ? '⚠ El nombre NO coincide: revisa el documento'
                      : v.dni_validacion === 'no_existe'
                        ? '⚠ RENIEC no reconoce este DNI'
                        : 'Sin validar automáticamente'
                }
              />
              <Dato etiqueta="Celular" valor={v.telefono ?? '—'} />

              <View style={{ flexDirection: 'row', gap: E.sm, marginVertical: E.md }}>
                {[v.dni_frente_path, v.selfie_path].map(
                  (ruta) =>
                    ruta &&
                    urls[ruta] && (
                      <Image
                        key={ruta}
                        source={{ uri: urls[ruta] }}
                        style={{
                          flex: 1,
                          height: 130,
                          borderRadius: R.sm,
                          backgroundColor: C.borde,
                        }}
                        resizeMode="cover"
                      />
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
          ))}
        </>
      )}

      {/* ------------------------------------------------ pagos */}
      {pagos.length > 0 && (
        <>
          <Subtitulo style={{ marginTop: E.md }}>
            Pagos por confirmar ({pagos.length})
          </Subtitulo>
          {pagos.map((p) => (
            <Tarjeta key={p.pedido_id}>
              <Parrafo style={{ fontWeight: '700' }}>{p.titulo}</Parrafo>
              <Dato etiqueta="Cliente" valor={p.cliente} />
              <Dato etiqueta="Monto" valor={soles(p.total_cobrado)} fuerte />
              <Dato etiqueta="Método" valor={p.metodo ?? '—'} />
              <Dato etiqueta="Código de operación" valor={p.codigo_operacion ?? '—'} />
              <Dato etiqueta="Reportado" valor={fechaHora(p.reportado_en)} />

              {p.comprobante_path && urls[p.comprobante_path] && (
                <Image
                  source={{ uri: urls[p.comprobante_path] }}
                  style={{
                    height: 220,
                    borderRadius: R.sm,
                    marginVertical: E.md,
                    backgroundColor: C.borde,
                  }}
                  resizeMode="contain"
                />
              )}

              <Boton
                titulo="El dinero llegó · retener"
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
          ))}
        </>
      )}

      {/* ------------------------------------------------ plazos vencidos */}
      {vencidas.length > 0 && (
        <>
          <Subtitulo style={{ marginTop: E.md }}>
            Plazos de confirmación vencidos ({vencidas.length})
          </Subtitulo>
          <Parrafo suave style={{ marginBottom: E.md }}>
            El comprador externo marcó la entrega y el cliente no confirmó dentro del
            plazo de config («dias_para_confirmar»). Sin este paso el dinero se quedaba
            retenido para siempre. Antes de liberar, revisa el chat del pedido.
          </Parrafo>
          {vencidas.map((c) => (
            <Tarjeta
              key={c.pedido_id}
              style={{ borderColor: C.ambar, borderWidth: 1.5 }}>
              <Parrafo style={{ fontWeight: '700' }}>{c.titulo}</Parrafo>
              <Dato etiqueta="Cliente" valor={c.cliente} />
              <Dato etiqueta="Comprador externo" valor={c.comprador} />
              <Dato etiqueta="Monto retenido" valor={soles(c.monto)} fuerte />
              <Dato etiqueta="Entregado" valor={fechaHora(c.entregado_en)} />
              <Dato etiqueta="Venció" valor={fechaHora(c.vence_en)} />
              <Dato
                etiqueta="Días vencido"
                valor={String(c.dias_vencido)}
              />
              <Separador />
              <Boton
                titulo="Liberar el pago al comprador externo"
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
          ))}
        </>
      )}

      {/* ------------------------------------------------ disputas */}
      {disputas.length > 0 && (
        <>
          <Subtitulo style={{ marginTop: E.md }}>
            Disputas abiertas ({disputas.length})
          </Subtitulo>
          {disputas.map((d) => (
            <Tarjeta key={d.disputa_id} style={{ borderColor: C.rojo, borderWidth: 1.5 }}>
              <Parrafo style={{ fontWeight: '700' }}>{d.titulo}</Parrafo>
              <Dato etiqueta="La abrió" valor={d.abierta_por} />
              <Dato etiqueta="Estado del pedido" valor={d.estado_pedido} />
              <Dato etiqueta="Monto retenido" valor={soles(d.monto)} fuerte />
              <Dato etiqueta="Abierta" valor={fechaHora(d.creado_en)} />
              <Separador />
              <Parrafo suave>“{d.motivo}”</Parrafo>

              {d.evidencia_path && urls[d.evidencia_path] && (
                <Image
                  source={{ uri: urls[d.evidencia_path] }}
                  style={{
                    height: 220,
                    borderRadius: R.sm,
                    marginTop: E.md,
                    backgroundColor: C.borde,
                  }}
                  resizeMode="contain"
                />
              )}

              <Separador />
              <Micro style={{ marginBottom: E.sm }}>
                Antes de decidir, lee el chat del pedido: es la única fuente que tienen las
                dos partes y queda registrada.
              </Micro>
              <Boton
                titulo="Reembolsar al cliente"
                variante="peligro"
                cargando={ocupado === `dc-${d.disputa_id}`}
                onPress={() =>
                  accion(`dc-${d.disputa_id}`, () =>
                    api.resolverDisputa(
                      d.disputa_id,
                      true,
                      'Resuelta a favor del cliente tras revisar la evidencia.',
                    ),
                  )
                }
              />
              <View style={{ height: E.sm }} />
              <Boton
                titulo="Liberar al comprador externo"
                variante="secundario"
                cargando={ocupado === `db-${d.disputa_id}`}
                onPress={() =>
                  accion(`db-${d.disputa_id}`, () =>
                    api.resolverDisputa(
                      d.disputa_id,
                      false,
                      'Resuelta a favor del comprador externo: la entrega quedó acreditada.',
                    ),
                  )
                }
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
        variante="fantasma"
        onPress={() => Linking.openURL('https://encargalo.pe/privacidad')}
      />
    </ScrollView>
  );
}
