import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { misPedidos } from '@/lib/api';
import { ESTADO_VERIFICACION } from '@/lib/negocio';
import type { EstadoPedido, Pedido } from '@/lib/tipos';
import {
  Avatar,
  Boton,
  Cabecera,
  Cargando,
  Cifra,
  Entrada,
  FilaCifras,
  Opciones,
  Vacio,
} from '@/ui/componentes';
import { PedidoCard } from '@/ui/PedidoCard';
import { C, E, R, sombra } from '@/ui/tema';

const TERMINADOS: EstadoPedido[] = ['confirmado', 'cancelado'];
/** Estados en los que el cliente tiene algo que hacer. */
const ME_TOCA: EstadoPedido[] = ['aceptado', 'entregado'];

type Filtro = 'activos' | 'terminados' | 'todos';

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function MisPedidos() {
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
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            <Cabecera
              antetitulo={saludo()}
              titulo={`Hola, ${primerNombre}`}
              subtitulo="¿Qué quieres que te traigan del extranjero?"
              derecha={
                <Pressable onPress={() => router.push('/(app)/perfil')}>
                  <Avatar nombre={perfil?.nombre_completo} tamano={50} verificado={verificado} />
                </Pressable>
              }>
              <FilaCifras>
                <Cifra claro icono="cube" valor={String(activos.length)} etiqueta="En curso" />
                <Cifra
                  claro
                  icono="megaphone"
                  valor={String(conOfertas)}
                  etiqueta="Recibiendo ofertas"
                />
                <Cifra claro icono="hand-left" valor={String(meToca)} etiqueta="Te toca actuar" />
              </FilaCifras>
            </Cabecera>

            <View style={{ paddingHorizontal: E.lg, marginTop: -E.md }}>
              {!verificado && v && (
                <Entrada>
                  <Pressable
                    onPress={() =>
                      perfil?.verificacion !== 'en_revision' && router.push('/verificacion')
                    }
                    style={[
                      s.verificar,
                      perfil?.verificacion === 'rechazado' && { borderColor: C.rojo },
                    ]}>
                    <View
                      style={[
                        s.verificarIcono,
                        { backgroundColor: `${v.color}18` },
                      ]}>
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

              {lista.length > 0 && (
                <View style={{ marginTop: E.lg, marginBottom: E.md }}>
                  <Opciones
                    valor={filtro}
                    onChange={setFiltro}
                    opciones={[
                      { valor: 'activos', etiqueta: `En curso · ${activos.length}` },
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
          <Entrada i={index} style={{ paddingHorizontal: E.lg }}>
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

      <View style={s.flotante}>
        <Boton
          icono={verificado ? 'add-circle' : 'shield-checkmark'}
          titulo={verificado ? 'Publicar un pedido' : 'Verifica tu identidad para publicar'}
          onPress={() => router.push(verificado ? '/publicar' : '/verificacion')}
          deshabilitado={perfil?.verificacion === 'en_revision'}
          style={sombra(3)}
        />
      </View>
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
  verificarTexto: { fontSize: 13.5, color: C.textoSuave, marginTop: 2, lineHeight: 19 },
  flotante: { position: 'absolute', left: E.lg, right: E.lg, bottom: E.lg },
});
