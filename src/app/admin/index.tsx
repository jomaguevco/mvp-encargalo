import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import * as api from '@/lib/api';
import { ESTADO_PEDIDO, soles } from '@/lib/negocio';
import type { EstadoPedido, ResumenAdmin } from '@/lib/tipos';
import {
  BarrasDiarias,
  Bloque,
  BotonAdmin,
  descargarCsv,
  Fichas,
  FilaDato,
  GrillaKpi,
  Kpi,
  PaginaAdmin,
} from '@/ui/admin';
import { Aviso, Cargando } from '@/ui/componentes';
import { useEscritorio } from '@/ui/escritorio';
import { C, E } from '@/ui/tema';

type Rango = '7' | '30' | '90' | '365';

const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: '7', etiqueta: 'Últimos 7 días' },
  { valor: '30', etiqueta: '30 días' },
  { valor: '90', etiqueta: '90 días' },
  { valor: '365', etiqueta: 'Un año' },
];

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)} %` : '—');

/**
 * Resumen y reportes: el estado del negocio en una pantalla.
 *
 * Arriba, lo que está esperando al equipo ahora mismo (no depende del
 * período). Debajo, el período elegido: cuentas, filtro biométrico, pedidos,
 * dinero y disputas, con la tendencia diaria.
 */
export default function ResumenAdminPantalla() {
  const [rango, setRango] = useState<Rango>('30');
  const [datos, setDatos] = useState<ResumenAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const { es: escritorio } = useEscritorio();

  const cargar = useCallback(async (r: Rango) => {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(hasta.getDate() - (Number(r) - 1));
    try {
      setError(null);
      setDatos(await api.resumenAdmin(desde, hasta));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(rango);
    }, [cargar, rango]),
  );

  if (!datos && !error) return <Cargando texto="Armando el reporte…" />;

  if (!datos) {
    return (
      <PaginaAdmin titulo="Resumen">
        <Aviso tono="error" titulo="No se pudo cargar el reporte">
          {`${error}. Si es la primera vez, revisa que la migración 0012_administracion.sql esté aplicada en Supabase.`}
        </Aviso>
      </PaginaAdmin>
    );
  }

  const { cuentas, biometria, pedidos, ofertas, dinero, ahora, disputas, calificaciones } = datos;
  const estados = Object.entries(pedidos.por_estado) as [EstadoPedido, number][];

  function exportar() {
    const d = datos!;
    descargarCsv(`encargalo-resumen-${rango}d.csv`, [
      { seccion: 'cuentas', ...d.cuentas },
      { seccion: 'biometria', ...d.biometria },
      { seccion: 'pedidos', publicados: d.pedidos.publicados, valor_referencial: d.pedidos.valor_referencial, ...d.pedidos.por_estado },
      { seccion: 'ofertas', ...d.ofertas },
      { seccion: 'dinero', ...d.dinero },
      { seccion: 'ahora', ...d.ahora },
      { seccion: 'disputas', ...d.disputas },
      { seccion: 'calificaciones', ...d.calificaciones },
    ]);
  }

  function exportarSerie() {
    descargarCsv(`encargalo-serie-diaria-${rango}d.csv`, datos!.serie);
  }

  return (
    <PaginaAdmin
      titulo="Resumen"
      subtitulo="El estado de Encárgalo: lo que espera al equipo y lo que pasó en el período."
      refrescando={refrescando}
      onRefrescar={async () => {
        setRefrescando(true);
        await cargar(rango);
        setRefrescando(false);
      }}
      acciones={
        <>
          <BotonAdmin titulo="Exportar resumen" icono="download-outline" onPress={exportar} />
          <BotonAdmin titulo="Exportar serie diaria" icono="calendar-outline" onPress={exportarSerie} />
        </>
      }>
      {/* --------------------------------------------- lo que espera ahora */}
      <Bloque titulo="Ahora mismo" icono="flash-outline">
        <GrillaKpi>
          <Kpi
            icono="id-card"
            etiqueta="Verificaciones por revisar"
            valor={String(ahora.verificaciones_por_revisar)}
            detalle="La biometría las dejó en manos del equipo"
            color={ahora.verificaciones_por_revisar > 0 ? C.naranja : C.verde}
            onPress={() => router.push('/admin/verificaciones')}
          />
          <Kpi
            icono="wallet"
            etiqueta="Pagos por confirmar"
            valor={String(ahora.pagos_por_confirmar)}
            detalle="Comprobantes de Yape esperando"
            color={ahora.pagos_por_confirmar > 0 ? C.naranja : C.verde}
            onPress={() => router.push('/admin/operacion')}
          />
          <Kpi
            icono="flag"
            etiqueta="Disputas abiertas"
            valor={String(ahora.disputas_abiertas)}
            color={ahora.disputas_abiertas > 0 ? C.rojo : C.verde}
            onPress={() => router.push('/admin/operacion')}
          />
          <Kpi
            icono="lock-closed"
            etiqueta="Dinero retenido hoy"
            valor={soles(ahora.retenido)}
            detalle={`${ahora.pagos_retenidos} pagos en custodia: no es ingreso`}
            color={C.verdeOscuro}
            onPress={() => router.push('/admin/pagos')}
          />
        </GrillaKpi>
      </Bloque>

      <Fichas valor={rango} opciones={RANGOS} onCambiar={setRango} />

      {/* --------------------------------------------- el período */}
      <GrillaKpi>
        <Kpi icono="person-add" etiqueta="Cuentas nuevas" valor={String(cuentas.nuevas)} detalle={`${cuentas.total} en total`} />
        <Kpi icono="cube" etiqueta="Pedidos publicados" valor={String(pedidos.publicados)} detalle={`${ofertas.enviadas} ofertas recibidas`} />
        <Kpi icono="swap-horizontal" etiqueta="Valor transado" valor={soles(dinero.valor_transado)} detalle="Pagos retenidos y liberados" color={C.azulMedio} />
        <Kpi icono="cash" etiqueta="Comisiones ganadas" valor={soles(dinero.comisiones)} detalle={`${dinero.pagos_liberados} pedidos liberados`} color={C.verde} />
      </GrillaKpi>

      <Bloque titulo="Actividad diaria" icono="bar-chart-outline">
        <BarrasDiarias
          serie={datos.serie}
          campos={[
            { clave: 'registros', etiqueta: 'Registros', color: C.azulMedio },
            { clave: 'pedidos', etiqueta: 'Pedidos', color: C.naranja },
            { clave: 'pagos', etiqueta: 'Pagos retenidos', color: C.trigo },
          ]}
        />
      </Bloque>

      <View style={{ flexDirection: escritorio ? 'row' : 'column', gap: E.lg, alignItems: 'flex-start' }}>
        <Bloque titulo="Cuentas" icono="people-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          <FilaDato etiqueta="Verificadas" valor={`${cuentas.verificadas} · ${pct(cuentas.verificadas, cuentas.total)}`} proporcion={cuentas.verificadas / Math.max(1, cuentas.total)} color={C.verde} />
          <FilaDato etiqueta="En revisión" valor={String(cuentas.en_revision)} proporcion={cuentas.en_revision / Math.max(1, cuentas.total)} color={C.ambar} />
          <FilaDato etiqueta="Sin verificar" valor={String(cuentas.pendientes)} proporcion={cuentas.pendientes / Math.max(1, cuentas.total)} color={C.grisTexto} />
          <FilaDato etiqueta="Rechazadas" valor={String(cuentas.rechazadas)} proporcion={cuentas.rechazadas / Math.max(1, cuentas.total)} color={C.rojo} />
          <FilaDato etiqueta="Suspendidas" valor={String(cuentas.suspendidas)} />
          <FilaDato etiqueta="Compradores externos" valor={String(cuentas.compradores)} />
          <FilaDato etiqueta="Equipo" valor={`${cuentas.administradores} administradores · ${cuentas.operadores} operadores`} />
          <BotonAdmin titulo="Ver cuentas" icono="arrow-forward" onPress={() => router.push('/admin/cuentas')} />
        </Bloque>

        <Bloque titulo="Filtro biométrico" icono="scan-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          <FilaDato etiqueta="Solicitudes evaluadas" valor={String(biometria.evaluadas)} />
          <FilaDato etiqueta="Aprobadas por la IA" valor={`${biometria.aprobadas} · ${pct(biometria.aprobadas, biometria.evaluadas)}`} proporcion={biometria.aprobadas / Math.max(1, biometria.evaluadas)} color={C.verde} />
          <FilaDato etiqueta="Enviadas al equipo" valor={`${biometria.revisar} · ${pct(biometria.revisar, biometria.evaluadas)}`} proporcion={biometria.revisar / Math.max(1, biometria.evaluadas)} color={C.ambar} />
          <FilaDato etiqueta="Rechazadas por la IA" valor={`${biometria.rechazadas} · ${pct(biometria.rechazadas, biometria.evaluadas)}`} proporcion={biometria.rechazadas / Math.max(1, biometria.evaluadas)} color={C.rojo} />
          <FilaDato etiqueta="Similitud facial promedio" valor={biometria.similitud_promedio != null ? `${biometria.similitud_promedio} %` : '—'} />
          <FilaDato etiqueta="RENIEC: coincide / no coincide" valor={`${biometria.reniec_coincide} / ${biometria.reniec_no_coincide}`} />
          <BotonAdmin titulo="Revisar verificaciones" icono="arrow-forward" onPress={() => router.push('/admin/verificaciones')} />
        </Bloque>
      </View>

      <View style={{ flexDirection: escritorio ? 'row' : 'column', gap: E.lg, alignItems: 'flex-start' }}>
        <Bloque titulo="Pedidos del período por estado" icono="cube-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          {estados.length === 0 && <FilaDato etiqueta="Sin pedidos en el período" valor="0" />}
          {estados
            .sort((a, b) => b[1] - a[1])
            .map(([estado, n]) => (
              <FilaDato
                key={estado}
                etiqueta={ESTADO_PEDIDO[estado]?.etiqueta ?? estado}
                valor={String(n)}
                proporcion={n / Math.max(1, pedidos.publicados)}
                color={ESTADO_PEDIDO[estado]?.color}
              />
            ))}
          <FilaDato etiqueta="Ofertas aceptadas / enviadas" valor={`${ofertas.aceptadas} / ${ofertas.enviadas}`} />
          <BotonAdmin titulo="Ver pedidos" icono="arrow-forward" onPress={() => router.push('/admin/pedidos')} />
        </Bloque>

        <Bloque titulo="Dinero y confianza" icono="cash-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          <FilaDato etiqueta="Cobrado a clientes" valor={soles(dinero.cobrado)} />
          <FilaDato etiqueta="Liberado a compradores externos" valor={soles(dinero.liberado)} />
          <FilaDato etiqueta="Reembolsado tras disputas" valor={soles(dinero.reembolsado)} />
          <FilaDato etiqueta="Ticket promedio del encargo" valor={dinero.ticket_promedio != null ? soles(dinero.ticket_promedio) : '—'} />
          <FilaDato etiqueta="Disputas abiertas en el período" valor={String(disputas.abiertas)} />
          <FilaDato etiqueta="Resueltas: a favor del cliente / del comprador" valor={`${disputas.a_favor_cliente} / ${disputas.a_favor_comprador}`} />
          <FilaDato etiqueta="Calificación promedio" valor={calificaciones.promedio != null ? `${calificaciones.promedio} ★ (${calificaciones.total})` : '—'} />
          <BotonAdmin titulo="Ver pagos" icono="arrow-forward" onPress={() => router.push('/admin/pagos')} />
        </Bloque>
      </View>
    </PaginaAdmin>
  );
}
