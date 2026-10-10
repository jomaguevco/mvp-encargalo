import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Texto';
import { misEntregas, misOfertasEnviadas } from '@/lib/api';
import {
  ESTADO_OFERTA,
  SIGUIENTE_PASO_COMPRADOR,
  fecha,
  hace,
  soles,
} from '@/lib/negocio';
import type { OfertaEnviada, Pedido } from '@/lib/tipos';
import {
  Cabecera,
  Cargando,
  Chip,
  Cifra,
  Entrada,
  FilaCifras,
  Seccion,
  Tarjeta,
  Vacio,
} from '@/ui/componentes';
import { iconoCategoria } from '@/ui/iconos';
import { PedidoCard } from '@/ui/PedidoCard';
import { C, E, R } from '@/ui/tema';

export default function Entregas() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [ofertas, setOfertas] = useState<OfertaEnviada[]>([]);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [pe, of] = await Promise.all([misEntregas(), misOfertasEnviadas()]);
      setPedidos(pe);
      setOfertas(of);
    } catch {
      setPedidos([]);
      setOfertas([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (pedidos === null) return <Cargando texto="Cargando tus entregas…" />;

  // Las ofertas de pedidos que ya me adjudicaron aparecen abajo como entrega:
  // aquí solo van las que todavía esperan respuesta del cliente.
  const adjudicados = new Set(pedidos.map((p) => p.id));
  const esperando = ofertas.filter(
    (o) => !adjudicados.has(o.pedido_id) && o.estado_oferta === 'enviada',
  );
  const enCurso = pedidos.filter((p) => !['confirmado', 'cancelado'].includes(p.estado));
  const cumplidos = pedidos.filter((p) => p.estado === 'confirmado');
  const meToca = enCurso.filter((p) => SIGUIENTE_PASO_COMPRADOR[p.estado]).length;

  return (
    <ScrollView
      style={{ backgroundColor: C.fondo }}
      contentContainerStyle={{ paddingBottom: E.xxl }}
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
      <Cabecera
        antetitulo="Comprador externo"
        titulo="Lo que estoy trayendo"
        subtitulo="Cada paso que marcas lo ve el cliente al instante."
        derecha={
          <View style={s.avion}>
            <Ionicons name="airplane" size={26} color={C.blanco} />
          </View>
        }>
        <FilaCifras>
          <Cifra claro icono="paper-plane" valor={String(esperando.length)} etiqueta="Ofertas enviadas" />
          <Cifra claro icono="navigate" valor={String(enCurso.length)} etiqueta="En curso" />
          <Cifra claro icono="trophy" valor={String(cumplidos.length)} etiqueta="Cumplidos" />
        </FilaCifras>
      </Cabecera>

      <View style={{ padding: E.lg }}>
        {meToca > 0 && (
          <Entrada>
            <View style={s.turno}>
              <Ionicons name="flash" size={18} color={C.naranja} />
              <Text style={s.turnoTexto}>
                {meToca === 1
                  ? 'Tienes un pedido esperando que marques el siguiente paso'
                  : `Tienes ${meToca} pedidos esperando que marques el siguiente paso`}
              </Text>
            </View>
          </Entrada>
        )}

        {enCurso.length > 0 && (
          <>
            <Seccion titulo="En curso" icono="navigate-outline" conteo={enCurso.length} />
            {enCurso.map((p, i) => (
              <Entrada key={p.id} i={i}>
                <PedidoCard
                  pedido={p}
                  pie={SIGUIENTE_PASO_COMPRADOR[p.estado]?.accion ?? undefined}
                />
              </Entrada>
            ))}
          </>
        )}

        {esperando.length > 0 && (
          <>
            <Seccion
              titulo="Esperando respuesta"
              icono="hourglass-outline"
              conteo={esperando.length}
              style={{ marginTop: E.lg }}
            />
            <Text style={s.nota}>
              El cliente está comparando. Puedes retirarlas desde el pedido mientras nadie
              las acepte.
            </Text>
            {esperando.map((o, i) => {
              const eo = ESTADO_OFERTA[o.estado_oferta];
              return (
                <Entrada key={o.oferta_id} i={i}>
                  <Tarjeta onPress={() => router.push(`/pedido/${o.pedido_id}`)}>
                    <View style={s.ofertaFila}>
                      <View style={s.ofertaIcono}>
                        <Ionicons
                          name={iconoCategoria(o.categoria)}
                          size={22}
                          color={C.azulMedio}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.ofertaTitulo} numberOfLines={2}>
                          {o.titulo}
                        </Text>
                        <Text style={s.ofertaMeta}>
                          {o.categoria} · enviada {hace(o.creado_en)}
                        </Text>
                      </View>
                    </View>
                    <View style={s.ofertaPie}>
                      <Chip texto={eo.etiqueta} color={eo.color} icono="time-outline" />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.ofertaPrecio}>{soles(o.precio_final)}</Text>
                        <Text style={s.ofertaMeta}>entrega {fecha(o.fecha_entrega)}</Text>
                      </View>
                    </View>
                  </Tarjeta>
                </Entrada>
              );
            })}
          </>
        )}

        {cumplidos.length > 0 && (
          <>
            <Seccion
              titulo="Cumplidos"
              icono="trophy-outline"
              conteo={cumplidos.length}
              style={{ marginTop: E.lg }}
            />
            {cumplidos.map((p, i) => (
              <Entrada key={p.id} i={i}>
                <PedidoCard pedido={p} />
              </Entrada>
            ))}
          </>
        )}

        {pedidos.length === 0 && esperando.length === 0 && (
          <Vacio
            icono="paper-plane-outline"
            titulo="Todavía no has ofertado"
            detalle="Entra a «Ofertar», elige un pedido abierto y propón tu precio. Cuando un cliente acepte, el pedido aparecerá aquí y podrás ir marcando el avance hasta la entrega."
            accion="Ver pedidos abiertos"
            onAccion={() => router.push('/(app)/explorar')}
          />
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  avion: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(242,235,225,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-20deg' }],
  },
  turno: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm,
    backgroundColor: C.naranjaClaro,
    padding: E.md,
    borderRadius: R.md,
    marginBottom: E.lg,
  },
  turnoTexto: { flex: 1, color: C.naranjaOscuro, fontWeight: '700', fontSize: 14 },
  nota: { fontSize: 13.5, color: C.textoSuave, marginBottom: E.md, lineHeight: 20 },
  ofertaFila: { flexDirection: 'row', gap: E.md, alignItems: 'center' },
  ofertaIcono: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ofertaTitulo: { fontSize: 15.5, fontWeight: '800', color: C.texto },
  ofertaMeta: { fontSize: 12.5, color: C.textoSuave, marginTop: 2 },
  ofertaPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: E.md,
    paddingTop: E.md,
    borderTopWidth: 1,
    borderTopColor: C.borde,
  },
  ofertaPrecio: { fontSize: 18, fontWeight: '800', color: C.azul },
});
