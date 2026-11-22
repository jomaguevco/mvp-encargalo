import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useAuth } from '@/ctx/auth';
import { presentarReclamacion } from '@/lib/api';
import { PROVEEDOR, TIPO_RECLAMACION, fecha, fechaHora } from '@/lib/negocio';
import type { ConstanciaReclamacion, NuevaReclamacion, TipoReclamacion } from '@/lib/tipos';
import {
  Aviso,
  Boton,
  Campo,
  Casilla,
  Entrada,
  Etiqueta,
  Micro,
  Opciones,
  Tarjeta,
} from '@/ui/componentes';
import { Text } from '@/ui/Texto';
import { C, E, R } from '@/ui/tema';

type TipoDoc = NuevaReclamacion['tipo_documento'];
type Bien = NuevaReclamacion['bien_tipo'];

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Libro de reclamaciones virtual (acción ES-15).
 *
 * Ley N° 29571 (Código de Protección y Defensa del Consumidor) y D.S. N°
 * 011-2011-PCM: el formulario es público (no pide sesión), tiene los campos
 * de la hoja oficial y la base le asigna un número correlativo. La respuesta
 * llega en un máximo de 15 días hábiles.
 *
 * TODO(ES-15): enviar la constancia al correo del consumidor. El proyecto aún
 * no tiene envío de correos; mientras tanto el número se muestra en pantalla
 * y se puede compartir.
 */
