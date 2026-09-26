import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { pedidosAbiertos } from '@/lib/api';
import { CATEGORIAS } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import { Aviso, Boton, Campo, Cargando, Micro, Opciones, Vacio } from '@/ui/componentes';
import { PedidoCard } from '@/ui/PedidoCard';
import { E } from '@/ui/tema';

/** Quita tildes y pasa a minúsculas, para que «tecnologia» encuentre «Tecnología». */
const normaliza = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function Explorar() {
  const { perfil, verificado } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('todas');

  const cargar = useCallback(async () => {
    if (!verificado) {
      setPedidos([]);
      return;
    }
    try {
      setPedidos(await pedidosAbiertos());
    } catch {
      setPedidos([]);
    }
  }, [verificado]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  /**
   * El filtro es local a propósito: la lista de pedidos abiertos del piloto
   * cabe de sobra en memoria y así el buscador responde en cada tecla, sin
   * una consulta por letra.
   */
  const visibles = useMemo(() => {
    const q = normaliza(busqueda.trim());
    return (pedidos ?? []).filter((p) => {
      if (categoria !== 'todas' && p.categoria !== categoria) return false;
      if (!q) return true;
      return normaliza(`${p.titulo} ${p.descripcion} ${p.categoria}`).includes(q);
    });
  }, [pedidos, busqueda, categoria]);

  if (pedidos === null) return <Cargando texto="Buscando pedidos abiertos…" />;

  if (!verificado) {
    return (
      <View style={{ padding: E.lg }}>
        <Aviso tono="alerta" titulo="Verifica tu identidad">
          Para ver los pedidos abiertos y enviar ofertas necesitas validar tu DNI. Es la
          garantía que le damos al cliente de que sabe quién le va a traer su producto.
        </Aviso>
        <Boton
          titulo="Verificar mi identidad"
          onPress={() => router.push('/verificacion')}
        />
      </View>
    );
  }

  if (!perfil?.es_comprador) {
    return (
      <View style={{ padding: E.lg }}>
        <Aviso tono="info" titulo="Activa tu cuenta como comprador externo">
          Si viajas al extranjero o traes productos con frecuencia, puedes ganar dinero
          con el espacio de tu maleta. Actívalo desde tu perfil.
        </Aviso>
        <Boton
          titulo="Ir a mi perfil"
          variante="secundario"
          onPress={() => router.push('/(app)/perfil')}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={visibles}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: E.lg }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={async () => {
            setRefrescando(true);
            await cargar();
            setRefrescando(false);
          }}
        />
      }
      ListHeaderComponent={
        <View>
          <Campo
            etiqueta="Buscar"
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Zapatillas, consola, suplemento…"
            autoCapitalize="none"
          />
          <View style={{ marginBottom: E.md }}>
            <Opciones
              valor={categoria}
              onChange={setCategoria}
              opciones={[
                { valor: 'todas', etiqueta: 'Todas' },
                ...CATEGORIAS.map((c) => ({ valor: c, etiqueta: c })),
              ]}
            />
          </View>
          <Micro style={{ marginBottom: E.md }}>
            {visibles.length === pedidos.length
              ? `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} abierto${
                  pedidos.length === 1 ? '' : 's'
                }`
              : `${visibles.length} de ${pedidos.length} pedidos`}
          </Micro>
        </View>
      }
      renderItem={({ item }) => <PedidoCard pedido={item} pie="Ver y ofertar" />}
      ListEmptyComponent={
        <Vacio
          titulo={
            pedidos.length === 0
              ? 'No hay pedidos abiertos ahora'
              : 'Ningún pedido coincide con tu búsqueda'
          }
          detalle={
            pedidos.length === 0
              ? 'Cuando alguien publique un encargo aparecerá aquí. Desliza hacia abajo para actualizar.'
              : 'Prueba con otra palabra o quita el filtro de categoría.'
          }
        />
      }
    />
  );
}
