import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { TIPO_RECLAMACION, fecha, fechaHora, soles } from '@/lib/negocio';
import type { EstadoReclamacion, ReclamacionAdmin } from '@/lib/tipos';
import {
  Bloque,
  BotonAdmin,
  descargarCsv,
  Fichas,
  GrillaKpi,
  Kpi,
  PaginaAdmin,
} from '@/ui/admin';
import { Aviso, Cargando, Chip } from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { Text, TextInput } from '@/ui/Texto';
import { C, E, R } from '@/ui/tema';

type Filtro = EstadoReclamacion | 'todas';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Por responder' },
  { valor: 'respondido', etiqueta: 'Respondidas' },
  { valor: 'todas', etiqueta: 'Todas' },
];

/** El plazo legal en palabras: «vence en 3 días hábiles», «vencido hace 2». */
function Plazo({ r }: { r: ReclamacionAdmin }) {
  if (r.estado === 'respondido') {
    return <Chip texto={`Respondido el ${fecha(r.respondido_en)}`} color={C.verde} icono="checkmark-circle" />;
  }
  const d = r.dias_restantes;
  if (d < 0) {
    return (
      <Chip
        texto={`Vencido hace ${-d} día${d === -1 ? '' : 's'} hábil${d === -1 ? '' : 'es'}`}
        color={C.rojo}
        icono="alert-circle"
      />
    );
  }
  const texto =
    d === 0 ? 'Vence hoy' : `Vence en ${d} día${d === 1 ? '' : 's'} hábil${d === 1 ? '' : 'es'}`;
  return <Chip texto={`${texto} · ${fecha(r.vence_en)}`} color={d <= 3 ? C.ambar : C.azulMedio} icono="time" />;
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <View style={s.campo}>
      <Text style={s.campoEtiqueta}>{etiqueta}</Text>
      <Text style={s.campoValor} selectable>
        {valor?.toString().trim() ? valor : '—'}
      </Text>
    </View>
  );
}

/**
 * Libro de reclamaciones (acción ES-15). Cada hoja con su plazo legal de 15
 * días hábiles y el campo para registrar la respuesta del proveedor. Solo
 * lo ve el administrador (RLS en 0020_libro_reclamaciones).
 */
