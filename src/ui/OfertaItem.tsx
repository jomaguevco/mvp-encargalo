import { View } from 'react-native';
import { fecha, soles } from '@/lib/negocio';
import type { OfertaConReputacion } from '@/lib/tipos';
import { Boton, Chip, Micro, Parrafo, Separador, Tarjeta } from './componentes';
import { C, E } from './tema';

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Parrafo style={{ fontWeight: '800', color: C.azul, fontSize: 16 }}>
        {valor}
      </Parrafo>
      <Micro style={{ textAlign: 'center' }}>{etiqueta}</Micro>
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
  puedeAceptar,
  onAceptar,
  aceptando,
}: {
  oferta: OfertaConReputacion;
  masBarata: boolean;
  puedeAceptar: boolean;
  onAceptar?: () => void;
  aceptando?: boolean;
}) {
  const r = oferta.reputacion;
  const nuevo = (r?.pedidos_cumplidos ?? 0) === 0;

  return (
    <Tarjeta>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: E.md,
        }}>
        <View style={{ flex: 1 }}>
          <Parrafo style={{ fontWeight: '700' }}>
            {r?.nombre_completo ?? 'Comprador externo'}
          </Parrafo>
          <View style={{ flexDirection: 'row', gap: E.sm, marginTop: E.xs }}>
            <Chip texto="DNI verificado" color={C.verde} />
            {masBarata && <Chip texto="Más barata" color={C.naranja} />}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Parrafo style={{ fontSize: 20, fontWeight: '800', color: C.azul }}>
            {soles(oferta.precio_final)}
          </Parrafo>
          <Micro>Entrega el {fecha(oferta.fecha_entrega)}</Micro>
        </View>
      </View>

      <Separador />

      {nuevo ? (
        <Parrafo suave style={{ textAlign: 'center' }}>
          Comprador externo nuevo, todavía sin entregas registradas. Su identidad sí
          está verificada con DNI.
        </Parrafo>
      ) : (
        <View style={{ flexDirection: 'row', gap: E.sm }}>
          <Metrica valor={String(r?.pedidos_cumplidos ?? 0)} etiqueta="Pedidos cumplidos" />
          <Metrica
            valor={r?.tasa_cumplimiento != null ? `${r.tasa_cumplimiento}%` : '—'}
            etiqueta="Cumplimiento"
          />
          <Metrica
            valor={r?.puntualidad != null ? `${r.puntualidad}%` : '—'}
            etiqueta="Puntualidad"
          />
          <Metrica
            valor={r?.calificacion != null ? `${r.calificacion}` : '—'}
            etiqueta="Calificación"
          />
        </View>
      )}

      {!!oferta.nota && (
        <>
          <Separador />
          <Parrafo suave>“{oferta.nota}”</Parrafo>
        </>
      )}

      {puedeAceptar && onAceptar && (
        <View style={{ marginTop: E.md }}>
          <Boton titulo="Elegir esta oferta" onPress={onAceptar} cargando={aceptando} />
        </View>
      )}
    </Tarjeta>
  );
}