export default function Reclamaciones() {
  const { perfil } = useAuth();
  const [nombre, setNombre] = useState(perfil?.nombre_completo ?? '');
  const [tipoDoc, setTipoDoc] = useState<TipoDoc>('DNI');
  const [documento, setDocumento] = useState(perfil?.dni ?? '');
  const [domicilio, setDomicilio] = useState('');
  const [telefono, setTelefono] = useState(perfil?.telefono ?? '');
  const [correo, setCorreo] = useState('');
  const [menor, setMenor] = useState(false);
  const [apoderado, setApoderado] = useState('');
  const [bien, setBien] = useState<Bien>('servicio');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [codigoPedido, setCodigoPedido] = useState('');
  const [tipo, setTipo] = useState<TipoReclamacion>('reclamo');
  const [detalle, setDetalle] = useState('');
  const [pedido, setPedido] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [constancia, setConstancia] = useState<ConstanciaReclamacion | null>(null);

  const montoNum = monto.trim() ? Number(monto.replace(',', '.')) : null;

  function validar(): string | null {
    if (nombre.trim().length < 3) return 'Escribe tu nombre completo';
    if (!/^[A-Za-z0-9]{6,15}$/.test(documento.trim()))
      return tipoDoc === 'DNI'
        ? 'Escribe tu número de DNI (8 dígitos)'
        : 'Escribe tu número de documento, sin espacios';
    if (tipoDoc === 'DNI' && !/^[0-9]{8}$/.test(documento.trim()))
      return 'El DNI tiene 8 dígitos';
    if (domicilio.trim().length < 5) return 'Escribe tu domicilio';
    if (!CORREO.test(correo.trim())) return 'Escribe un correo válido: ahí te responderemos';
    if (telefono.trim() && !/^[0-9 +-]{6,20}$/.test(telefono.trim()))
      return 'El teléfono solo puede tener números';
    if (menor && apoderado.trim().length < 3)
      return 'Si eres menor de edad, escribe el nombre de tu padre, madre o apoderado';
    if (descripcion.trim().length < 3) return 'Describe el producto o servicio';
    if (montoNum != null && (Number.isNaN(montoNum) || montoNum < 0))
      return 'El monto debe ser un número';
    if (detalle.trim().length < 10) return 'Cuéntanos qué pasó (mínimo 10 caracteres)';
    if (pedido.trim().length < 5) return 'Dinos qué solución esperas';
    if (!acepta) return 'Necesitamos tu autorización para usar estos datos y atender tu hoja';
    return null;
  }

  async function enviar() {
    const problema = validar();
    setError(problema);
    if (problema) return;
    setEnviando(true);
    try {
      setConstancia(
        await presentarReclamacion({
          nombre: nombre.trim(),
          tipo_documento: tipoDoc,
          numero_documento: documento.trim(),
          domicilio: domicilio.trim(),
          telefono: telefono.trim() || null,
          correo: correo.trim(),
          menor_de_edad: menor,
          apoderado: menor ? apoderado.trim() : null,
          bien_tipo: bien,
          bien_descripcion: descripcion.trim(),
          monto: montoNum,
          codigo_pedido: codigoPedido.trim() || null,
          tipo,
          detalle: detalle.trim(),
          pedido_consumidor: pedido.trim(),
          acepta_tratamiento: acepta,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (constancia) {
    return <Constancia c={constancia} correo={correo.trim()} tipo={tipo} />;
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
              <Ionicons name="book" size={24} color={C.naranja} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.introTitulo}>Libro de reclamaciones</Text>
              <Text style={s.introTexto}>
                Te respondemos en un máximo de 15 días hábiles. No necesitas tener cuenta.
              </Text>
            </View>
          </View>
        </Entrada>

        <Entrada i={1}>
          <Tarjeta>
            <Text style={s.bloqueTitulo}>Proveedor</Text>
            <Text style={s.ayuda}>
              {PROVEEDOR.razonSocial ?? PROVEEDOR.nombre} · RUC {PROVEEDOR.ruc ?? 'en trámite'}
            </Text>
            <Text style={s.ayuda}>{PROVEEDOR.domicilio}</Text>
          </Tarjeta>
        </Entrada>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        <Entrada i={2}>
          <Tarjeta>
            <Text style={[s.bloqueTitulo, { marginBottom: E.md }]}>1. Tus datos</Text>
            <Campo
              etiqueta="Nombre completo"
              icono="person-outline"
              value={nombre}
              onChangeText={setNombre}
              maxLength={150}
            />
            <Etiqueta>Documento de identidad</Etiqueta>
            <Opciones
              valor={tipoDoc}
              onChange={setTipoDoc}
              opciones={[
                { valor: 'DNI', etiqueta: 'DNI' },
                { valor: 'CE', etiqueta: 'Carné de extranjería' },
                { valor: 'Pasaporte', etiqueta: 'Pasaporte' },
              ]}
            />
            <View style={{ height: E.md }} />
            <Campo
              etiqueta="Número de documento"
              icono="id-card-outline"
              value={documento}
              onChangeText={setDocumento}
              autoCapitalize="characters"
              keyboardType={tipoDoc === 'DNI' ? 'number-pad' : 'default'}
              maxLength={15}
            />
            <Campo
              etiqueta="Domicilio"
              icono="home-outline"
              value={domicilio}
              onChangeText={setDomicilio}
              placeholder="Calle, número, distrito y provincia"
              maxLength={250}
            />
            <Campo
              etiqueta="Correo electrónico"
              icono="mail-outline"
              value={correo}
              onChangeText={setCorreo}
              autoCapitalize="none"
              keyboardType="email-address"
              ayuda="Te enviaremos la respuesta a este correo"
            />
            <Campo
              etiqueta="Teléfono"
              icono="call-outline"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              ayuda="Opcional"
            />
            <Casilla marcada={menor} onCambiar={setMenor}>
              <Text style={s.casilla}>Soy menor de edad</Text>
            </Casilla>
            {menor && (
              <Campo
                etiqueta="Nombre del padre, madre o apoderado"
                icono="people-outline"
                value={apoderado}
                onChangeText={setApoderado}
                maxLength={150}
              />
            )}
          </Tarjeta>
        </Entrada>

        <Entrada i={3}>
          <Tarjeta>
            <Text style={[s.bloqueTitulo, { marginBottom: E.md }]}>2. Lo que contrataste</Text>
            <Opciones
              valor={bien}
              onChange={setBien}
              opciones={[
                { valor: 'producto', etiqueta: 'Producto', icono: 'cube-outline' },
                { valor: 'servicio', etiqueta: 'Servicio', icono: 'briefcase-outline' },
              ]}
            />
            <View style={{ height: E.md }} />
            <Campo
              etiqueta="Descripción"
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Ej.: encargo de unas zapatillas desde EE. UU."
              maxLength={500}
            />
            <Campo
              etiqueta="Monto reclamado (S/)"
              icono="cash-outline"
              value={monto}
              onChangeText={setMonto}
              keyboardType="decimal-pad"
              ayuda="Opcional"
            />
            <Campo
              etiqueta="Código o nombre del pedido"
              icono="pricetag-outline"
              value={codigoPedido}
              onChangeText={setCodigoPedido}
              ayuda="Opcional. Nos ayuda a ubicarlo más rápido"
              maxLength={60}
            />
          </Tarjeta>
        </Entrada>

        <Entrada i={4}>
          <Tarjeta>
            <Text style={[s.bloqueTitulo, { marginBottom: E.md }]}>3. Tu reclamo o queja</Text>
            <Opciones
              valor={tipo}
              onChange={setTipo}
              opciones={[
                { valor: 'reclamo', etiqueta: TIPO_RECLAMACION.reclamo.etiqueta },
                { valor: 'queja', etiqueta: TIPO_RECLAMACION.queja.etiqueta },
              ]}
            />
            <Text style={[s.ayuda, { marginTop: E.sm, marginBottom: E.md }]}>
              {TIPO_RECLAMACION[tipo].detalle}
            </Text>
            <Campo
              etiqueta="Detalle"
              value={detalle}
              onChangeText={setDetalle}
              multiline
              numberOfLines={5}
              style={{ height: 120, textAlignVertical: 'top' }}
              placeholder="Cuéntanos qué pasó, con fechas si las tienes"
              maxLength={3000}
            />
            <Campo
              etiqueta="¿Qué solución esperas?"
              value={pedido}
              onChangeText={setPedido}
              multiline
              numberOfLines={3}
              style={{ height: 90, textAlignVertical: 'top' }}
              placeholder="Ej.: que me devuelvan lo que pagué"
              maxLength={2000}
            />
          </Tarjeta>
        </Entrada>

        <Entrada i={5}>
          <Casilla marcada={acepta} onCambiar={setAcepta}>
            <Text style={s.casilla}>
              Autorizo a Encárgalo a usar estos datos solo para atender esta hoja (Ley N° 29733).
            </Text>
          </Casilla>
          <Micro style={{ marginVertical: E.md }}>
            La formulación del reclamo no impide acudir a otras vías de solución de controversias
            ni es requisito previo para interponer una denuncia ante el INDECOPI.
          </Micro>
          <Boton titulo="Enviar hoja de reclamación" icono="send" onPress={enviar} cargando={enviando} />
        </Entrada>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Pantalla de confirmación: el número es la constancia del consumidor. */
function Constancia({
  c,
  correo,
  tipo,
}: {
  c: ConstanciaReclamacion;
  correo: string;
  tipo: TipoReclamacion;
}) {
  const texto =
    `Libro de reclamaciones de Encárgalo\n` +
    `Hoja N° ${c.numero} (${TIPO_RECLAMACION[tipo].etiqueta.toLowerCase()})\n` +
    `Registrada: ${fechaHora(c.creado_en)}\n` +
    `Respuesta a más tardar el ${fecha(c.vence_en)}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.fondo }}
      contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl, gap: E.lg }}>
      <View style={s.listo}>
        <Ionicons name="checkmark-circle" size={52} color={C.verde} />
        <Text style={s.listoTitulo}>Registramos tu hoja</Text>
        <Text style={s.listoTexto}>Guarda este número: es tu constancia.</Text>
        <View style={s.numero}>
          <Text selectable style={s.numeroTexto}>
            {c.numero}
          </Text>
        </View>
      </View>

      <Tarjeta>
        <Text style={s.ayuda}>Registrada el {fechaHora(c.creado_en)}</Text>
        <Text style={[s.ayuda, { marginTop: E.xs }]}>
          Te responderemos a <Text style={{ fontWeight: '700' }}>{correo}</Text> a más tardar el{' '}
          <Text style={{ fontWeight: '700' }}>{fecha(c.vence_en)}</Text> (15 días hábiles).
        </Text>
      </Tarjeta>

      <Aviso tono="info">
        Todavía no enviamos una copia por correo: toma una captura de esta pantalla o compártela
        para tener tu constancia a la mano.
      </Aviso>

      <Boton
        titulo="Compartir constancia"
        icono="share-outline"
        variante="secundario"
        onPress={() => Share.share({ message: texto }).catch(() => {})}
      />
      <Boton
        titulo="Volver"
        variante="fantasma"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </ScrollView>
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
  bloqueTitulo: { fontSize: 16, fontWeight: '800', color: C.azul },
  ayuda: { fontSize: 13, color: C.textoSuave, lineHeight: 19 },
  casilla: { fontSize: 14, color: C.texto, lineHeight: 20 },
  listo: { alignItems: 'center', gap: E.sm, paddingTop: E.xl },
  listoTitulo: { fontSize: 22, fontWeight: '800', color: C.azul },
  listoTexto: { fontSize: 14.5, color: C.textoSuave },
  numero: {
    marginTop: E.sm,
    paddingHorizontal: E.xl,
    paddingVertical: E.md,
    borderRadius: R.md,
    backgroundColor: C.blanco,
    borderWidth: 2,
    borderColor: C.verde,
  },
  numeroTexto: { fontSize: 26, fontWeight: '800', color: C.azul, letterSpacing: 1 },
});
