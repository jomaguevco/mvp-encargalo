import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { publicarPedido, subirImagenProducto } from '@/lib/api';
import { CATEGORIAS, PROHIBIDOS, UMBRAL_IMPUESTO_USD, fecha } from '@/lib/negocio';
import {
  Aviso,
  Boton,
  Campo,
  Entrada,
  Etiqueta,
  Opciones,
  Tarjeta,
} from '@/ui/componentes';
import { iconoCategoria } from '@/ui/iconos';
import { C, E, R } from '@/ui/tema';

/** Devuelve una fecha ISO (YYYY-MM-DD) a N días de hoy. */
function enDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const DESPUES = [
  { icono: 'megaphone' as const, texto: 'Los compradores externos verificados ven tu pedido y te ofertan.' },
  { icono: 'git-compare' as const, texto: 'Comparas precio, fecha y reputación, y eliges.' },
  { icono: 'lock-closed' as const, texto: 'Pagas y tu dinero queda retenido por Encárgalo.' },
  { icono: 'checkmark-done' as const, texto: 'Confirmas que lo recibiste y recién se libera el pago.' },
];

export default function Publicar() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [cantidad, setCantidad] = useState(1);
  const [valor, setValor] = useState('');
  const [plazo, setPlazo] = useState('30');
  const [foto, setFoto] = useState<string | null>(null);
  const [verProhibidos, setVerProhibidos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function elegirFoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]) setFoto(res.assets[0].uri);
  }

  function validar(): string | null {
    if (titulo.trim().length < 3) return 'Escribe qué producto quieres';
    if (cantidad < 1 || cantidad > 20) return 'La cantidad debe estar entre 1 y 20';
    if (valor.trim() && (Number.isNaN(Number(valor)) || Number(valor) <= 0))
      return 'El valor referencial debe ser un número mayor que cero';
    return null;
  }

  async function enviar() {
    const problema = validar();
    setError(problema);
    if (problema) return;

    setEnviando(true);
    try {
      // La foto va al bucket público `productos`: es referencia del encargo,
      // no un dato personal.
      const imagen = foto ? await subirImagenProducto(foto) : null;
      const pedido = await publicarPedido({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        url_producto: url.trim() || null,
        categoria,
        cantidad,
        ciudad_entrega: 'Chiclayo',
        fecha_limite: enDias(Number(plazo)),
        valor_referencial: valor.trim() ? Number(valor) : null,
        imagen_path: imagen,
      });
      router.replace(`/pedido/${pedido.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}
        keyboardShouldPersistTaps="handled">
        <Entrada>
          <View style={s.intro}>
            <View style={s.introIcono}>
              <Ionicons name="bag-add" size={24} color={C.naranja} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.introTitulo}>¿Qué quieres que te traigan?</Text>
              <Text style={s.introTexto}>
                Publicar es gratis y no pagas nada hasta elegir una oferta.
              </Text>
            </View>
          </View>
        </Entrada>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        <Entrada i={1}>
          <Tarjeta>
            <Campo
              etiqueta="Producto"
              icono="pricetag-outline"
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Ej.: Zapatillas Nike Air Max 90, talla 42"
              maxLength={120}
            />
            <Campo
              etiqueta="Enlace del producto"
              icono="link-outline"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://…"
              ayuda="Opcional, pero es lo que más ayuda a que te coticen bien"
            />

            <Pressable
              onPress={elegirFoto}
              style={({ pressed }) => [
                s.foto,
                foto && s.fotoLista,
                pressed && { opacity: 0.85 },
              ]}>
              {foto ? (
                <>
                  <Image source={{ uri: foto }} style={s.fotoImagen} resizeMode="cover" />
                  <View style={s.fotoPie}>
                    <Ionicons name="checkmark-circle" size={16} color={C.verde} />
                    <Text style={s.fotoPieTexto}>Foto lista · toca para cambiarla</Text>
                  </View>
                </>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: E.md }}>
                  <View style={s.fotoIcono}>
                    <Ionicons name="image-outline" size={24} color={C.azulMedio} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fotoTitulo}>Agregar una foto</Text>
                    <Text style={s.fotoAyuda}>
                      Opcional. Una captura del producto evita malentendidos.
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>

            <Campo
              etiqueta="Detalles"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={4}
              style={{ height: 100, textAlignVertical: 'top' }}
              placeholder="Color, talla, modelo exacto, si aceptas alternativas…"
            />
          </Tarjeta>
        </Entrada>

        <Entrada i={2}>
          <Tarjeta>
            <Etiqueta>Categoría</Etiqueta>
            <View style={s.categorias}>
              {CATEGORIAS.map((c) => {
                const activa = c === categoria;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategoria(c)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activa }}
                    style={[s.categoria, activa && s.categoriaActiva]}>
                    <Ionicons
                      name={iconoCategoria(c)}
                      size={22}
                      color={activa ? C.blanco : C.azulMedio}
                    />
                    <Text
                      style={[s.categoriaTexto, activa && { color: C.blanco }]}
                      numberOfLines={2}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.filaCantidad}>
              <View style={{ flex: 1 }}>
                <Etiqueta>Cantidad</Etiqueta>
                <Text style={s.ayuda}>Hasta 20 unidades</Text>
              </View>
              <View style={s.contador}>
                <Pressable
                  onPress={() => setCantidad((n) => Math.max(1, n - 1))}
                  style={s.contadorBoton}
                  accessibilityLabel="Quitar una unidad">
                  <Ionicons name="remove" size={20} color={C.azul} />
                </Pressable>
                <Text style={s.contadorValor}>{cantidad}</Text>
                <Pressable
                  onPress={() => setCantidad((n) => Math.min(20, n + 1))}
                  style={s.contadorBoton}
                  accessibilityLabel="Agregar una unidad">
                  <Ionicons name="add" size={20} color={C.azul} />
                </Pressable>
              </View>
            </View>

            <Campo
              etiqueta="¿Cuánto cuesta afuera? (S/)"
              icono="cash-outline"
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
              placeholder="420"
              ayuda="Opcional. Sirve de referencia para quienes te van a ofertar"
            />

            <Etiqueta>¿Para cuándo lo necesitas?</Etiqueta>
            <Opciones
              valor={plazo}
              onChange={setPlazo}
              opciones={[
                { valor: '15', etiqueta: '15 días', icono: 'flash-outline' },
                { valor: '30', etiqueta: '1 mes', icono: 'calendar-outline' },
                { valor: '60', etiqueta: '2 meses', icono: 'calendar-outline' },
                { valor: '90', etiqueta: 'Sin apuro', icono: 'leaf-outline' },
              ]}
            />
            <Text style={[s.ayuda, { marginTop: E.sm }]}>
              Fecha límite: {fecha(enDias(Number(plazo)))} · entrega en Chiclayo
            </Text>
          </Tarjeta>
        </Entrada>

        <Entrada i={3}>
          <Tarjeta style={{ borderColor: `${C.ambar}55` }}>
            <Pressable
              onPress={() => setVerProhibidos((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: E.sm }}>
              <Ionicons name="warning" size={20} color={C.ambar} />
              <Text style={[s.bloqueTitulo, { flex: 1 }]}>Lo que no se puede encargar</Text>
              <Ionicons
                name={verProhibidos ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={C.textoSuave}
              />
            </Pressable>
            {verProhibidos && (
              <View style={{ marginTop: E.md, gap: E.sm }}>
                {PROHIBIDOS.map((p) => (
                  <View key={p} style={s.prohibido}>
                    <Ionicons name="close-circle" size={16} color={C.rojo} />
                    <Text style={s.prohibidoTexto}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[s.ayuda, { marginTop: E.md }]}>
              Si el producto cuesta más de US$ {UMBRAL_IMPUESTO_USD}, paga impuestos de
              importación al llegar al Perú: pregunta al comprador externo si su oferta ya
              los incluye.
            </Text>
          </Tarjeta>
        </Entrada>

        <Entrada i={4}>
          <Tarjeta>
            <Text style={[s.bloqueTitulo, { marginBottom: E.md }]}>Qué pasa después</Text>
            {DESPUES.map((p, i) => (
              <View key={p.texto} style={s.despues}>
                <View style={s.despuesColumna}>
                  <View style={s.despuesIcono}>
                    <Ionicons name={p.icono} size={15} color={C.blanco} />
                  </View>
                  {i < DESPUES.length - 1 && <View style={s.despuesTallo} />}
                </View>
                <Text style={s.despuesTexto}>{p.texto}</Text>
              </View>
            ))}
          </Tarjeta>
        </Entrada>

        <Boton titulo="Publicar pedido" icono="rocket" onPress={enviar} cargando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  intro: { flexDirection: 'row', gap: E.md, alignItems: 'center', marginBottom: E.lg },
  introIcono: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.naranjaClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitulo: { fontSize: 20, fontWeight: '800', color: C.azul, letterSpacing: -0.4 },
  introTexto: { fontSize: 14, color: C.textoSuave, lineHeight: 20, marginTop: 2 },

  foto: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.bordeFuerte,
    borderRadius: R.md,
    marginBottom: E.lg,
    overflow: 'hidden',
    padding: E.md,
    backgroundColor: C.azulFondo,
  },
  fotoLista: { borderStyle: 'solid', borderColor: C.verde, padding: 0 },
  fotoIcono: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.azulClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoTitulo: { fontSize: 15, fontWeight: '800', color: C.azul },
  fotoAyuda: { fontSize: 12.5, color: C.textoSuave, marginTop: 2 },
  fotoImagen: { width: '100%', height: 180 },
  fotoPie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: E.sm + 2,
  },
  fotoPieTexto: { color: C.verde, fontWeight: '800', fontSize: 13 },

  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: E.sm,
    marginBottom: E.lg,
  },
  categoria: {
    width: '23%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: E.md,
    paddingHorizontal: 4,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.borde,
    backgroundColor: C.blanco,
  },
  categoriaActiva: { backgroundColor: C.azul, borderColor: C.azul },
  categoriaTexto: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.textoSuave,
    textAlign: 'center',
  },

  filaCantidad: { flexDirection: 'row', alignItems: 'center', marginBottom: E.lg },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    backgroundColor: C.superficieSuave,
    borderRadius: 999,
    padding: 4,
  },
  contadorBoton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorValor: {
    fontSize: 18,
    fontWeight: '800',
    color: C.azul,
    minWidth: 24,
    textAlign: 'center',
  },
  ayuda: { fontSize: 12.5, color: C.textoSuave, lineHeight: 18 },

  bloqueTitulo: { fontSize: 16, fontWeight: '800', color: C.azul },
  prohibido: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  prohibidoTexto: { flex: 1, fontSize: 13.5, color: C.texto },

  despues: { flexDirection: 'row', gap: E.md },
  despuesColumna: { alignItems: 'center', width: 28 },
  despuesIcono: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.azulMedio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  despuesTallo: { width: 2, flex: 1, minHeight: 14, backgroundColor: C.azulClaro },
  despuesTexto: { flex: 1, fontSize: 14, color: C.texto, lineHeight: 20, paddingBottom: E.md, paddingTop: 4 },
});
