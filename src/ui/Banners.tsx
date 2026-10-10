import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NombreIcono } from './componentes';
import { useEscritorio } from './escritorio';
import { C, E, R, sombra } from './tema';

type Banner = {
  etiqueta: string;
  titulo: string;
  texto: string;
  icono: NombreIcono;
  colores: readonly [string, string, ...string[]];
  destino: Href;
};

/**
 * Banners del inicio. Solo dicen lo que la aplicación hace hoy: un descuento
 * o una promoción con plata de por medio se agrega cuando el equipo la apruebe
 * y la aplicación la aplique, no antes (misma regla que web/main.js).
 */
const BANNERS: Banner[] = [
  {
    etiqueta: 'Pago protegido',
    titulo: 'Tu plata no se mueve hasta que recibes',
    texto: 'Pagas a Encárgalo, no al viajero. Se libera cuando confirmas la entrega.',
    icono: 'lock-closed',
    colores: ['#0F6E52', '#12805C', '#1A9A6E'],
    destino: '/legal',
  },
  {
    etiqueta: 'Para viajeros',
    titulo: '¿Viajas pronto? Gana trayendo encargos',
    texto: 'Oferta por pedidos abiertos, pon tu precio y cobra al entregar.',
    icono: 'airplane',
    colores: ['#F58A50', '#EE6C34', '#E0521F'],
    destino: '/(app)/explorar',
  },
  {
    etiqueta: 'Piloto en Chiclayo',
    titulo: 'Invita a tu gente',
    texto:
      'Comparte tu código desde tu perfil: los primeros pedidos los acompaña el equipo fundador.',
    icono: 'people',
    colores: ['#5B21B6', '#7C3AED', '#8B5CF6'],
    destino: '/(app)/perfil',
  },
];

function Tarjeta({ b, ancho }: { b: Banner; ancho?: number }) {
  return (
    <Pressable
      onPress={() => router.push(b.destino)}
      style={({ pressed }) => [
        { width: ancho, flex: ancho ? undefined : 1 },
        pressed && { opacity: 0.9 },
      ]}>
      <LinearGradient
        colors={b.colores}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.tarjeta, sombra(2)]}>
        <View style={[s.burbuja, { top: -40, right: -30, width: 140, height: 140 }]} />
        <View style={[s.burbuja, { bottom: -50, right: 50, width: 90, height: 90 }]} />
        <View style={s.icono}>
          <Ionicons name={b.icono} size={22} color={C.blanco} />
        </View>
        <Text style={s.etiqueta}>{b.etiqueta.toUpperCase()}</Text>
        <Text style={s.titulo}>{b.titulo}</Text>
        <Text style={s.texto}>{b.texto}</Text>
        <View style={s.mas}>
          <Text style={s.masTexto}>Ver más</Text>
          <Ionicons name="arrow-forward" size={14} color={C.blanco} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** En el teléfono, un carrusel horizontal; en escritorio, tres en fila. */
export function Banners() {
  const { es: escritorio } = useEscritorio();

  if (escritorio) {
    return (
      <View style={s.fila}>
        {BANNERS.map((b) => (
          <Tarjeta key={b.etiqueta} b={b} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={280 + E.md}
      decelerationRate="fast"
      contentContainerStyle={s.carrusel}
      style={{ marginHorizontal: -E.lg }}>
      {BANNERS.map((b) => (
        <Tarjeta key={b.etiqueta} b={b} ancho={280} />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', gap: E.md, marginTop: E.lg },
  carrusel: { gap: E.md, paddingHorizontal: E.lg, paddingVertical: E.sm, marginTop: E.sm },
  tarjeta: {
    borderRadius: R.lg,
    padding: E.lg,
    minHeight: 178,
    overflow: 'hidden',
  },
  burbuja: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  icono: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.md,
  },
  etiqueta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  titulo: {
    color: C.blanco,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  texto: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, marginTop: 6 },
  mas: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: E.md },
  masTexto: { color: C.blanco, fontWeight: '800', fontSize: 13 },
});
