import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { fecha, hace } from '@/lib/negocio';
import type { CuentaAdmin, FiltroCuentas } from '@/lib/tipos';
import {
  BotonAdmin,
  Buscador,
  ChipIa,
  ChipVerificacion,
  descargarCsv,
  Fichas,
  PaginaAdmin,
  Paginador,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Avatar, Cargando, Chip } from '@/ui/componentes';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

const POR_PAGINA = 50;

const FILTROS: { valor: FiltroCuentas; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'verificadas', etiqueta: 'Verificadas' },
  { valor: 'en_revision', etiqueta: 'En revisión' },
  { valor: 'pendientes', etiqueta: 'Sin verificar' },
  { valor: 'rechazadas', etiqueta: 'Rechazadas' },
  { valor: 'suspendidas', etiqueta: 'Suspendidas' },
  { valor: 'compradores', etiqueta: 'Compradores externos' },
  { valor: 'equipo', etiqueta: 'Equipo' },
];

/** Todas las cuentas de Encárgalo, con búsqueda por nombre, correo, DNI o celular. */
export default function CuentasAdmin() {
  const [filtro, setFiltro] = useState<FiltroCuentas>('todas');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState(0);
  const [filas, setFilas] = useState<CuentaAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(await api.cuentasAdmin({ busqueda, filtro, limite: POR_PAGINA, desde }));
    } catch (e) {
      setError((e as Error).message);
      setFilas([]);
    }
  }, [busqueda, filtro, desde]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function exportar() {
    // Exporta todas las que cumplen el filtro, no solo la página visible.
    setExportando(true);
    try {
      const todas = await api.cuentasAdmin({ busqueda, filtro, limite: 500, desde: 0 });
      descargarCsv(
        `encargalo-cuentas-${filtro}.csv`,
        todas.map((c) => ({
          nombre: c.nombre_completo,
          correo: c.correo,
          telefono: c.telefono,
          dni: c.dni,
          ciudad: c.ciudad,
          verificacion: c.verificacion,
          biometria: c.ia_resultado,
          reniec: c.dni_validacion,
          comprador_externo: c.es_comprador,
          suspendida: c.suspendido,
          operador: c.es_operador,
          administrador: c.es_admin,
          pedidos: c.pedidos,
          ofertas: c.ofertas,
          calificacion: c.calificacion,
          registro: c.creado_en,
          ultimo_ingreso: c.ultimo_ingreso,
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportando(false);
    }
  }

  const total = filas?.[0]?.total ?? 0;

  const columnas: Columna<CuentaAdmin>[] = [
    {
      clave: 'nombre',
      titulo: 'Cuenta',
      ancho: 2.6,
      render: (c) => (
        <View style={s.persona}>
          <Avatar nombre={c.nombre_completo} tamano={34} verificado={c.verificacion === 'verificado'} />
          <View style={{ flex: 1 }}>
            <Text style={s.fuerte} numberOfLines={1}>{c.nombre_completo || 'Sin nombre'}</Text>
            <Text style={s.suave} numberOfLines={1}>{c.correo ?? '—'}</Text>
          </View>
        </View>
      ),
    },
    { clave: 'dni', titulo: 'DNI', render: (c) => c.dni ?? '—' },
    { clave: 'verificacion', titulo: 'Identidad', ancho: 1.3, render: (c) => <ChipVerificacion estado={c.verificacion} /> },
    { clave: 'ia', titulo: 'Biometría', ancho: 1.2, render: (c) => <ChipIa resultado={c.ia_resultado} /> },
    {
      clave: 'roles',
      titulo: 'Rol y estado',
      ancho: 1.5,
      render: (c) => (
        <View style={{ gap: 4, alignItems: 'flex-start' }}>
          {c.suspendido && <Chip texto="Suspendida" color={C.rojo} icono="ban" />}
          {c.parecidas > 0 && <Chip texto="Posible duplicado" color={C.ambar} icono="copy" />}
          {c.es_admin ? (
            <Chip texto="Administrador" color={C.azul} icono="shield-checkmark" />
          ) : c.es_operador ? (
            <Chip texto="Operador" color={C.azulMedio} icono="shield-half" />
          ) : (
            <Text style={s.celda}>{c.es_comprador ? 'Cliente y comprador' : 'Cliente'}</Text>
          )}
        </View>
      ),
    },
    {
      clave: 'actividad',
      titulo: 'Pedidos / ofertas',
      alinear: 'derecha',
      render: (c) => `${c.pedidos} / ${c.ofertas}`,
    },
    {
      clave: 'calificacion',
      titulo: 'Nota',
      alinear: 'derecha',
      render: (c) => (c.calificacion == null ? '—' : `${Number(c.calificacion).toFixed(1)} ★`),
    },
    {
      clave: 'fechas',
      titulo: 'Registro',
      ancho: 1.3,
      render: (c) => (
        <View>
          <Text style={s.celda}>{fecha(c.creado_en)}</Text>
          <Text style={s.suave}>{c.ultimo_ingreso ? `Entró ${hace(c.ultimo_ingreso)}` : 'Nunca entró'}</Text>
        </View>
      ),
    },
  ];

  return (
    <PaginaAdmin
      titulo="Cuentas"
      subtitulo="Toca una cuenta para ver su ficha, suspenderla o cambiar su rol."
      acciones={
        <BotonAdmin
          titulo={exportando ? 'Exportando…' : 'Exportar CSV'}
          icono="download-outline"
          onPress={exportar}
          deshabilitado={exportando}
        />
      }>
      <View style={s.filtros}>
        <Buscador
          valor={texto}
          onCambiar={setTexto}
          onBuscar={() => {
            setDesde(0);
            setBusqueda(texto);
          }}
          placeholder="Nombre, correo, DNI o celular (Enter para buscar)"
        />
      </View>
      <Fichas
        valor={filtro}
        opciones={FILTROS}
        onCambiar={(f) => {
          setDesde(0);
          setFiltro(f);
        }}
      />
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      {filas === null ? (
        <Cargando />
      ) : (
        <>
          <Tabla
            columnas={columnas}
            filas={filas}
            clave={(c) => c.perfil_id}
            onFila={(c) => router.push(`/admin/cuenta/${c.perfil_id}`)}
            vacio="Ninguna cuenta coincide con la búsqueda"
          />
          <Paginador desde={desde} porPagina={POR_PAGINA} total={total} onCambiar={setDesde} />
        </>
      )}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  filtros: { flexDirection: 'row', gap: E.md, flexWrap: 'wrap' },
  persona: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  fuerte: { fontSize: 14, fontWeight: '700', color: C.texto },
  suave: { fontSize: 12.5, color: C.grisTexto },
  celda: { fontSize: 14, color: C.texto },
});
