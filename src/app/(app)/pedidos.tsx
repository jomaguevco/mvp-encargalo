import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/ui/Texto';
import { useAuth } from '@/ctx/auth';
import { misPedidos } from '@/lib/api';
import { ESTADO_VERIFICACION } from '@/lib/negocio';
import type { EstadoPedido, Pedido } from '@/lib/tipos';
import {
  Avatar,
  Boton,
  Cabecera,
  Cargando,
  Entrada,
  Opciones,
  Vacio,
  celda,
  HUECO,
} from '@/ui/componentes';
import { PedidoCard } from '@/ui/PedidoCard';
import { Banners } from '@/ui/Banners';
import { useEscritorio } from '@/ui/escritorio';
import { C, E, R, sombra } from '@/ui/tema';

const TERMINADOS: EstadoPedido[] = ['confirmado', 'cancelado'];
/** Estados en los que el cliente tiene algo que hacer. */
const ME_TOCA: EstadoPedido[] = ['aceptado', 'entregado'];

type Filtro = 'activos' | 'terminados' | 'todos';

/** Una cifra de la cabecera de escritorio: número grande y su etiqueta. */
function Resumen({
  valor,
  etiqueta,
  destacado,
}: {
  valor: number;
  etiqueta: string;
  destacado?: boolean;
}) {
  return (
    <View style={s.resumenItem}>
      <Text style={[s.resumenValor, destacado && valor > 0 && { color: C.trigo }]}>{valor}</Text>
      <Text style={s.resumenEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function MisPedidos() {
  const { es: escritorio, columnas } = useEscritorio();
  const { perfil, verificado, refrescarPerfil } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('activos');

  const cargar = useCallback(async () => {
    try {
      setPedidos(await misPedidos());
    } catch {
      setPedidos([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refrescarPerfil();
      cargar();
    }, [cargar, refrescarPerfil]),
  );

  async function refrescar() {
    setRefrescando(true);
    await Promise.all([cargar(), refrescarPerfil()]);
    setRefrescando(false);
  }

  const lista = pedidos ?? [];
  const activos = lista.filter((p) => !TERMINADOS.includes(p.estado));
  const meToca = lista.filter((p) => ME_TOCA.includes(p.estado)).length;
  const conOfertas = lista.filter((p) => p.estado === 'publicado').length;

  const visibles = useMemo(() => {
    if (filtro === 'todos') return lista;
    if (filtro === 'terminados') return lista.filter((p) => TERMINADOS.includes(p.estado));
    return lista.filter((p) => !TERMINADOS.includes(p.estado));
  }, [lista, filtro]);

  if (pedidos === null) return <Cargando texto="Cargando tus pedidos…" />;

  const v = perfil ? ESTADO_VERIFICACION[perfil.verificacion] : null;
  const primerNombre = perfil?.nombre_completo?.split(' ')[0] || 'de nuevo';

  return (
    <View style={{ flex: 1, backgroundColor: C.fondo }}>
      <FlatList
        data={visibles}
        keyExtractor={(p) => p.id}
        // Cuadrícula de productos: dos columnas en el teléfono, más en escritorio
        // (ui/escritorio). `key` rehace la lista al cambiar.
        key={`columnas-${columnas}`}
        numColumns={columnas}
        columnWrapperStyle={{ paddingHorizontal: escritorio ? E.sm - HUECO / 2 : E.lg - HUECO / 2 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            <Cabecera
              antetitulo={saludo()}
              titulo={`Hola, ${primerNombre}`}
              subtitulo="¿Qué quieres que te traigan del extranjero?"
              derecha={
                <View style={s.derecha}>
                  {/* En escritorio las cifras van en la misma línea del saludo:
                      la cabecera queda baja y los productos se ven antes. */}
                  {escritorio && (
                    <View style={s.resumen}>
                      <Resumen valor={activos.length} etiqueta="En curso" />
                      <Resumen valor={conOfertas} etiqueta="Recibiendo ofertas" />
                      <Resumen valor={meToca} etiqueta="Te toca actuar" destacado />
                    </View>
                  )}
                  <Pressable onPress={() => router.push('/(app)/perfil')}>
                    <Avatar nombre={perfil?.nombre_completo} tamano={50} verificado={verificado} />
                  </Pressable>
                </View>
              }>
              {/* En el teléfono las cifras ocupaban media pantalla y repetían lo
                  que ya dicen los filtros: ahí solo queda lo que pide acción. */}
              {!escritorio && meToca > 0 ? (
                <Pressable
                  onPress={() => setFiltro('activos')}
                  style={s.turno}>
                  <Ionicons name="hand-left" size={16} color={C.trigo} />
                  <Text style={s.turnoTexto}>
                    {meToca === 1
                      ? 'Un pedido espera algo de ti'
                      : `${meToca} pedidos esperan algo de ti`}
                  </Text>
                </Pressable>
              ) : null}
            </Cabecera>

            <View
              style={{
                paddingHorizontal: escritorio ? E.sm : E.lg,
                marginTop: escritorio ? 0 : -E.md,
              }}>
              {!verificado && v && (
                <Entrada>
                  <Pressable
                    onPress={() =>
                      perfil?.verificacion !== 'en_revision' && router.push('/verificacion')
                    }
                    style={[
                      s.verificar,
                      perfil?.verificacion === 'rechazado' && {
                        borderColor: C.rojo,
                      },
                    ]}>
                    <View style={[s.verificarIcono, { backgroundColor: `${v.color}18` }]}>
                      <Ionicons
                        name={
                          perfil?.verificacion === 'en_revision'
                            ? 'hourglass-outline'
                            : perfil?.verificacion === 'rechazado'
                              ? 'close-circle-outline'
                              : 'shield-checkmark-outline'
                        }
                        size={24}
                        color={v.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.verificarTitulo}>{v.etiqueta}</Text>
                      <Text style={s.verificarTexto}>
                        {v.detalle}
                        {perfil?.verificacion === 'rechazado' && perfil.motivo_rechazo
                          ? `. ${perfil.motivo_rechazo}`
                          : ''}
                      </Text>
                    </View>
                    {perfil?.verificacion !== 'en_revision' && (
                      <Ionicons name="chevron-forward" size={20} color={C.textoSuave} />
                    )}
                  </Pressable>
                </Entrada>
              )}

              <Banners />

              {lista.length > 0 && (
                <View style={{ marginTop: E.lg, marginBottom: E.md }}>
                  <Opciones
                    valor={filtro}
                    onChange={setFiltro}
                    opciones={[
                      {
                        valor: 'activos',
                        etiqueta: `En curso · ${activos.length}`,
                      },
                      {
                        valor: 'terminados',
                        etiqueta: `Terminados · ${lista.length - activos.length}`,
                      },
                      { valor: 'todos', etiqueta: 'Todos' },
                    ]}
                  />
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <Entrada i={index} style={celda(columnas)}>
            <PedidoCard
              pedido={item}
              pie={
                item.estado === 'aceptado'
                  ? 'Paga para asegurar tu pedido'
                  : item.estado === 'entregado'
                    ? 'Confirma que lo recibiste'
                    : item.estado === 'publicado'
                      ? 'Ver ofertas'
                      : undefined
              }
            />
          </Entrada>
        )}
        ListEmptyComponent={
          lista.length === 0 ? (
            <Vacio
              icono="airplane-outline"
              titulo="Todavía no has pedido nada"
              detalle="Publica lo que quieres traer del extranjero y deja que los compradores externos verificados compitan por tu pedido."
            />
          ) : (
            <Vacio
              icono="checkmark-done-outline"
              titulo={filtro === 'activos' ? 'Nada en curso' : 'Sin pedidos terminados'}
              detalle="Cambia el filtro para ver el resto de tus pedidos."
            />
          )
        }
      />

      {/* En escritorio publicar está en la barra lateral. */}
      {!escritorio && (
        <View style={s.flotante}>
          <Boton
            icono={verificado ? 'add-circle' : 'shield-checkmark'}
            titulo={verificado ? 'Publicar un pedido' : 'Verifica tu identidad para publicar'}
            onPress={() => router.push(verificado ? '/publicar' : '/verificacion')}
            deshabilitado={perfil?.verificacion === 'en_revision'}
            style={sombra(3)}
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  verificar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    padding: E.lg,
    borderWidth: 1.5,
    borderColor: C.naranjaClaro,
    ...sombra(2),
  },
  verificarIcono: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificarTitulo: { fontSize: 15.5, fontWeight: '800', color: C.azul },
  verificarTexto: {
    fontSize: 13.5,
    color: C.textoSuave,
    marginTop: 2,
    lineHeight: 19,
  },
  flotante: { position: 'absolute', left: E.lg, right: E.lg, bottom: E.lg },
  derecha: { flexDirection: 'row', alignItems: 'center', gap: E.xl },
  resumen: { flexDirection: 'row', gap: E.xs },
  resumenItem: {
    minWidth: 110,
    paddingHorizontal: E.lg,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(242,235,225,0.16)',
  },
  resumenValor: { color: C.sobreOscuro, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  resumenEtiqueta: { color: C.sobreOscuroSuave, fontSize: 12.5, fontWeight: '500' },
  turno: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: E.sm,
    backgroundColor: 'rgba(217,180,90,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(217,180,90,0.35)',
    paddingHorizontal: E.md,
    paddingVertical: E.sm,
    borderRadius: 999,
  },
  turnoTexto: { color: C.sobreOscuro, fontSize: 13.5, fontWeight: '600' },
});
