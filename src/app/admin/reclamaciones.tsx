import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { fecha, fechaHora, soles } from '@/lib/negocio';
import type { IndicadorReclamaciones, ReclamacionAdmin } from '@/lib/tipos';
import {
  Bloque,
  BotonAdmin,
  descargarCsv,
  Fichas,
  GrillaKpi,
  Kpi,
  PaginaAdmin,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Cargando, Chip } from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { Text, TextInput } from '@/ui/Texto';
import { C, E, R } from '@/ui/tema';

type Filtro = 'recibido' | 'respondido' | 'todas';

function Plazo({ r }: { r: ReclamacionAdmin }) {
  if (r.estado === 'respondido') {
    const enPlazo = !!r.respondido_en && r.respondido_en.slice(0, 10) <= r.plazo_vence;
    return <Chip texto={enPlazo ? 'Respondida en plazo' : 'Respondida fuera de plazo'} color={enPlazo ? C.verde : C.rojo} />;
  }
  const d = r.dias_restantes ?? 0;
  if (d < 0) return <Chip texto={`Vencida hace ${-d} d. háb.`} color={C.rojo} />;
  if (d === 0) return <Chip texto="Vence hoy" color={C.rojo} />;
  return <Chip texto={`Quedan ${d} d. háb.`} color={d <= 3 ? C.ambar : C.azulMedio} />;
}

/**
 * Libro de reclamaciones (ES-15): las hojas pendientes primero, ordenadas por
 * vencimiento. La respuesta se guarda en la base y se manda al correo del
 * reclamante; queda en la bitácora con si fue en plazo.
 */