export default function ReclamacionesAdmin() {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [filas, setFilas] = useState<ReclamacionAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(await api.reclamacionesAdmin(filtro === 'todas' ? null : filtro));
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
    const texto = (borradores[r.id] ?? '').trim();
    if (texto.length < 20) {
      avisar('Falta la respuesta', 'Escribe la respuesta completa al consumidor (mínimo 20 caracteres).');
      return;
    }
    const ok = await confirmar(
      `Registrar la respuesta a ${r.numero}`,
      'La respuesta queda registrada en la hoja y ya no se puede editar.\n\n' +
        `Recuerda enviarla también a ${r.correo}: la app todavía no envía correos.`,
      'Registrar',
    );
    if (!ok) return;
    setOcupado(r.id);
    try {
      await api.responderReclamacion(r.id, texto);
      setBorradores((b) => {
        const { [r.id]: _, ...resto } = b;
        return resto;
      });
      await cargar();
    } catch (e) {
      avisar('No se pudo registrar', (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const xs = filas ?? [];
  const pendientes = xs.filter((r) => r.estado === 'pendiente');

  return (
    <PaginaAdmin
      titulo="Libro de reclamaciones"
      subtitulo="Cada hoja se responde en un máximo de 15 días hábiles (Ley N° 29571, D.S. N° 011-2011-PCM)."
      onRefrescar={cargar}
      acciones={
        <BotonAdmin
          titulo="Exportar CSV"
          icono="download-outline"
          onPress={() =>
            descargarCsv(
              `encargalo-reclamaciones-${filtro}.csv`,
              xs.map((r) => ({
                numero: r.numero,
                fecha: r.creado_en,
                tipo: r.tipo,
                nombre: r.nombre,
                documento: `${r.tipo_documento} ${r.numero_documento}`,
                domicilio: r.domicilio,
                telefono: r.telefono,
                correo: r.correo,
                menor_de_edad: r.menor_de_edad ? 'sí' : 'no',
                apoderado: r.apoderado,
                bien: r.bien_tipo,
                descripcion_bien: r.bien_descripcion,
                monto: r.monto,
                codigo_pedido: r.codigo_pedido,
                detalle: r.detalle,
                pedido_del_consumidor: r.pedido_consumidor,
                vence: r.vence_en,
                estado: r.estado,
                respuesta: r.respuesta,
                respondido_en: r.respondido_en,
                respondido_por: r.respondido_por,
              })),
            )
          }
        />
      }>
      <Fichas valor={filtro} opciones={FILTROS} onCambiar={setFiltro} />
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      {filas === null ? (
        <Cargando />
      ) : (
        <>
          <GrillaKpi>
            <Kpi icono="book" etiqueta="Hojas en la lista" valor={String(xs.length)} />
            <Kpi icono="hourglass" etiqueta="Por responder" valor={String(pendientes.length)} color={C.ambar} />
            <Kpi
              icono="alert-circle"
              etiqueta="Vencidas sin respuesta"
              valor={String(pendientes.filter((r) => r.dias_restantes < 0).length)}
              color={C.rojo}
            />
            <Kpi
              icono="time"
              etiqueta="Vencen en 3 días hábiles o menos"
              valor={String(pendientes.filter((r) => r.dias_restantes >= 0 && r.dias_restantes <= 3).length)}
              color={C.naranja}
            />
          </GrillaKpi>

          {xs.length === 0 && (
            <Text style={s.vacio}>
              {filtro === 'pendiente' ? 'No hay hojas por responder.' : 'No hay hojas en esta lista.'}
            </Text>
          )}

          {xs.map((r) => (
            <Bloque
              key={r.id}
              titulo={`${r.numero} · ${TIPO_RECLAMACION[r.tipo]?.etiqueta ?? r.tipo}`}
              icono={r.tipo === 'queja' ? 'chatbox-ellipses-outline' : 'document-text-outline'}
              derecha={<Plazo r={r} />}>
              <Text style={s.suave}>Registrada el {fechaHora(r.creado_en)}</Text>

              <Text style={s.seccion}>Consumidor</Text>
              <View style={s.rejilla}>
                <Campo etiqueta="Nombre" valor={r.nombre} />
                <Campo etiqueta="Documento" valor={`${r.tipo_documento} ${r.numero_documento}`} />
                <Campo etiqueta="Domicilio" valor={r.domicilio} />
                <Campo etiqueta="Teléfono" valor={r.telefono} />
                <Campo etiqueta="Correo" valor={r.correo} />
                {r.menor_de_edad && <Campo etiqueta="Padre, madre o apoderado" valor={r.apoderado} />}
              </View>

              <Text style={s.seccion}>Bien contratado</Text>
              <View style={s.rejilla}>
                <Campo etiqueta="Tipo" valor={r.bien_tipo === 'producto' ? 'Producto' : 'Servicio'} />
                <Campo etiqueta="Monto reclamado" valor={r.monto != null ? soles(r.monto) : null} />
                <Campo etiqueta="Código de pedido" valor={r.codigo_pedido} />
              </View>
              <Campo etiqueta="Descripción" valor={r.bien_descripcion} />

              <Text style={s.seccion}>Detalle y pedido del consumidor</Text>
              <Campo etiqueta="Detalle" valor={r.detalle} />
              <Campo etiqueta="Pedido del consumidor" valor={r.pedido_consumidor} />

              <Text style={s.seccion}>Respuesta del proveedor</Text>
              {r.estado === 'respondido' ? (
                <>
                  <Campo etiqueta={`${r.respondido_por ?? 'Equipo'} · ${fechaHora(r.respondido_en)}`} valor={r.respuesta} />
                </>
              ) : (
                <View style={{ gap: E.sm }}>
                  <TextInput
                    value={borradores[r.id] ?? ''}
                    onChangeText={(t) => setBorradores((b) => ({ ...b, [r.id]: t }))}
                    multiline
                    placeholder="Qué se verificó, qué decidió Encárgalo y qué se hará (reembolso, reenvío, etc.)."
                    placeholderTextColor={C.grisTexto}
                    style={s.respuesta}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <BotonAdmin
                      titulo={ocupado === r.id ? 'Guardando…' : 'Registrar respuesta'}
                      icono="send-outline"
                      variante="primario"
                      deshabilitado={ocupado === r.id || !(borradores[r.id] ?? '').trim()}
                      onPress={() => responder(r)}
                    />
                  </View>
                </View>
              )}
            </Bloque>
          ))}
        </>
      )}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  suave: { fontSize: 12.5, color: C.grisTexto },
  vacio: { fontSize: 14, color: C.textoSuave, textAlign: 'center', paddingVertical: E.xl },
  seccion: {
    fontSize: 12,
    fontWeight: '700',
    color: C.azulMedio,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: E.md,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', columnGap: E.lg },
  campo: { gap: 2, paddingVertical: 4, minWidth: 180, flexShrink: 1 },
  campoEtiqueta: { fontSize: 12, color: C.grisTexto },
  campoValor: { fontSize: 14, color: C.texto, lineHeight: 20 },
  respuesta: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: R.sm,
    padding: E.md,
    fontSize: 14,
    color: C.texto,
    backgroundColor: C.blanco,
    textAlignVertical: 'top',
  },
});
