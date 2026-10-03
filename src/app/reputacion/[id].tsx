import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { reputacionDe, resenasDe } from '@/lib/api';
import { fecha, hace } from '@/lib/negocio';
import type { Reputacion, Resena } from '@/lib/tipos';
import {
  Avatar,
  Aviso,
  Cargando,
  Chip,
  Cifra,
  Entrada,
  Estrellas,
  FilaCifras,
  Seccion,
  Tarjeta,
  TarjetaDegradada,
  Vacio,
} from '@/ui/componentes';
import { C, E, G } from '@/ui/tema';

/**
 * Perfil público de reputación. Es la pantalla que justifica la decisión de
 * no elegir la oferta más barata: el promedio ya salía en la tarjeta de la
 * oferta, pero lo que convence es leer el comentario de quien ya operó con
 * esta persona. No expone DNI, teléfono ni correo: todo sale de la vista
 * v_reputacion y de la función resenas_de.
 */
export default function PerfilPublico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navegacion = useNavigation();
  const [rep, setRep] = useState<Reputacion | null>(null);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    (async () => {
      try {
        const [r, rs] = await Promise.all([reputacionDe(id), resenasDe(id)]);
        if (!vivo) return;
        setRep(r);
        setResenas(rs);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    if (rep) navegacion.setOptions({ title: rep.nombre_completo.split(' ')[0] });
  }, [rep, navegacion]);

  if (cargando) return <Cargando texto="Cargando la reputación…" />;

  if (!rep) {
    return (
      <View style={{ padding: E.xl }}>
        <Aviso tono="error" titulo="No encontramos este perfil">
          Puede que la cuenta ya no exista.
        </Aviso>
      </View>
    );
  }

  const nuevo = rep.pedidos_cumplidos === 0;
  const nota = rep.calificacion != null ? Number(rep.calificacion) : null;
  // Distribución de las reseñas que se pueden leer, de 5 a 1 estrellas
  const conteo = [5, 4, 3, 2, 1].map((n) => resenas.filter((r) => r.puntaje === n).length);
  const maximo = Math.max(1, ...conteo);

  return (
    <ScrollView
      style={{ backgroundColor: C.fondo }}
      contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}>
      <Entrada>
        <TarjetaDegradada colores={G.marca} style={{ alignItems: 'center' }}>
          <Avatar
            nombre={rep.nombre_completo}
            tamano={84}
            verificado={rep.verificacion === 'verificado'}
          />
          <Text style={s.nombre}>{rep.nombre_completo || 'Comprador externo'}</Text>
          <View style={s.lugar}>
            <Ionicons name="location" size={13} color="rgba(255,255,255,0.75)" />
            <Text style={s.lugarTexto}>
              {rep.ciudad} · en Encárgalo hace {rep.antiguedad_dias} día
              {rep.antiguedad_dias === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={{ marginTop: E.md }}>
            {rep.verificacion === 'verificado' ? (
              <Chip
                texto="DNI verificado"
                color="#7EE2B8"
                fondo="rgba(255,255,255,0.14)"
                icono="shield-checkmark"
              />
            ) : (
              <Chip
                texto="Identidad sin verificar"
                color="#FFC59E"
                fondo="rgba(255,255,255,0.14)"
                icono="shield-outline"
              />
            )}
          </View>
        </TarjetaDegradada>
      </Entrada>

      <Entrada i={1}>
        <Tarjeta>
          <View style={s.notaFila}>
            <View style={{ alignItems: 'center', width: 110 }}>
              <Text style={s.nota}>{nota != null ? nota.toFixed(1) : '—'}</Text>
              <Estrellas valor={nota ?? 0} tamano={16} />
              <Text style={s.notaDetalle}>
                {rep.total_calificaciones} calificación
                {rep.total_calificaciones === 1 ? '' : 'es'}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              {conteo.map((c, i) => (
                <View key={i} style={s.barraFila}>
                  <Text style={s.barraEtiqueta}>{5 - i}</Text>
                  <Ionicons name="star" size={11} color="#F5A524" />
                  <View style={s.barraFondo}>
                    <View style={[s.barra, { width: `${(c / maximo) * 100}%` }]} />
                  </View>
                  <Text style={s.barraConteo}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        </Tarjeta>
      </Entrada>

      <Entrada i={2}>
        <FilaCifras>
          <Cifra
            icono="checkmark-done"
            valor={String(rep.pedidos_cumplidos)}
            etiqueta="Cumplidos"
            color={C.verde}
          />
          <Cifra
            icono="pie-chart"
            valor={rep.tasa_cumplimiento != null ? `${rep.tasa_cumplimiento}%` : '—'}
            etiqueta="Cumplimiento"
          />
          <Cifra
            icono="timer"
            valor={rep.puntualidad != null ? `${rep.puntualidad}%` : '—'}
            etiqueta="Puntuales"
            color={C.naranja}
          />
        </FilaCifras>
      </Entrada>

      <View style={{ height: E.lg }} />

      {nuevo && (
        <Aviso tono="info" titulo="Todavía sin entregas registradas">
          No tiene historial, pero su identidad sí está verificada con DNI y su dinero pasa
          por el mismo pago retenido: si no entrega, el cliente no pierde nada.
        </Aviso>
      )}

      <Seccion titulo="Reseñas" icono="chatbubbles-outline" conteo={resenas.length} />

      {resenas.length === 0 ? (
        <Vacio
          icono="chatbubble-ellipses-outline"
          titulo="Sin reseñas todavía"
          detalle="Las reseñas solo las puede escribir quien completó un pedido con esta persona."
        />
      ) : (
        resenas.map((r, i) => (
          <Entrada key={r.id} i={i + 3}>
            <Tarjeta>
              <View style={s.resenaCabecera}>
                <Avatar nombre={r.autor} tamano={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.resenaAutor}>{r.autor}</Text>
                  <Text style={s.resenaMeta}>{hace(r.creado_en)}</Text>
                </View>
                <Estrellas valor={r.puntaje} tamano={14} />
              </View>
              {!!r.comentario && <Text style={s.resenaTexto}>“{r.comentario}”</Text>}
              <View style={s.resenaPedido}>
                <Ionicons name="cube-outline" size={13} color={C.textoSuave} />
                <Text style={s.resenaMeta}>
                  {r.pedido} · {fecha(r.creado_en)}
                </Text>
              </View>
            </Tarjeta>
          </Entrada>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  nombre: {
    color: C.blanco,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: E.md,
    textAlign: 'center',
  },
  lugar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  lugarTexto: { color: 'rgba(255,255,255,0.75)', fontSize: 13.5 },

  notaFila: { flexDirection: 'row', alignItems: 'center', gap: E.lg },
  nota: { fontSize: 44, fontWeight: '800', color: C.azul, letterSpacing: -1.5 },
  notaDetalle: { fontSize: 12, color: C.textoSuave, marginTop: 4 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barraEtiqueta: { fontSize: 12, fontWeight: '700', color: C.textoSuave, width: 9 },
  barraFondo: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.superficieSuave,
    overflow: 'hidden',
  },
  barra: { height: 7, borderRadius: 4, backgroundColor: '#F5A524' },
  barraConteo: { fontSize: 12, color: C.textoSuave, width: 18, textAlign: 'right' },

  resenaCabecera: { flexDirection: 'row', alignItems: 'center', gap: E.md },
  resenaAutor: { fontSize: 15, fontWeight: '800', color: C.texto },
  resenaMeta: { fontSize: 12.5, color: C.textoSuave },
  resenaTexto: { fontSize: 15, color: C.texto, lineHeight: 22, marginTop: E.md },
  resenaPedido: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: E.md },
});
