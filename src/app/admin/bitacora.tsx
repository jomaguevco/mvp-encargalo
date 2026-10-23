import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import * as api from '@/lib/api';
import { fechaHora } from '@/lib/negocio';
import type { EntradaBitacora } from '@/lib/tipos';
import {
  ACCION_BITACORA,
  BotonAdmin,
  descargarCsv,
  Fichas,
  PaginaAdmin,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Cargando } from '@/ui/componentes';

type Tipo = 'todos' | 'perfil' | 'pago' | 'disputa' | 'config';

const TIPOS: { valor: Tipo; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todo' },
  { valor: 'perfil', etiqueta: 'Cuentas y verificaciones' },
  { valor: 'pago', etiqueta: 'Pagos' },
  { valor: 'disputa', etiqueta: 'Disputas' },
  { valor: 'config', etiqueta: 'Configuración' },
];

/** Resume el detalle guardado en jsonb en una línea legible. */
function detalleLegible(e: EntradaBitacora) {
  const d = e.detalle ?? {};
  const partes: string[] = [];
  if (d.nombre) partes.push(String(d.nombre));
  if (d.rol) partes.push(`rol ${d.rol}`);
  if (d.motivo) partes.push(String(d.motivo));
  if (d.ia_similitud != null) partes.push(`similitud ${d.ia_similitud} %`);
  if (d.total != null) partes.push(`S/ ${Number(d.total).toFixed(2)}`);
  if (d.antes != null) partes.push(`${d.antes} → ${d.despues}`);
  if (d.resolucion) partes.push(String(d.resolucion));
  if (e.objetivo_tipo === 'config' && e.objetivo_id) partes.unshift(e.objetivo_id);
  return partes.join(' · ') || '—';
}

/**
 * Bitácora del equipo: cada decisión que toca una cuenta, un pago, una
 * disputa o la configuración, con quién la tomó. Las de la biometría
 * aparecen como «Sistema». Nadie puede editarla ni borrarla.
 */
export default function BitacoraAdmin() {
  const [tipo, setTipo] = useState<Tipo>('todos');
  const [filas, setFilas] = useState<EntradaBitacora[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(await api.bitacoraAdmin(500, tipo === 'todos' ? null : tipo));
    } catch (e) {
      setError((e as Error).message);
      setFilas([]);
    }
  }, [tipo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const columnas: Columna<EntradaBitacora>[] = [
    { clave: 'fecha', titulo: 'Fecha', ancho: 1.4, render: (e) => fechaHora(e.creado_en) },
    { clave: 'accion', titulo: 'Acción', ancho: 2.4, render: (e) => ACCION_BITACORA[e.accion] ?? e.accion },
    { clave: 'actor', titulo: 'Quién', ancho: 1.4 },
    { clave: 'detalle', titulo: 'Detalle', ancho: 3.5, render: detalleLegible },
  ];

  function abrir(e: EntradaBitacora) {
    if (!e.objetivo_id) return;
    if (e.objetivo_tipo === 'perfil') router.push(`/admin/cuenta/${e.objetivo_id}`);
    else if (e.objetivo_tipo === 'pago') router.push(`/pedido/${e.objetivo_id}`);
    else if (e.objetivo_tipo === 'disputa' && typeof e.detalle?.pedido_id === 'string') {
      router.push(`/pedido/${e.detalle.pedido_id}`);
    }
  }

  return (
    <PaginaAdmin
      titulo="Bitácora"
      subtitulo="Quién hizo qué y cuándo. Toca una fila para abrir la cuenta o el pedido."
      acciones={
        <BotonAdmin
          titulo="Exportar CSV"
          icono="download-outline"
          onPress={() =>
            descargarCsv(
              `encargalo-bitacora-${tipo}.csv`,
              (filas ?? []).map((e) => ({
                fecha: e.creado_en,
                accion: ACCION_BITACORA[e.accion] ?? e.accion,
                quien: e.actor,
                tipo: e.objetivo_tipo,
                objetivo: e.objetivo_id,
                detalle: detalleLegible(e),
              })),
            )
          }
        />
      }>
      <Fichas valor={tipo} opciones={TIPOS} onCambiar={setTipo} />
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      {filas === null ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnas}
          filas={filas}
          clave={(e) => String(e.id)}
          onFila={abrir}
          vacio="Todavía no hay acciones registradas. Se llena a partir de la migración 0012."
        />
      )}
    </PaginaAdmin>
  );
}
