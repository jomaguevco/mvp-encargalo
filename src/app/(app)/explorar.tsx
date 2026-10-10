import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { pedidosAbiertos } from '@/lib/api';
import { CATEGORIAS, diasHasta } from '@/lib/negocio';
import type { Pedido } from '@/lib/tipos';
import {
  Boton,
  Cabecera,
  Cargando,
  Cifra,
  Entrada,
  FilaCifras,
  Opciones,
  Tarjeta,
  Vacio,
} from '@/ui/componentes';
import { iconoCategoria } from '@/ui/iconos';
import { PedidoCard } from '@/ui/PedidoCard';
import { useEscritorio } from '@/ui/escritorio';
import { C, E, R } from '@/ui/tema';

/** Quita tildes y pasa a minúsculas, para que «tecnologia» encuentre «Tecnología». */
const normaliza = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type Orden = 'recientes' | 'urgentes' | 'valor';

/** Pantalla de bloqueo con ilustración de icono: no verificado o no comprador. */
function Bloqueo({
  icono,
  titulo,
  texto,
  accion,
  onAccion,
  puntos,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  texto: string;
  accion: string;
  onAccion: () => void;
  puntos: string[];
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.fondo }}>
      <Cabecera titulo="Gana con tus viajes" subtitulo="Pedidos abiertos para traer al Perú" />
      <View style={{ padding: E.lg, marginTop: -E.md }}>
        <Entrada>
          <Tarjeta style={{ alignItems: 'center', padding: E.xl }}>
            <View style={s.bloqueoIcono}>
              <Ionicons name={icono} size={34} color={C.naranja} />
            </View>
            <Text style={s.bloqueoTitulo}>{titulo}</Text>
            <Text style={s.bloqueoTexto}>{texto}</Text>
            <View style={{ alignSelf: 'stretch', gap: E.sm, marginVertical: E.lg }}>
              {puntos.map((p) => (
                <View key={p} style={s.punto}>
                  <Ionicons name="checkmark-circle" size={18} color={C.verde} />
                  <Text style={s.puntoTexto}>{p}</Text>
                </View>
              ))}
            </View>
            <Boton titulo={accion} onPress={onAccion} style={{ alignSelf: 'stretch' }} />
          </Tarjeta>
        </Entrada>
      </View>
    </View>
  );
}

