import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { reputacionDe, resenasDe } from '@/lib/api';
import { fecha, hace } from '@/lib/negocio';
import type { Reputacion, Resena } from '@/lib/tipos';
import {
  Aviso,
  Cargando,
  Chip,
  Dato,
  Micro,
  Parrafo,
  Separador,
  Subtitulo,
  Tarjeta,
  Titulo,
} from '@/ui/componentes';
import { C, E } from '@/ui/tema';

/**
 * Perfil público de reputación. Es la pantalla que justifica la decisión de
 * no elegir la oferta más barata: el promedio ya salía en la tarjeta de la
 * oferta, pero lo que convence es leer el comentario de quien ya operó con
 * esta persona. No expone DNI, teléfono ni correo: todo sale de la vista
 * v_reputacion y de la función resenas_de.
 */
function Estrellas({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ fontSize: 13, color: i <= n ? C.naranja : C.borde }}>
          ★
        </Text>
      ))}
    </View>
  );
}

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

  return (
    <ScrollView contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}>
      <Titulo>{rep.nombre_completo || 'Comprador externo'}</Titulo>
      <Micro style={{ marginBottom: E.sm }}>{rep.ciudad}</Micro>
      {rep.verificacion === 'verificado' ? (
        <Chip texto="DNI verificado" color={C.verde} />
      ) : (
        <Chip texto="Identidad sin verificar" color={C.naranja} />
      )}

      <View style={{ height: E.lg }} />

      <Subtitulo>Historial en Encárgalo</Subtitulo>
      <Tarjeta>
        <Dato etiqueta="Pedidos cumplidos" valor={String(rep.pedidos_cumplidos)} fuerte />
        <Dato
          etiqueta="Tasa de cumplimiento"
          valor={rep.tasa_cumplimiento != null ? `${rep.tasa_cumplimiento} %` : '—'}
        />
        <Dato
          etiqueta="Entregas puntuales"
          valor={rep.puntualidad != null ? `${rep.puntualidad} %` : '—'}
        />
        <Dato
          etiqueta="Calificación"
          valor={
            rep.calificacion != null
              ? `${rep.calificacion} / 5  (${rep.total_calificaciones})`
              : 'Sin calificaciones'
          }
        />
        <Separador />
        <Dato etiqueta="En la plataforma desde hace" valor={`${rep.antiguedad_dias} días`} />
      </Tarjeta>

      {nuevo && (
        <Aviso tono="info" titulo="Todavía sin entregas registradas">
          No tiene historial, pero su identidad sí está verificada con DNI y su dinero
          pasa por el mismo pago retenido: si no entrega, el cliente no pierde nada.
        </Aviso>
      )}

      <View style={{ height: E.md }} />
      <Subtitulo>
        {resenas.length === 0
          ? 'Reseñas'
          : `Reseñas (${resenas.length})`}
      </Subtitulo>

      {resenas.length === 0 ? (
        <Tarjeta>
          <Parrafo suave>
            Nadie ha dejado un comentario todavía. Las reseñas solo las puede escribir
            quien completó un pedido con esta persona.
          </Parrafo>
        </Tarjeta>
      ) : (
        resenas.map((r) => (
          <Tarjeta key={r.id}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: E.sm,
              }}>
              <Estrellas n={r.puntaje} />
              <Micro>{hace(r.creado_en)}</Micro>
            </View>
            {!!r.comentario && (
              <Parrafo style={{ marginTop: E.sm }}>“{r.comentario}”</Parrafo>
            )}
            <Micro style={{ marginTop: E.sm }}>
              {r.autor} · {r.pedido} · {fecha(r.creado_en)}
            </Micro>
          </Tarjeta>
        ))
      )}
    </ScrollView>
  );
}
