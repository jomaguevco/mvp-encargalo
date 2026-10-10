import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { diasHasta, fecha, soles } from '@/lib/negocio';
import type { OfertaConReputacion } from '@/lib/tipos';
import { Avatar, Boton, Chip, Estrellas, Tarjeta } from './componentes';
import { C, E, R } from './tema';

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={s.metrica}>
      <Text style={s.metricaValor}>{valor}</Text>
      <Text style={s.metricaEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

/**
 * Tarjeta de oferta. Muestra la reputación al mismo nivel que el precio:
 * es la decisión de diseño que hace que el 46 % elija una oferta que no es
 * la más barata.
 */
export function OfertaItem({
  oferta,
  masBarata,
  masRapida,
  puedeAceptar,
  onAceptar,
  aceptando,
  onRetirar,
  retirando,
}: {
  oferta: OfertaConReputacion;
  masBarata: boolean;
  masRapida?: boolean;
  puedeAceptar: boolean;
  onAceptar?: () => void;
  aceptando?: boolean;
  onRetirar?: () => void;
  retirando?: boolean;
}) {
  const r = oferta.reputacion;
  const nuevo = (r?.pedidos_cumplidos ?? 0) === 0;
  const dias = diasHasta(oferta.fecha_entrega);
  const nota = r?.calificacion != null ? Number(r.calificacion) : null;

  return (
    <Tarjeta style={masBarata ? { borderColor: `${C.naranja}66`, borderWidth: 1.5 } : undefined}>
      <Pressable
        onPress={() => router.push(`/reputacion/${oferta.comprador_id}`)}
        style={s.cabecera}>
        <Avatar nombre={r?.nombre_completo} tamano={46} verificado />
        <View style={{ flex: 1 }}>
          <Text style={s.nombre} numberOfLines={1}>
            {r?.nombre_completo ?? 'Comprador externo'}
          </Text>
          <View style={s.notaFila}>
            {nota != null ? (
              <>
                <Estrellas valor={nota} tamano={13} />
                <Text style={s.notaTexto}>
                  {nota.toFixed(1)} · {r?.total_calificaciones}
                </Text>
              </>
            ) : (
              <Text style={s.notaTexto}>Sin calificaciones aún</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textoSuave} />
      </Pressable>

      <View style={s.chips}>
        <Chip texto="DNI verificado" color={C.verde} icono="shield-checkmark" />
        {masBarata && <Chip texto="Más barata" color={C.naranja} icono="pricetag" />}
        {masRapida && <Chip texto="Más rápida" color={C.azulMedio} icono="flash" />}
      </View>

      <View style={s.precioCaja}>
        <View>
          <Text style={s.precioEtiqueta}>Precio final</Text>
          <Text style={s.precio}>{soles(oferta.precio_final)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.precioEtiqueta}>Entrega</Text>
          <Text style={s.entrega}>{fecha(oferta.fecha_entrega)}</Text>
          <Text style={s.entregaDias}>en {dias} día{dias === 1 ? '' : 's'}</Text>
        </View>
      </View>

      {nuevo ? (
        <View style={s.nuevo}>
          <Ionicons name="sparkles" size={16} color={C.azulMedio} />
          <Text style={s.nuevoTexto}>
            Comprador externo nuevo, todavía sin entregas. Su identidad sí está verificada y
            tu pago queda retenido igual.
          </Text>
        </View>
      ) : (
        <View style={s.metricas}>
          <Metrica valor={String(r?.pedidos_cumplidos ?? 0)} etiqueta="Cumplidos" />
          <View style={s.metricaLinea} />
          <Metrica
            valor={r?.tasa_cumplimiento != null ? `${r.tasa_cumplimiento}%` : '—'}
            etiqueta="Cumplimiento"
          />
          <View style={s.metricaLinea} />
          <Metrica
            valor={r?.puntualidad != null ? `${r.puntualidad}%` : '—'}
            etiqueta="Puntualidad"
          />
        </View>
      )}

      {!!oferta.nota && (
        <View style={s.notaCliente}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.textoSuave} />
          <Text style={s.notaClienteTexto}>“{oferta.nota}”</Text>
        </View>
      )}

      {puedeAceptar && onAceptar && (
        <Boton
          titulo="Elegir esta oferta"
          icono="checkmark-circle"
          onPress={onAceptar}
          cargando={aceptando}
          style={{ marginTop: E.md }}
        />
      )}

      {onRetirar && (
        <Boton
          titulo="Retirar mi oferta"
          variante="fantasma"
          onPress={onRetirar}
          cargando={retirando}
          style={{ marginTop: E.sm }}
        />
      )}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: E.md },
  nombre: { fontSize: 16, fontWeight: '800', color: C.texto },
  notaFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  notaTexto: { fontSize: 12.5, color: C.textoSuave, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: E.xs + 2, marginTop: E.md },

  precioCaja: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: C.azulFondo,
    borderRadius: R.md,
    padding: E.md,
    marginTop: E.md,
  },
  precioEtiqueta: { fontSize: 11.5, fontWeight: '700', color: C.textoSuave },
  precio: { fontSize: 26, fontWeight: '800', color: C.azul, letterSpacing: -0.7 },
  entrega: { fontSize: 15, fontWeight: '800', color: C.texto },
  entregaDias: { fontSize: 12, color: C.textoSuave },

  metricas: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: E.md,
    paddingVertical: E.sm,
  },
  metrica: { flex: 1, alignItems: 'center' },
  metricaValor: { fontSize: 17, fontWeight: '800', color: C.azul },
  metricaEtiqueta: { fontSize: 11.5, color: C.textoSuave, fontWeight: '600', marginTop: 1 },
  metricaLinea: { width: 1, height: 28, backgroundColor: C.borde },

  nuevo: {
    flexDirection: 'row',
    gap: E.sm,
    backgroundColor: C.azulClaro,
    borderRadius: R.md,
    padding: E.md,
    marginTop: E.md,
  },
  nuevoTexto: { flex: 1, fontSize: 13, color: C.azul, lineHeight: 19 },

  notaCliente: {
    flexDirection: 'row',
    gap: E.sm,
    marginTop: E.md,
    paddingTop: E.md,
    borderTopWidth: 1,
    borderTopColor: C.borde,
  },
  notaClienteTexto: { flex: 1, fontSize: 14, color: C.textoSuave, fontStyle: 'italic', lineHeight: 20 },
});
