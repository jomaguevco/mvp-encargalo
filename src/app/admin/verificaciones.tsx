import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Operador from '@/app/(app)/operador';
import * as api from '@/lib/api';
import { fechaHora } from '@/lib/negocio';
import type { FiltroVerificaciones, VerificacionHistorial } from '@/lib/tipos';
import {
  BotonAdmin,
  ChipIa,
  ChipReniec,
  ChipVerificacion,
  descargarCsv,
  Fichas,
  PaginaAdmin,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Cargando } from '@/ui/componentes';
import { useEscritorio } from '@/ui/escritorio';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

type Vista = 'cola' | 'historial';

const FILTROS: { valor: FiltroVerificaciones; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'por_revisar', etiqueta: 'Por revisar' },
  { valor: 'auto_aprobadas', etiqueta: 'Aprobadas por la IA' },
  { valor: 'auto_rechazadas', etiqueta: 'Rechazadas por la IA' },
  { valor: 'equipo', etiqueta: 'Decididas por el equipo' },
  { valor: 'rechazadas', etiqueta: 'Todas las rechazadas' },
];

const siNo = (v: boolean | null) => (v == null ? '—' : v ? 'Sí' : 'No');

/**
 * Verificaciones de identidad.
 *
 * La biometría (Edge Function verificar-identidad) aprueba sola lo que
 * coincide y rechaza lo que es claramente otra persona; lo dudoso queda «en
 * revisión» para el equipo. «Por revisar» es esa cola, con las mismas
 * herramientas de la consola del equipo: fotos, similitud, RENIEC, aprobar o
 * rechazar y borrado de las imágenes al resolver. «Historial» audita el
 * filtro: qué decidió la IA, qué decidió el equipo y quién.
 */
export default function VerificacionesAdmin() {
  const [vista, setVista] = useState<Vista>('cola');
  const [filtro, setFiltro] = useState<FiltroVerificaciones>('todas');
  const [filas, setFilas] = useState<VerificacionHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { es: escritorio } = useEscritorio();

  const cargar = useCallback(async (f: FiltroVerificaciones) => {
    try {
      setError(null);
      setFilas(await api.historialVerificaciones(f, 300));
    } catch (e) {
      setError((e as Error).message);
      setFilas([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (vista === 'historial') cargar(filtro);
    }, [vista, filtro, cargar]),
  );

  const selector = (
    <View style={[s.barra, escritorio && s.barraEscritorio]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.titulo}>Verificaciones</Text>
        <Text style={s.subtitulo}>
          Lo que el filtro biométrico no pudo decidir solo, y el historial de cada decisión.
        </Text>
      </View>
      <Fichas
        valor={vista}
        opciones={[
          { valor: 'cola', etiqueta: 'Por revisar' },
          { valor: 'historial', etiqueta: 'Historial y auditoría' },
        ]}
        onCambiar={setVista}
      />
    </View>
  );

  if (vista === 'cola') {
    return (
      <View style={{ flex: 1, backgroundColor: C.fondo }}>
        {selector}
        <Operador soloCola="verificaciones" />
      </View>
    );
  }

  const columnas: Columna<VerificacionHistorial>[] = [
    {
      clave: 'nombre_completo',
      titulo: 'Persona',
      ancho: 2,
      render: (v) => (
        <View>
          <Text style={s.fuerte} numberOfLines={1}>{v.nombre_completo || 'Sin nombre'}</Text>
          <Text style={s.suave}>DNI {v.dni ?? '—'}</Text>
        </View>
      ),
    },
    { clave: 'verificacion', titulo: 'Estado', ancho: 1.2, render: (v) => <ChipVerificacion estado={v.verificacion} /> },
    { clave: 'ia_resultado', titulo: 'Biometría', ancho: 1.2, render: (v) => <ChipIa resultado={v.ia_resultado} /> },
    {
      clave: 'ia_similitud',
      titulo: 'Similitud',
      alinear: 'derecha',
      render: (v) => (v.ia_similitud == null ? '—' : `${Number(v.ia_similitud).toFixed(1)} %`),
    },
    {
      clave: 'coincidencias',
      titulo: 'Número / nombre',
      ancho: 1.1,
      render: (v) => `${siNo(v.ia_numero_coincide)} / ${siNo(v.ia_nombre_coincide)}`,
    },
    { clave: 'dni_validacion', titulo: 'RENIEC', ancho: 1.3, render: (v) => <ChipReniec r={v.dni_validacion} /> },
    {
      clave: 'decidio',
      titulo: 'Decidió',
      ancho: 1.5,
      render: (v) => (
        <View>
          <Text style={s.celda} numberOfLines={1}>{v.decidio ?? (v.verificacion === 'en_revision' ? 'Pendiente' : '—')}</Text>
          <Text style={s.suave}>{fechaHora(v.decidido_en ?? v.ia_evaluado_en)}</Text>
        </View>
      ),
    },
    {
      clave: 'motivo',
      titulo: 'Detalle',
      ancho: 2,
      render: (v) => v.motivo_rechazo || v.ia_detalle || '—',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.fondo }}>
      {selector}
      <PaginaAdmin
        titulo="Historial del filtro biométrico"
        subtitulo="Toca una fila para abrir la ficha de la cuenta."
        acciones={
          <BotonAdmin
            titulo="Exportar CSV"
            icono="download-outline"
            onPress={() =>
              descargarCsv(
                `encargalo-verificaciones-${filtro}.csv`,
                (filas ?? []).map((v) => ({
                  nombre: v.nombre_completo,
                  dni: v.dni,
                  estado: v.verificacion,
                  biometria: v.ia_resultado,
                  similitud: v.ia_similitud,
                  numero_coincide: v.ia_numero_coincide,
                  nombre_coincide: v.ia_nombre_coincide,
                  reniec: v.dni_validacion,
                  decidio: v.decidio,
                  decidido_en: v.decidido_en,
                  evaluado_en: v.ia_evaluado_en,
                  detalle: v.motivo_rechazo || v.ia_detalle,
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
          <Tabla
            columnas={columnas}
            filas={filas}
            clave={(v) => v.perfil_id}
            onFila={(v) => router.push(`/admin/cuenta/${v.perfil_id}`)}
            vacio="No hay verificaciones con este filtro"
          />
        )}
      </PaginaAdmin>
    </View>
  );
}

const s = StyleSheet.create({
  barra: {
    padding: E.lg,
    gap: E.md,
    backgroundColor: C.fondo,
    borderBottomWidth: 1,
    borderColor: C.borde,
  },
  barraEscritorio: { paddingHorizontal: E.xxl, flexDirection: 'row', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: C.azul },
  subtitulo: { fontSize: 14, color: C.textoSuave },
  fuerte: { fontSize: 14, fontWeight: '700', color: C.texto },
  suave: { fontSize: 12.5, color: C.grisTexto },
  celda: { fontSize: 14, color: C.texto },
});
