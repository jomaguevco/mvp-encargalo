import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { ESTADO_PEDIDO, fecha, soles } from '@/lib/negocio';
import type { EstadoPedido, PedidoAdmin } from '@/lib/tipos';
import {
  BotonAdmin,
  Buscador,
  ChipPago,
  ChipPedido,
  descargarCsv,
  Fichas,
  PaginaAdmin,
  Paginador,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Cargando } from '@/ui/componentes';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

const POR_PAGINA = 50;

type Filtro = EstadoPedido | 'todos';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  ...(Object.keys(ESTADO_PEDIDO) as EstadoPedido[]).map((e) => ({
    valor: e as Filtro,
    etiqueta: ESTADO_PEDIDO[e].etiqueta,
  })),
];

/** Todos los pedidos de la plataforma, de cualquier cliente y en cualquier estado. */
export default function PedidosAdmin() {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState(0);
  const [filas, setFilas] = useState<PedidoAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(
        await api.pedidosAdmin({
          estado: filtro === 'todos' ? null : filtro,
          busqueda,
          limite: POR_PAGINA,
          desde,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
      setFilas([]);
    }
  }, [filtro, busqueda, desde]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function exportar() {
    try {
      const todos = await api.pedidosAdmin({
        estado: filtro === 'todos' ? null : filtro,
        busqueda,
        limite: 500,
      });
      descargarCsv(
        `encargalo-pedidos-${filtro}.csv`,
        todos.map((p) => ({
          pedido: p.titulo,
          categoria: p.categoria,
          estado: p.estado,
          cliente: p.cliente,
          comprador_externo: p.comprador,
          ofertas: p.ofertas,
          precio_final: p.precio_final,
          pago: p.pago_estado,
          total_cobrado: p.total_cobrado,
          creado: p.creado_en,
          id: p.pedido_id,
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const columnas: Columna<PedidoAdmin>[] = [
    {
      clave: 'titulo',
      titulo: 'Pedido',
      ancho: 3,
      render: (p) => (
        <View>
          <Text style={s.fuerte} numberOfLines={1}>{p.titulo}</Text>
          <Text style={s.suave}>{p.categoria} · {p.ofertas} {p.ofertas === 1 ? 'oferta' : 'ofertas'}</Text>
        </View>
      ),
    },
    { clave: 'estado', titulo: 'Estado', ancho: 1.4, render: (p) => <ChipPedido estado={p.estado} /> },
    { clave: 'cliente', titulo: 'Cliente', ancho: 1.6 },
    { clave: 'comprador', titulo: 'Comprador externo', ancho: 1.6, render: (p) => p.comprador ?? '—' },
    { clave: 'pago', titulo: 'Pago', ancho: 1.3, render: (p) => <ChipPago estado={p.pago_estado} /> },
    {
      clave: 'monto',
      titulo: 'Monto',
      alinear: 'derecha',
      render: (p) => soles(p.total_cobrado ?? p.precio_final),
    },
    { clave: 'fecha', titulo: 'Creado', render: (p) => fecha(p.creado_en) },
  ];

  return (
    <PaginaAdmin
      titulo="Pedidos"
      subtitulo="Toca un pedido para abrir su detalle, su chat y su bitácora."
      acciones={<BotonAdmin titulo="Exportar CSV" icono="download-outline" onPress={exportar} />}>
      <View style={s.filtros}>
        <Buscador
          valor={texto}
          onCambiar={setTexto}
          onBuscar={() => {
            setDesde(0);
            setBusqueda(texto);
          }}
          placeholder="Producto, cliente o comprador externo (Enter para buscar)"
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
            clave={(p) => p.pedido_id}
            onFila={(p) => router.push(`/pedido/${p.pedido_id}`)}
            vacio="No hay pedidos con estos filtros"
          />
          <Paginador
            desde={desde}
            porPagina={POR_PAGINA}
            total={filas[0]?.total ?? 0}
            onCambiar={setDesde}
          />
        </>
      )}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  filtros: { flexDirection: 'row', gap: E.md, flexWrap: 'wrap' },
  fuerte: { fontSize: 14, fontWeight: '700', color: C.texto },
  suave: { fontSize: 12.5, color: C.grisTexto },
});
