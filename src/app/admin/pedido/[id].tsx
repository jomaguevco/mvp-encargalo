import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { ESTADO_OFERTA, ESTADO_PEDIDO, fecha, fechaHora, soles } from '@/lib/negocio';
import {
  Bloque,
  BotonAdmin,
  ChipPago,
  ChipPedido,
  FilaDato,
  GrillaKpi,
  Kpi,
  PaginaAdmin,
  Tabla,
  volver,
} from '@/ui/admin';
import { Aviso, Avatar, Cargando, Chip } from '@/ui/componentes';
import { useEscritorio } from '@/ui/escritorio';
import { Text } from '@/ui/Texto';
import { C, E, R } from '@/ui/tema';

/**
 * Detalle de un pedido para el equipo, sin salir del panel.
 *
 * Es de solo lectura a propósito: las decisiones (confirmar un pago, liberar,
 * resolver una disputa) viven en Operación, donde están las reglas y la
 * confirmación. Desde aquí se llega a cada una con un botón.
 */
export default function PedidoAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<api.DetallePedidoAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { es: escritorio } = useEscritorio();

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const r = await api.detallePedidoAdmin(id);
      if (!r) setError('Ese pedido no existe o no tienes acceso.');
      setD(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (error && !d) {
    return (
      <PaginaAdmin titulo="Pedido">
        <Aviso tono="error" titulo="No se pudo abrir el pedido">{error}</Aviso>
        <BotonAdmin titulo="Volver a pedidos" icono="arrow-back" onPress={() => router.replace('/admin/pedidos')} />
      </PaginaAdmin>
    );
  }
  if (!d) return <Cargando texto="Abriendo el pedido…" />;

  const { pedido: pe, pago, nombres } = d;
  const nombre = (pid: string | null | undefined) => (pid ? nombres[pid]?.nombre ?? 'Cuenta' : 'Sistema');
  const aceptada = d.ofertas.find((o) => o.id === pe.oferta_aceptada_id) ?? null;
  const compradorId = aceptada?.comprador_id ?? pago?.comprador_id ?? null;
  const disputaAbierta = d.disputas.find((x) => x.estado === 'abierta' || x.estado === 'en_revision');
  const foto = api.urlPublica('productos', pe.imagen_path);

  const persona = (pid: string, rol: string) => (
    <View style={s.persona}>
      <Avatar nombre={nombre(pid)} foto={api.urlFoto(nombres[pid]?.foto)} tamano={44} />
      <View style={{ flex: 1 }}>
        <Text style={s.rol}>{rol}</Text>
        <Text style={s.fuerte} numberOfLines={1}>{nombre(pid)}</Text>
      </View>
      <BotonAdmin titulo="Ver ficha" icono="person-outline" onPress={() => router.push(`/admin/cuenta/${pid}`)} />
    </View>
  );

  return (
    <PaginaAdmin
      titulo={pe.titulo}
      subtitulo={`Publicado el ${fecha(pe.creado_en)} · ${pe.categoria} · ${pe.ciudad_entrega}`}
      acciones={
        <>
          <BotonAdmin titulo="Volver" icono="arrow-back" onPress={() => volver('/admin/pedidos')} />
          {pago?.estado === 'en_revision' && (
            <BotonAdmin
              titulo="Confirmar el pago"
              icono="wallet-outline"
              variante="primario"
              onPress={() => router.push('/admin/operacion?cola=pagos')}
            />
          )}
          {!!disputaAbierta && (
            <BotonAdmin
              titulo="Resolver la disputa"
              icono="flag-outline"
              variante="peligro"
              onPress={() => router.push('/admin/operacion?cola=disputas')}
            />
          )}
        </>
      }>
      <View style={s.chips}>
        <ChipPedido estado={pe.estado} />
        <ChipPago estado={pago?.estado ?? null} />
      </View>

      <View style={{ flexDirection: escritorio ? 'row' : 'column', gap: E.lg, alignItems: 'flex-start' }}>
        <Bloque titulo="Participantes" icono="people-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          {persona(pe.cliente_id, 'Cliente')}
          {compradorId ? (
            persona(compradorId, 'Comprador externo')
          ) : (
            <Text style={s.meta}>Todavía no hay un comprador externo elegido.</Text>
          )}
        </Bloque>

        <Bloque titulo="El producto" icono="cube-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          <View style={{ flexDirection: 'row', gap: E.md }}>
            {!!foto && <Image source={{ uri: foto }} style={s.foto} resizeMode="cover" />}
            <View style={{ flex: 1 }}>
              <FilaDato etiqueta="Cantidad" valor={String(pe.cantidad)} />
              <FilaDato etiqueta="Valor referencial" valor={soles(pe.valor_referencial)} />
              <FilaDato etiqueta="Fecha límite" valor={fecha(pe.fecha_limite)} />
            </View>
          </View>
          {!!pe.descripcion && <Text style={s.texto}>{pe.descripcion}</Text>}
          {!!pe.url_producto && (
            <BotonAdmin
              titulo="Abrir el enlace del producto"
              icono="open-outline"
              onPress={() => Linking.openURL(pe.url_producto!)}
            />
          )}
        </Bloque>
      </View>

      {pago && (
        <>
          <GrillaKpi>
            <Kpi icono="wallet" etiqueta="Pagó el cliente" valor={soles(pago.total_cobrado)} detalle={pago.metodo ? `${pago.metodo.toUpperCase()} · ${pago.codigo_operacion ?? 'sin código'}` : 'Aún no reporta el pago'} />
            <Kpi icono="airplane" etiqueta="Recibe el comprador" valor={soles(pago.monto_liberado)} color={C.verde} />
            <Kpi icono="cash" etiqueta="Comisión de Encárgalo" valor={soles(Number(pago.comision_cliente) + Number(pago.tarifa_comprador))} color={C.azulMedio} />
          </GrillaKpi>
          <Bloque titulo="Movimientos del pago" icono="time-outline">
            <FilaDato etiqueta="Reportado por el cliente" valor={fechaHora(pago.reportado_en)} />
            <FilaDato etiqueta="Retenido por el equipo" valor={fechaHora(pago.retenido_en)} />
            <FilaDato etiqueta="Liberado al comprador" valor={fechaHora(pago.liberado_en)} />
          </Bloque>
        </>
      )}

      <Bloque titulo={`Ofertas (${d.ofertas.length})`} icono="pricetags-outline">
        <Tabla
          columnas={[
            { clave: 'comprador', titulo: 'Comprador externo', ancho: 2, render: (o) => nombre(o.comprador_id) },
            { clave: 'precio', titulo: 'Precio', alinear: 'derecha', render: (o) => soles(o.precio_final) },
            { clave: 'entrega', titulo: 'Entrega', render: (o) => fecha(o.fecha_entrega) },
            {
              clave: 'estado',
              titulo: 'Estado',
              ancho: 1.2,
              render: (o) => (
                <Chip
                  texto={o.id === pe.oferta_aceptada_id ? 'Elegida' : ESTADO_OFERTA[o.estado]?.etiqueta ?? o.estado}
                  color={o.id === pe.oferta_aceptada_id ? C.verde : ESTADO_OFERTA[o.estado]?.color ?? C.grisTexto}
                />
              ),
            },
            { clave: 'nota', titulo: 'Nota', ancho: 2.5, render: (o) => o.nota || '—' },
          ]}
          filas={d.ofertas}
          clave={(o) => o.id}
          onFila={(o) => router.push(`/admin/cuenta/${o.comprador_id}`)}
          vacio="Nadie ofertó todavía"
        />
      </Bloque>

      <View style={{ flexDirection: escritorio ? 'row' : 'column', gap: E.lg, alignItems: 'flex-start' }}>
        <Bloque titulo="Bitácora del pedido" icono="git-commit-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          {d.eventos.length === 0 && <Text style={s.meta}>Sin movimientos.</Text>}
          {d.eventos.map((e) => (
            <View key={e.id} style={s.evento}>
              <View style={[s.punto, { backgroundColor: ESTADO_PEDIDO[e.estado_nuevo]?.color ?? C.grisTexto }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.fuerte}>{ESTADO_PEDIDO[e.estado_nuevo]?.etiqueta ?? e.estado_nuevo}</Text>
                <Text style={s.meta}>
                  {fechaHora(e.creado_en)} · {nombre(e.actor_id)}
                  {e.nota ? ` · ${e.nota}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </Bloque>

        <Bloque titulo={`Chat (${d.mensajes.length})`} icono="chatbubbles-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          {d.mensajes.length === 0 && <Text style={s.meta}>Sin mensajes.</Text>}
          {d.mensajes.map((m) => (
            <View
              key={m.id}
              style={[s.mensaje, m.emisor_id === pe.cliente_id ? s.mensajeCliente : s.mensajeComprador]}>
              <Text style={s.rol}>
                {nombre(m.emisor_id)} · {fechaHora(m.creado_en)}
              </Text>
              <Text style={s.texto}>{m.cuerpo}</Text>
            </View>
          ))}
        </Bloque>
      </View>

      {d.disputas.length > 0 && (
        <Bloque titulo={`Disputas (${d.disputas.length})`} icono="flag-outline">
          {d.disputas.map((x) => (
            <View key={x.id} style={s.disputa}>
              <Text style={s.fuerte}>
                {x.estado === 'resuelta_cliente'
                  ? 'Resuelta a favor del cliente'
                  : x.estado === 'resuelta_comprador'
                    ? 'Resuelta a favor del comprador'
                    : 'Abierta'}{' '}
                · la abrió {nombre(x.abierta_por)} el {fecha(x.creado_en)}
              </Text>
              <Text style={s.texto}>«{x.motivo}»</Text>
              {!!x.resolucion && <Text style={s.meta}>Resolución: {x.resolucion}</Text>}
            </View>
          ))}
        </Bloque>
      )}

      {d.calificaciones.length > 0 && (
        <Bloque titulo="Calificaciones" icono="star-outline">
          {d.calificaciones.map((c) => (
            <FilaDato
              key={c.id}
              etiqueta={`${nombre(c.califica_id)} calificó a ${nombre(c.calificado_id)}${c.comentario ? ` · «${c.comentario}»` : ''}`}
              valor={`${c.puntaje} ★`}
            />
          ))}
        </Bloque>
      )}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', alignItems: 'center', gap: E.sm, flexWrap: 'wrap' },
  meta: { fontSize: 13.5, color: C.textoSuave },
  persona: { flexDirection: 'row', alignItems: 'center', gap: E.md, paddingVertical: 6 },
  rol: { fontSize: 12, fontWeight: '700', color: C.grisTexto, textTransform: 'uppercase', letterSpacing: 0.4 },
  fuerte: { fontSize: 14.5, fontWeight: '700', color: C.texto },
  texto: { fontSize: 14, lineHeight: 20, color: C.texto },
  foto: { width: 96, height: 96, borderRadius: R.sm, backgroundColor: C.superficieSuave },
  evento: { flexDirection: 'row', gap: E.md, paddingVertical: 6 },
  punto: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  mensaje: { padding: E.md, borderRadius: R.md, gap: 4, maxWidth: '90%' },
  mensajeCliente: { backgroundColor: C.superficieSuave, alignSelf: 'flex-start' },
  mensajeComprador: { backgroundColor: C.azulFondo, alignSelf: 'flex-end' },
  disputa: { gap: 4, paddingVertical: 6, borderTopWidth: 1, borderColor: C.superficieSuave },
});
