import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { consultarDni } from '@/lib/api';
import { nombreDeReniec } from '@/lib/negocio';
import type { PersonaReniec } from '@/lib/tipos';
import { Campo } from './componentes';
import { C, E, R } from './tema';

export type EstadoDni =
  | { tipo: 'vacio' }
  | { tipo: 'buscando' }
  | { tipo: 'encontrado'; persona: PersonaReniec; nombre: string }
  | { tipo: 'no_existe' }
  | { tipo: 'sin_servicio'; mensaje: string };

/**
 * Campo de DNI que consulta RENIEC solo.
 *
 * Al completar los ocho dígitos llama a la Edge Function `consultar-dni` y
 * muestra debajo el nombre que figura en el documento. La pantalla que lo usa
 * recibe el resultado por `onEstado` y decide qué hacer: el registro completa
 * el nombre, la verificación lo compara con el del perfil.
 *
 * Si RENIEC no responde (sin red, cupo agotado, función sin desplegar) no se
 * bloquea a nadie: se avisa y se deja escribir el nombre a mano, y la
 * verificación sigue su curso con revisión humana como siempre.
 */
export function CampoDni({
  valor,
  onCambiar,
  onEstado,
  error,
}: {
  valor: string;
  onCambiar: (v: string) => void;
  onEstado: (e: EstadoDni) => void;
  error?: string | null;
}) {
  const [estado, setEstado] = useState<EstadoDni>({ tipo: 'vacio' });
  // El callback puede cambiar en cada render de la pantalla; se guarda en una
  // referencia para que el efecto dependa solo del número.
  const avisar = useRef(onEstado);
  avisar.current = onEstado;

  useEffect(() => {
    const cambiar = (e: EstadoDni) => {
      setEstado(e);
      avisar.current(e);
    };
    if (!/^[0-9]{8}$/.test(valor)) {
      cambiar({ tipo: 'vacio' });
      return;
    }
    let vivo = true;
    cambiar({ tipo: 'buscando' });
    // Un respiro antes de consultar: si la persona sigue corrigiendo el número
    // no se gasta una consulta del cupo en cada tecla.
    const reloj = setTimeout(async () => {
      try {
        const persona = await consultarDni(valor);
        if (!vivo) return;
        cambiar(
          persona
            ? { tipo: 'encontrado', persona, nombre: nombreDeReniec(persona) }
            : { tipo: 'no_existe' },
        );
      } catch (e) {
        if (vivo) cambiar({ tipo: 'sin_servicio', mensaje: (e as Error).message });
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [valor]);

  return (
    <View>
      <Campo
        etiqueta="Número de DNI"
        icono="card-outline"
        value={valor}
        onChangeText={(t) => onCambiar(t.replace(/\D/g, '').slice(0, 8))}
        keyboardType="number-pad"
        maxLength={8}
        placeholder="8 dígitos"
        error={error}
        ayuda={estado.tipo === 'vacio' ? 'Lo consultamos en RENIEC para completar tu nombre' : undefined}
        derecha={
          estado.tipo === 'buscando' ? (
            <ActivityIndicator size="small" color={C.azulMedio} />
          ) : estado.tipo === 'encontrado' ? (
            <Ionicons name="checkmark-circle" size={22} color={C.verde} />
          ) : estado.tipo === 'no_existe' ? (
            <Ionicons name="close-circle" size={22} color={C.rojo} />
          ) : null
        }
      />

      {estado.tipo === 'buscando' && (
        <View style={[s.resultado, { backgroundColor: C.azulFondo, borderColor: C.azulClaro }]}>
          <Text style={[s.resultadoTexto, { color: C.azulMedio }]}>Consultando RENIEC…</Text>
        </View>
      )}

      {estado.tipo === 'encontrado' && (
        <View style={[s.resultado, { backgroundColor: C.verdeClaro, borderColor: `${C.verde}40` }]}>
          <View style={s.sello}>
            <Ionicons name="shield-checkmark" size={18} color={C.blanco} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.resultadoEtiqueta}>Según RENIEC</Text>
            <Text style={s.resultadoNombre}>{estado.nombre}</Text>
          </View>
        </View>
      )}

      {estado.tipo === 'no_existe' && (
        <View style={[s.resultado, { backgroundColor: C.rojoClaro, borderColor: `${C.rojo}40` }]}>
          <Ionicons name="alert-circle" size={20} color={C.rojo} />
          <Text style={[s.resultadoTexto, { color: '#8A1B12' }]}>
            RENIEC no reconoce ese número. Revisa que esté bien escrito.
          </Text>
        </View>
      )}

      {estado.tipo === 'sin_servicio' && (
        <View style={[s.resultado, { backgroundColor: C.ambarClaro, borderColor: `${C.ambar}40` }]}>
          <Ionicons name="cloud-offline-outline" size={20} color={C.ambar} />
          <Text style={[s.resultadoTexto, { color: '#7A3D06' }]}>
            {estado.mensaje.replace(/\.$/, '')}. Puedes continuar y escribir tu nombre a mano: el equipo revisará tu DNI.
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    borderRadius: R.md,
    borderWidth: 1,
    padding: E.md,
    marginTop: -E.sm,
    marginBottom: E.lg,
  },
  sello: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.verde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultadoEtiqueta: {
    fontSize: 11.5,
    fontWeight: '800',
    color: C.verde,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resultadoNombre: { fontSize: 16, fontWeight: '800', color: '#0B5B41', marginTop: 1 },
  resultadoTexto: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
});
