import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { ESTADO_PAGO, fechaHora, soles } from '@/lib/negocio';
import type { EstadoPago, PagoAdmin } from '@/lib/tipos';
import {
  BotonAdmin,
  ChipPago,
  descargarCsv,
  Fichas,
  GrillaKpi,
  Kpi,
  PaginaAdmin,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Cargando } from '@/ui/componentes';
import { Text } from '@/ui/Texto';
import { C } from '@/ui/tema';

type Filtro = EstadoPago | 'todos';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  ...(Object.keys(ESTADO_PAGO) as EstadoPago[]).map((e) => ({
    valor: e as Filtro,
    etiqueta: ESTADO_PAGO[e].etiqueta,
  })),
];

const suma = (xs: PagoAdmin[], f: (p: PagoAdmin) => number) =>
  xs.reduce((a, p) => a + (Number(f(p)) || 0), 0);

/**
 * Todos los pagos del escrow. Confirmar o rechazar un comprobante se hace en
 * «Operación»; aquí se audita: cuánto entró, cuánto está retenido, cuánto se
 * liberó y cuánto es comisión (lo único que es ingreso de Encárgalo).
 */
export default function PagosAdmin() {
  // El Resumen llega con ?estado=retenido para abrir ya filtrado.
  const { estado } = useLocalSearchParams<{ estado?: string }>();
  const [filtro, setFiltro] = useState<Filtro>(
    estado && estado in ESTADO_PAGO ? (estado as EstadoPago) : 'todos',
  );
  const [filas, setFilas] = useState<PagoAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(await api.pagosAdmin(filtro === 'todos' ? null : filtro, 500));
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

  const xs = filas ?? [];
  const columnas: Columna<PagoAdmin>[] = [
    {
      clave: 'titulo',
      titulo: 'Pedido',
      ancho: 2.5,
      render: (p) => (
        <View>
          <Text style={s.fuerte} numberOfLines={1}>{p.titulo}</Text>
          <Text style={s.suave} numberOfLines={1}>{p.cliente} → {p.comprador}</Text>
        </View>
      ),
    },
    { clave: 'estado', titulo: 'Estado', ancho: 1.3, render: (p) => <ChipPago estado={p.estado} /> },
    {
      clave: 'metodo',
      titulo: 'Método',
      ancho: 1.3,
      render: (p) => (
        <View>
          <Text style={s.celda}>{p.metodo ? p.metodo.toUpperCase() : '—'}</Text>
          <Text style={s.suave}>{p.codigo_operacion ?? ''}</Text>
        </View>
      ),
    },
    { clave: 'total', titulo: 'Cobrado', alinear: 'derecha', render: (p) => soles(p.total_cobrado) },
    { clave: 'comision', titulo: 'Comisión', alinear: 'derecha', render: (p) => soles(p.comision) },
    { clave: 'liberado', titulo: 'Al comprador', alinear: 'derecha', render: (p) => soles(p.monto_liberado) },
    {
      clave: 'fechas',
      titulo: 'Último movimiento',
      ancho: 1.6,
      render: (p) => fechaHora(p.liberado_en ?? p.retenido_en ?? p.reportado_en ?? p.creado_en),
    },
  ];

  return (
    <PaginaAdmin
      titulo="Pagos"
      subtitulo="El dinero retenido es de los clientes hasta que confirman: solo la comisión es ingreso."
      acciones={
        <>
          <BotonAdmin titulo="Confirmar pagos" icono="shield-checkmark-outline" onPress={() => router.push('/admin/operacion?cola=pagos')} />
          <BotonAdmin
            titulo="Exportar CSV"
            icono="download-outline"
            onPress={() =>
              descargarCsv(
                `encargalo-pagos-${filtro}.csv`,
                xs.map((p) => ({
                  pedido: p.titulo,
                  cliente: p.cliente,
                  comprador_externo: p.comprador,
                  estado: p.estado,
                  metodo: p.metodo,
                  codigo_operacion: p.codigo_operacion,
                  monto_encargo: p.monto_encargo,
                  comision: p.comision,
                  total_cobrado: p.total_cobrado,
                  monto_liberado: p.monto_liberado,
                  reportado: p.reportado_en,
                  retenido: p.retenido_en,
                  liberado: p.liberado_en,
                  id_pedido: p.pedido_id,
                })),
              )
            }
          />
        </>
      }>
      <Fichas valor={filtro} opciones={FILTROS} onCambiar={setFiltro} />
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      {filas === null ? (
        <Cargando />
      ) : (
        <>
          <GrillaKpi>
            <Kpi icono="receipt" etiqueta="Pagos en la lista" valor={String(xs.length)} />
            <Kpi icono="wallet" etiqueta="Total cobrado" valor={soles(suma(xs, (p) => p.total_cobrado))} />
            <Kpi
              icono="lock-closed"
              etiqueta="Retenido"
              valor={soles(suma(xs.filter((p) => p.estado === 'retenido'), (p) => p.total_cobrado))}
              color={C.verdeOscuro}
            />
            <Kpi
              icono="cash"
              etiqueta="Comisiones liberadas"
              valor={soles(suma(xs.filter((p) => p.estado === 'liberado'), (p) => p.comision))}
              color={C.verde}
            />
          </GrillaKpi>
          <Tabla
            columnas={columnas}
            filas={xs}
            clave={(p) => p.pedido_id}
            onFila={(p) => router.push(`/admin/pedido/${p.pedido_id}`)}
            vacio="No hay pagos con este estado"
          />
        </>
      )}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  fuerte: { fontSize: 14, fontWeight: '700', color: C.texto },
  suave: { fontSize: 12.5, color: C.grisTexto },
  celda: { fontSize: 14, color: C.texto },
});