export default function Explorar() {
  const { es: escritorio, columnas } = useEscritorio();
  const { perfil, verificado } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('todas');
  const [orden, setOrden] = useState<Orden>('recientes');

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
    const filtrados = (pedidos ?? []).filter((p) => {
      if (categoria !== 'todas' && p.categoria !== categoria) return false;
      if (!q) return true;
      return normaliza(`${p.titulo} ${p.descripcion} ${p.categoria}`).includes(q);
    });
    if (orden === 'urgentes') {
      return [...filtrados].sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));
    }
    if (orden === 'valor') {
      return [...filtrados].sort((a, b) => (b.valor_referencial ?? 0) - (a.valor_referencial ?? 0));
    }
    return filtrados;
  }, [pedidos, busqueda, categoria, orden]);

  if (pedidos === null) return <Cargando texto="Buscando pedidos abiertos…" />;

  if (!verificado) {
    return (
      <Bloqueo
        icono="shield-checkmark-outline"
        titulo="Verifica tu identidad"
        texto="Para ver los pedidos abiertos y enviar ofertas necesitas validar tu DNI. Es la garantía que le damos al cliente de que sabe quién le va a traer su producto."
        puntos={[
          'Tu nombre se valida contra RENIEC',
          'Las fotos se borran al aprobarse',
          'Toma menos de dos minutos',
        ]}
        accion={perfil?.verificacion === 'en_revision' ? 'Ver el estado' : 'Verificar mi identidad'}
        onAccion={() => router.push('/verificacion')}
      />
    );
  }

  if (!perfil?.es_comprador) {
    return (
      <Bloqueo
        icono="airplane-outline"
        titulo="Activa tu cuenta de comprador externo"
        texto="Si viajas al extranjero o traes productos con frecuencia, puedes ganar dinero con el espacio de tu maleta."
        puntos={[
          'Tú pones el precio y la fecha',
          'El pago del cliente ya está retenido antes de que compres',
          'Cobras al entregar, sin perseguir a nadie',
        ]}
        accion="Activarla en mi perfil"
        onAccion={() => router.push('/(app)/perfil')}
      />
    );
  }

  const urgentes = pedidos.filter((p) => diasHasta(p.fecha_limite) <= 7).length;
  const categorias = new Set(pedidos.map((p) => p.categoria)).size;

  return (
    <FlatList
      style={{ backgroundColor: C.fondo }}
      data={visibles}
      keyExtractor={(p) => p.id}
      // En escritorio, dos o tres columnas (ui/escritorio). `key` rehace la lista al cambiar.
      key={`columnas-${columnas}`}
      numColumns={columnas}
      contentContainerStyle={{ paddingBottom: E.xxl }}
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
        <>
          <Cabecera
            antetitulo="Gana con tus viajes"
            titulo="Pedidos abiertos"
            subtitulo="Elige qué traer, pon tu precio y cobra al entregar.">
            <FilaCifras>
              <Cifra claro icono="albums" valor={String(pedidos.length)} etiqueta="Abiertos" />
              <Cifra claro icono="flash" valor={String(urgentes)} etiqueta="Para esta semana" />
              <Cifra claro icono="grid" valor={String(categorias)} etiqueta="Categorías" />
            </FilaCifras>
            <View style={s.buscador}>
              <Ionicons name="search" size={18} color="#98A6B8" />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Zapatillas, consola, suplemento…"
                placeholderTextColor="#98A6B8"
                autoCapitalize="none"
                style={s.buscadorCampo}
              />
              {!!busqueda && (
                <Ionicons
                  name="close-circle"
                  size={18}
                  color="#98A6B8"
                  onPress={() => setBusqueda('')}
                />
              )}
            </View>
          </Cabecera>

          <View style={{ paddingLeft: E.lg, marginTop: E.lg }}>
            <Opciones
              desplazable
              valor={categoria}
              onChange={setCategoria}
              opciones={[
                { valor: 'todas', etiqueta: 'Todas', icono: 'apps-outline' },
                ...CATEGORIAS.map((c) => ({
                  valor: c,
                  etiqueta: c,
                  icono: iconoCategoria(c),
                })),
              ]}
            />
          </View>

          <View style={s.ordenFila}>
            <Text style={s.conteo}>
              {visibles.length === pedidos.length
                ? `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}`
                : `${visibles.length} de ${pedidos.length}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: E.xs }}>
              {(
                [
                  ['recientes', 'Recientes'],
                  ['urgentes', 'Urgentes'],
                  ['valor', 'Mayor valor'],
                ] as [Orden, string][]
              ).map(([valor, etiqueta]) => (
                <Text
                  key={valor}
                  onPress={() => setOrden(valor)}
                  style={[s.orden, orden === valor && s.ordenActivo]}>
                  {etiqueta}
                </Text>
              ))}
            </View>
          </View>
        </>
      }
      renderItem={({ item, index }) => (
        <Entrada
          i={index}
          style={
            escritorio
              ? { paddingHorizontal: E.sm, width: `${100 / columnas}%` as `${number}%` }
              : { paddingHorizontal: E.lg }
          }>
          <PedidoCard pedido={item} pie="Ver y ofertar" />
        </Entrada>
      )}
      ListEmptyComponent={
        <Vacio
          icono={pedidos.length === 0 ? 'telescope-outline' : 'search-outline'}
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
          accion={pedidos.length === 0 ? undefined : 'Quitar filtros'}
          onAccion={() => {
            setBusqueda('');
            setCategoria('todas');
          }}
        />
      }
    />
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm,
    backgroundColor: C.blanco,
    borderRadius: R.md,
    paddingHorizontal: E.md,
    marginTop: E.md,
  },
  buscadorCampo: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15.5,
    color: C.texto,
  },
  ordenFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: E.lg,
    marginTop: E.md,
    marginBottom: E.md,
  },
  conteo: { fontSize: 13, fontWeight: '700', color: C.textoSuave },
  orden: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.textoSuave,
    paddingHorizontal: E.sm + 2,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  ordenActivo: { backgroundColor: C.naranjaClaro, color: C.naranja },

  bloqueoIcono: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: C.naranjaClaro,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.lg,
  },
  bloqueoTitulo: {
    fontSize: 20,
    fontWeight: '800',
    color: C.azul,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  bloqueoTexto: {
    fontSize: 14.5,
    color: C.textoSuave,
    textAlign: 'center',
    marginTop: E.sm,
    lineHeight: 22,
  },
  punto: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  puntoTexto: { fontSize: 14.5, color: C.texto, fontWeight: '600', flex: 1 },
});
