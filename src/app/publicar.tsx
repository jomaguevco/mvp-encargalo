import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { publicarPedido, subirImagenProducto } from '@/lib/api';
import { CATEGORIAS, PROHIBIDOS, UMBRAL_IMPUESTO_USD } from '@/lib/negocio';
import { Aviso, Boton, Campo, Opciones, Parrafo, Subtitulo } from '@/ui/componentes';
import { C, E, R } from '@/ui/tema';

/** Devuelve una fecha ISO (YYYY-MM-DD) a N días de hoy. */
function enDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Publicar() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [url, setUrl] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [cantidad, setCantidad] = useState('1');
  const [valor, setValor] = useState('');
  const [plazo, setPlazo] = useState('30');
  const [foto, setFoto] = useState<string | null>(null);
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
    const c = Number(cantidad);
    if (!Number.isInteger(c) || c < 1 || c > 20)
      return 'La cantidad debe ser un número entre 1 y 20';
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
        cantidad: Number(cantidad),
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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: E.xl, paddingBottom: E.xxl }}
        keyboardShouldPersistTaps="handled">
        <Subtitulo>¿Qué quieres que te traigan?</Subtitulo>
        <Parrafo suave style={{ marginBottom: E.lg }}>
          Publicar no cuesta nada y no pagas hasta elegir una oferta. Mientras más
          preciso seas, mejores precios recibirás.
        </Parrafo>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        <Campo
          etiqueta="Producto"
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ej.: Zapatillas Nike Air Max 90, talla 42"
        />

        <Campo
          etiqueta="Enlace del producto"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://…"
          ayuda="Opcional, pero es lo que más ayuda a que te coticen bien"
        />

        <Pressable
          onPress={elegirFoto}
          style={{
            borderWidth: 2,
            borderStyle: foto ? 'solid' : 'dashed',
            borderColor: foto ? C.verde : C.borde,
            borderRadius: R.md,
            marginBottom: E.lg,
            overflow: 'hidden',
            alignItems: 'center',
            padding: foto ? 0 : E.lg,
            backgroundColor: C.blanco,
          }}>
          {foto ? (
            <>
              <Image
                source={{ uri: foto }}
                style={{ width: '100%', height: 170 }}
                resizeMode="cover"
              />
              <Text
                style={{
                  paddingVertical: E.sm,
                  color: C.verde,
                  fontWeight: '700',
                  fontSize: 13,
                }}>
                Foto del producto, toca para cambiar
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: C.azul, fontWeight: '700' }}>
                Agregar una foto del producto
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: C.textoSuave,
                  marginTop: E.xs,
                  textAlign: 'center',
                }}>
                Opcional. Si no tienes el enlace, una captura evita malentendidos.
              </Text>
            </>
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

        <View style={{ marginBottom: E.lg }}>
          <Parrafo style={{ fontWeight: '700', fontSize: 13, marginBottom: E.sm }}>
            Categoría
          </Parrafo>
          <Opciones
            valor={categoria}
            onChange={setCategoria}
            opciones={CATEGORIAS.map((c) => ({ valor: c, etiqueta: c }))}
          />
        </View>

        <Campo
          etiqueta="Cantidad"
          value={cantidad}
          onChangeText={setCantidad}
          keyboardType="number-pad"
        />

        <Campo
          etiqueta="¿Cuánto cuesta afuera? (S/)"
          value={valor}
          onChangeText={setValor}
          keyboardType="decimal-pad"
          placeholder="420"
          ayuda="Opcional. Sirve de referencia para quienes te van a ofertar"
        />

        <View style={{ marginBottom: E.lg }}>
          <Parrafo style={{ fontWeight: '700', fontSize: 13, marginBottom: E.sm }}>
            ¿Para cuándo lo necesitas?
          </Parrafo>
          <Opciones
            valor={plazo}
            onChange={setPlazo}
            opciones={[
              { valor: '15', etiqueta: 'En 15 días' },
              { valor: '30', etiqueta: 'En 1 mes' },
              { valor: '60', etiqueta: 'En 2 meses' },
              { valor: '90', etiqueta: 'Sin apuro' },
            ]}
          />
        </View>

        <Aviso tono="alerta" titulo="Antes de publicar">
          {'No se pueden encargar: ' +
            PROHIBIDOS.join('; ').toLowerCase() +
            '. Si el producto cuesta más de US$ ' +
            UMBRAL_IMPUESTO_USD +
            ', paga impuestos de importación al llegar al Perú: pregunta al comprador ' +
            'externo si su oferta ya los incluye.'}
        </Aviso>

        <Aviso tono="info" titulo="Qué pasa después">
          Tu pedido queda visible para los compradores externos verificados. Recibirás
          ofertas con precio final y fecha, y eliges la que prefieras. Recién ahí pagas,
          y tu dinero queda retenido hasta que confirmes que recibiste el producto.
        </Aviso>

        <Boton titulo="Publicar pedido" onPress={enviar} cargando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