export default function ReclamacionesAdmin() {
  const [filtro, setFiltro] = useState<Filtro>('recibido');
  const [filas, setFilas] = useState<ReclamacionAdmin[] | null>(null);
  const [indicador, setIndicador] = useState<IndicadorReclamaciones | null>(null);
  const [abierta, setAbierta] = useState<ReclamacionAdmin | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [xs, ind] = await Promise.all([
        api.reclamacionesAdmin(filtro === 'todas' ? null : filtro),
        api.indicadorReclamaciones(),
      ]);
      setFilas(xs);
      setIndicador(ind);
      setAbierta((a) => (a ? xs.find((x) => x.id === a.id) ?? null : null));
    } catch (e) {
      setError((e as Error).message);
      setFilas([]);
    }
  }, [filtro]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function responder(r: ReclamacionAdmin) {
    if (respuesta.trim().length < 20) {
      avisar('Respuesta muy corta', 'Escribe una respuesta completa: qué revisaron y qué van a hacer.');
      return;
    }
    if (!(await confirmar('Enviar respuesta', `Se guardará y se enviará a ${r.correo}. No se puede editar después.`, 'Enviar'))) return;
    setOcupado(true);
    try {
      const enviada = await api.responderReclamacion(r.id, respuesta.trim());
      setRespuesta('');
      if (!enviada) {
        avisar('Respuesta guardada', 'No se pudo enviar el correo. Usa «Reenviar respuesta» o escríbele desde el correo del equipo.');
      }
      await cargar();
    } catch (e) {
      avisar('No se pudo responder', (e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const columnas: Columna<ReclamacionAdmin>[] = [
    { clave: 'correlativo', titulo: 'Hoja', ancho: 1.3 },
    { clave: 'creado_en', titulo: 'Recibida', ancho: 1.2, render: (r) => fecha(r.creado_en), valor: (r) => r.creado_en },
    { clave: 'tipo', titulo: 'Tipo', ancho: 0.8, render: (r) => (r.tipo === 'reclamo' ? 'Reclamo' : 'Queja') },
    { clave: 'nombre', titulo: 'Reclamante', ancho: 1.8 },
    { clave: 'plazo', titulo: 'Plazo', ancho: 1.6, render: (r) => <Plazo r={r} />, valor: (r) => r.plazo_vence },
  ];

  const tasa =
    indicador && indicador.recibidas > 0
      ? `${Math.round((100 * indicador.en_plazo) / indicador.recibidas)} %`
      : '—';

  return (
    <PaginaAdmin
      titulo="Libro de reclamaciones"
      subtitulo="Plazo legal: 15 días hábiles desde que se recibe la hoja."
      acciones={
        <BotonAdmin
          titulo="Exportar CSV"
          icono="download-outline"
          onPress={() =>
            descargarCsv(
              `encargalo-reclamaciones-${filtro}.csv`,
              (filas ?? []).map((r) => ({
                hoja: r.correlativo,
                recibida: r.creado_en,
                tipo: r.tipo,
                reclamante: r.nombre,
                correo: r.correo,
                plazo_vence: r.plazo_vence,
                estado: r.estado,
                respondida: r.respondido_en,
              })),
            )
          }
        />
      }>
      {indicador && (
        <GrillaKpi>
          <Kpi icono="book" etiqueta="Recibidas" valor={String(indicador.recibidas)} />
          <Kpi icono="time" etiqueta="Pendientes" valor={String(indicador.pendientes)} color={C.ambar}
            detalle={indicador.vencidas ? `${indicador.vencidas} vencidas` : undefined} />
          <Kpi icono="checkmark-done" etiqueta="ES-15 · en plazo" valor={tasa} color={C.verde}
            detalle={`${indicador.en_plazo} de ${indicador.recibidas} respondidas a tiempo`} />
        </GrillaKpi>
      )}

      <Fichas
        valor={filtro}
        onCambiar={(f) => {
          setFiltro(f);
          setAbierta(null);
        }}
        opciones={[
          { valor: 'recibido', etiqueta: 'Por responder', conteo: indicador?.pendientes },
          { valor: 'respondido', etiqueta: 'Respondidas', conteo: indicador?.respondidas },
          { valor: 'todas', etiqueta: 'Todas' },
        ]}
      />
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}

      {filas === null ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnas}
          filas={filas}
          clave={(r) => r.id}
          onFila={(r) => {
            setAbierta(r);
            setRespuesta('');
          }}
          vacio={filtro === 'recibido' ? 'No hay hojas por responder.' : 'Todavía no hay hojas.'}
        />
      )}

      {abierta && (
        <Bloque titulo={`Hoja ${abierta.correlativo}`} icono="document-text" derecha={<Plazo r={abierta} />}>
          <View style={s.rejilla}>
            <Campo k="Recibida" v={fechaHora(abierta.creado_en)} />
            <Campo k="Vence" v={fecha(abierta.plazo_vence)} />
            <Campo k="Reclamante" v={abierta.nombre} />
            <Campo k={abierta.documento_tipo} v={abierta.documento_numero} />
            <Campo k="Domicilio" v={abierta.domicilio} />
            <Campo k="Correo" v={abierta.correo} />
            <Campo k="Teléfono" v={abierta.telefono} />
            <Campo k="Apoderado" v={abierta.menor_de_edad ? abierta.apoderado : null} />
            <Campo k={abierta.bien_tipo === 'producto' ? 'Producto' : 'Servicio'} v={abierta.bien_descripcion} />
            <Campo k="Monto" v={abierta.monto != null ? soles(abierta.monto) : null} />
            <Campo k="Pedido vinculado" v={abierta.pedido_id} />
            <Campo k="Copia al correo" v={abierta.copia_enviada_en ? fechaHora(abierta.copia_enviada_en) : 'No enviada'} />
          </View>
          <Text style={s.etiqueta}>{abierta.tipo === 'reclamo' ? 'Reclamo' : 'Queja'}</Text>
          <Text style={s.texto}>{abierta.detalle}</Text>
          <Text style={s.etiqueta}>Solicita</Text>
          <Text style={s.texto}>{abierta.pedido_consumidor}</Text>

          {abierta.estado === 'respondido' ? (
            <>
              <Text style={s.etiqueta}>
                Respuesta · {abierta.respondido_en ? fechaHora(abierta.respondido_en) : ''} · {abierta.respondido_por_nombre ?? ''}
              </Text>
              <Text style={s.texto}>{abierta.respuesta}</Text>
              <Text style={s.nota}>
                {abierta.respuesta_enviada_en
                  ? `Enviada al correo ${fechaHora(abierta.respuesta_enviada_en)}`
                  : 'La respuesta todavía no llegó al correo del reclamante.'}
              </Text>
              {!abierta.respuesta_enviada_en && (
                <BotonAdmin
                  titulo="Reenviar respuesta"
                  icono="mail-outline"
                  deshabilitado={ocupado}
                  onPress={async () => {
                    setOcupado(true);
                    const ok = await api.reenviarRespuestaReclamacion(abierta.id);
                    setOcupado(false);
                    if (!ok) avisar('No se pudo enviar', 'Revisa los secretos BREVO_API_KEY y CORREO_REMITENTE de la función.');
                    await cargar();
                  }}
                />
              )}
            </>
          ) : (
            <>
              <Text style={s.etiqueta}>Respuesta al reclamante</Text>
              <TextInput
                value={respuesta}
                onChangeText={setRespuesta}
                multiline
                placeholder="Qué revisaron, qué decidieron y qué harán (por ejemplo, la devolución y en cuántos días)."
                style={s.entrada}
              />
              <BotonAdmin
                titulo={ocupado ? 'Enviando…' : 'Enviar respuesta'}
                icono="send"
                variante="primario"
                deshabilitado={ocupado || respuesta.trim().length < 20}
                onPress={() => responder(abierta)}
              />
            </>
          )}
        </Bloque>
      )}
    </PaginaAdmin>
  );
}

function Campo({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <View style={s.campo}>
      <Text style={s.clave}>{k}</Text>
      <Text style={s.valor}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: E.md, marginBottom: E.md },
  campo: { minWidth: 200, flexGrow: 1, flexBasis: '30%' },
  clave: { fontSize: 12, color: C.textoSuave, fontWeight: '700' },
  valor: { fontSize: 14, color: C.texto },
  etiqueta: { fontSize: 13, fontWeight: '800', color: C.azul, marginTop: E.md },
  texto: { fontSize: 14, color: C.texto, lineHeight: 21, marginTop: 4 },
  nota: { fontSize: 12.5, color: C.textoSuave, marginVertical: E.sm },
  entrada: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: R.md,
    padding: E.md,
    marginVertical: E.sm,
    textAlignVertical: 'top',
    fontSize: 14,
    color: C.texto,
    backgroundColor: C.blanco,
  },
});
