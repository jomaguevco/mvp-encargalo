import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Linking, RefreshControl, ScrollView, View } from 'react-native';
import * as api from '@/lib/api';
import { fechaHora, soles } from '@/lib/negocio';
import type { DisputaAbierta, PagoPendiente, VerificacionPendiente } from '@/lib/tipos';
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
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [v, p, d] = await Promise.all([
      api.pendientesVerificacion(),
      api.pendientesPago(),
      api.disputasAbiertas(),
    ]);
    setVerificaciones(v);
    setPagos(p);
    setDisputas(d);

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
      Alert.alert('No se pudo completar', (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  if (cargando) return <Cargando texto="Cargando las colas del equipo…" />;

  const vacio =
    verificaciones.length === 0 && pagos.length === 0 && disputas.length === 0;

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
          detalle="No hay verificaciones, pagos ni disputas esperando."
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
                  accion(`ok-${v.perfil_id}`, () =>
                    api.resolverVerificacion(v.perfil_id, true),
                  )
                }
              />
              <View style={{ height: E.sm }} />
              <Boton
                titulo="Rechazar"
                variante="fantasma"
                cargando={ocupado === `no-${v.perfil_id}`}
                onPress={() =>
                  Alert.alert('Rechazar verificación', '¿Seguro?', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Rechazar',
                      style: 'destructive',
                      onPress: () =>
                        accion(`no-${v.perfil_id}`, () =>
                          api.resolverVerificacion(
                            v.perfil_id,
                            false,
                            'Las imágenes no permiten validar tu identidad. Vuelve a enviarlas con buena luz y sin reflejos.',
                          ),
                        ),
                    },
                  ])
                }
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
                onPress={() =>
                  Alert.alert(
                    'Confirmar retención',
                    `¿Verificaste en la cuenta que llegaron ${soles(
                      p.total_cobrado,
                    )} con el código ${p.codigo_operacion}?`,
                    [
                      { text: 'Todavía no', style: 'cancel' },
                      {
                        text: 'Sí, confirmo',
                        onPress: () =>
                          accion(`pago-${p.pedido_id}`, () =>
                            api.confirmarRetencion(p.pedido_id),
                          ),
                      },
                    ],
                  )
                }
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
              <Dato etiqueta="Monto retenido" valor={soles(d.monto)} fuerte />
              <Separador />
              <Parrafo suave>“{d.motivo}”</Parrafo>
              <Separador />
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
            </Tarjeta>
          ))}
        </>
      )}

      {verificaciones.length > 0 && (
        <Micro style={{ marginTop: E.lg, lineHeight: 18 }}>
          Al aprobar una verificación, la app descarta las rutas de las imágenes. Recuerda
          borrar los archivos del bucket «documentos» desde el panel de Supabase para
          completar la retención mínima que exige la Ley N° 29733.
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
