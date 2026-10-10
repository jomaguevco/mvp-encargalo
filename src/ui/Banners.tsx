import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import type { NombreIcono } from './componentes';
import { useEscritorio } from './escritorio';
import { C, E, R } from './tema';

type Banner = {
  etiqueta: string;
  titulo: string;
  texto: string;
  icono: NombreIcono;
  /** Fondo plano y color del ícono y la etiqueta sobre él. */
  fondo: string;
  acento: string;
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
    fondo: C.azul,
    acento: C.trigo,
    destino: '/legal',
  },
  {
    etiqueta: 'Para viajeros',
    titulo: '¿Viajas pronto? Gana trayendo encargos',
    texto: 'Oferta por pedidos abiertos, pon tu precio y cobra al entregar.',
    icono: 'airplane',
    fondo: C.naranja,
    acento: C.sobreOscuro,
    destino: '/(app)/explorar',
  },
  {
    etiqueta: 'Piloto en Chiclayo',
    titulo: 'Invita a tu gente',
    texto:
      'Comparte tu código desde tu perfil: los primeros pedidos los acompaña el equipo fundador.',
    icono: 'people',
    fondo: C.verdeOscuro,
    acento: C.trigo,
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
      <View style={[s.tarjeta, { backgroundColor: b.fondo }]}>
        <View style={s.icono}>
          <Ionicons name={b.icono} size={22} color={b.acento} />
        </View>
        <Text style={[s.etiqueta, { color: b.acento }]}>{b.etiqueta.toUpperCase()}</Text>
        <Text style={s.titulo}>{b.titulo}</Text>
        <Text style={s.texto}>{b.texto}</Text>
        <View style={s.mas}>
          <Text style={s.masTexto}>Ver más</Text>
          <Ionicons name="arrow-forward" size={14} color={C.sobreOscuro} />
        </View>
      </View>
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
  icono: {
    width: 42,
    height: 42,
    borderRadius: R.sm,
    backgroundColor: 'rgba(242,235,225,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.md,
  },
  etiqueta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  titulo: {
    color: C.sobreOscuro,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  texto: { color: 'rgba(242,235,225,0.85)', fontSize: 13, lineHeight: 18, marginTop: 6 },
  mas: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: E.md },
  masTexto: { color: C.sobreOscuro, fontWeight: '600', fontSize: 13 },
});
