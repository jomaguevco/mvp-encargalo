import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { fechaHora, soles } from '@/lib/negocio';
import type { EstadoReforzada, ReforzadaAdmin } from '@/lib/tipos';
import {
  BotonAdmin,
  ChipPedido,
  Fichas,
  PaginaAdmin,
  pedirTexto,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Cargando, Chip } from '@/ui/componentes';
import { avisar } from '@/ui/dialogos';
import { Text } from '@/ui/Texto';
import { C } from '@/ui/tema';

type Filtro = EstadoReforzada | 'todas';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'aprobada', etiqueta: 'Aprobadas' },
  { valor: 'rechazada', etiqueta: 'No aprobadas' },
  { valor: 'todas', etiqueta: 'Todas' },
];

const CHIP: Record<EstadoReforzada, { texto: string; color: string }> = {
  pendiente: { texto: 'Falta videollamada', color: C.ambar },
  aprobada: { texto: 'Aprobada', color: C.verde },
  rechazada: { texto: 'No aprobada', color: C.rojo },
};

/**
 * Verificación reforzada (acción ES-17). Los pedidos de monto alto se
 * publican y reciben ofertas, pero el pago no avanza hasta que alguien del
 * equipo hace una videollamada con el cliente y la registra aquí. La regla
 * y el umbral viven en la base (0019_limites_cuentas_nuevas).
 */
export default function ReforzadasAdmin() {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [filas, setFilas] = useState<ReforzadaAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(await api.reforzadasAdmin(filtro === 'todas' ? null : filtro));
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

  async function resolver(f: ReforzadaAdmin, aprobar: boolean) {
    const nota = pedirTexto(
      aprobar ? 'Aprobar la verificación reforzada' : 'No aprobar la verificación reforzada',
      aprobar
        ? 'Anota cuándo fue la videollamada y qué comprobaste (rostro contra el DNI, que el pedido es suyo, etc.).'
        : 'Anota por qué no se aprueba. El cliente recibe un aviso y podrá cancelar el pedido.',
    );
    if (nota == null) return;
    setOcupado(f.pedido_id);
    try {
      await api.resolverReforzada(f.pedido_id, aprobar, nota);
      await cargar();
    } catch (e) {
      avisar('No se pudo guardar', (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const xs = filas ?? [];
  const columnas: Columna<ReforzadaAdmin>[] = [
    {
      clave: 'pedido',
      titulo: 'Pedido',
      ancho: 2.4,
      render: (f) => (
        <View>
          <Text style={s.fuerte} numberOfLines={1}>{f.titulo}</Text>
          <Text style={s.suave} numberOfLines={1}>
            {f.cliente}
            {f.telefono ? ` · ${f.telefono}` : ''}
          </Text>
        </View>
      ),
    },
    { clave: 'estado_pedido', titulo: 'Estado', ancho: 1.2, render: (f) => <ChipPedido estado={f.estado_pedido} /> },
    {
      clave: 'monto',
      titulo: 'Monto revisado',
      alinear: 'derecha',
      render: (f) => soles(f.total_cobrado ?? f.monto),
    },
    {
      clave: 'completados',
      titulo: 'Pedidos completados',
      alinear: 'derecha',
      render: (f) => String(f.completados),
    },
    {
      clave: 'reforzada',
      titulo: 'Videollamada',
      ancho: 1.8,
      render: (f) => (
        <View style={{ gap: 2 }}>
          <Chip texto={CHIP[f.reforzada].texto} color={CHIP[f.reforzada].color} />
          <Text style={s.suave} numberOfLines={2}>
            {f.reforzada === 'pendiente'
              ? `Desde ${fechaHora(f.marcada_en)}`
              : `${f.resuelta_por ?? 'Equipo'} · ${fechaHora(f.resuelta_en)}`}
          </Text>
          {!!f.nota && <Text style={s.suave} numberOfLines={2}>{f.nota}</Text>}
        </View>
      ),
    },
    {
      clave: 'acciones',
      titulo: '',
      ancho: 2.2,
      render: (f) => (
        <View style={s.acciones}>
          {f.reforzada === 'pendiente' && (
            <>
              <BotonAdmin
                titulo="Aprobar"
                icono="videocam-outline"
                variante="exito"
                deshabilitado={ocupado === f.pedido_id}
                onPress={() => resolver(f, true)}
              />
              <BotonAdmin
                titulo="No aprobar"
                variante="peligro"
                deshabilitado={ocupado === f.pedido_id}
                onPress={() => resolver(f, false)}
              />
            </>
          )}
          <BotonAdmin titulo="Ver" onPress={() => router.push(`/admin/pedido/${f.pedido_id}` as never)} />
        </View>
      ),
    },
  ];

  return (
    <PaginaAdmin
      titulo="Verificación reforzada"
      subtitulo="Pedidos de monto alto: el pago queda en espera hasta que hagas la videollamada con el cliente."
      onRefrescar={cargar}>
      <Aviso tono="info" titulo="Cómo se hace">
        Coordina la videollamada por el chat del pedido. Pide al cliente que muestre su DNI junto a su
        rostro y que confirme qué está encargando. Luego registra aquí el resultado: queda en la
        bitácora y el cliente recibe un aviso.
      </Aviso>
      <Fichas valor={filtro} opciones={FILTROS} onCambiar={setFiltro} />
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      {filas === null ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnas}
          filas={xs}
          clave={(f) => f.pedido_id}
          vacio={filtro === 'pendiente' ? 'No hay videollamadas pendientes' : 'No hay pedidos en esta lista'}
        />
      )}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  fuerte: { fontSize: 14, fontWeight: '700', color: C.texto },
  suave: { fontSize: 12.5, color: C.grisTexto },
  acciones: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
