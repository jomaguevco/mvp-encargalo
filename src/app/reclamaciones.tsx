import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { registrarReclamacion } from '@/lib/api';
import { PROVEEDOR, fecha, fechaHora } from '@/lib/negocio';
import type { NuevaReclamacion, ReclamacionRegistrada, TipoReclamacion } from '@/lib/tipos';
import {
  Aviso,
  Boton,
  Campo,
  Casilla,
  Dato,
  Etiqueta,
  Micro,
  Opciones,
  Parrafo,
  Separador,
  Subtitulo,
  Tarjeta,
} from '@/ui/componentes';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Libro de reclamaciones virtual (ES-15, Ley N° 29571).
 *
 * Es público: no hace falta tener cuenta para presentar un reclamo. Si hay
 * sesión, se rellenan el nombre y el correo, y la hoja se puede vincular a un
 * pedido (/reclamaciones?pedido=<id>). El número correlativo y el plazo de
 * 15 días hábiles los pone la base (registrar_reclamacion, 0019).
 */
export default function LibroReclamaciones() {
  const { perfil, sesion } = useAuth();
  const { pedido } = useLocalSearchParams<{ pedido?: string }>();

  const [tipo, setTipo] = useState<TipoReclamacion>('reclamo');
  const [nombre, setNombre] = useState('');
  const [documentoTipo, setDocumentoTipo] = useState<NuevaReclamacion['documento_tipo']>('DNI');
  const [documento, setDocumento] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [menor, setMenor] = useState(false);
  const [apoderado, setApoderado] = useState('');
  const [bienTipo, setBienTipo] = useState<NuevaReclamacion['bien_tipo']>('servicio');
  const [monto, setMonto] = useState('');
  const [bien, setBien] = useState('');
  const [detalle, setDetalle] = useState('');
  const [pide, setPide] = useState('');
  const [acepto, setAcepto] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hoja, setHoja] = useState<(ReclamacionRegistrada & NuevaReclamacion) | null>(null);

  // Con sesión: lo que ya sabemos de la persona.
  useEffect(() => {
    if (perfil?.nombre_completo) setNombre((n) => n || perfil.nombre_completo);
    if (perfil?.dni) setDocumento((d) => d || perfil.dni!);
    if (perfil?.telefono) setTelefono((t) => t || perfil.telefono!);
    if (sesion?.user.email) setCorreo((c) => c || sesion.user.email!);
  }, [perfil, sesion]);

  function validar(): string | null {
    if (nombre.trim().split(/\s+/).length < 2) return 'Escribe tu nombre y apellidos';
    if (documentoTipo === 'DNI' && !/^[0-9]{8}$/.test(documento.trim()))
      return 'El DNI debe tener 8 dígitos';
    if (!/^[A-Za-z0-9]{6,15}$/.test(documento.trim())) return 'Revisa el número de documento';
    if (domicilio.trim().length < 5) return 'Escribe tu domicilio';
    if (!CORREO.test(correo.trim())) return 'Escribe un correo válido: ahí te llega la copia';
    if (telefono.trim() && !/^[0-9 +]{6,20}$/.test(telefono.trim())) return 'Revisa el teléfono';
    if (menor && apoderado.trim().length < 3)
      return 'Si eres menor de edad, escribe el nombre de tu padre, madre o apoderado';
    if (monto.trim() && (Number.isNaN(Number(monto)) || Number(monto) < 0))
      return 'El monto debe ser un número';
    if (bien.trim().length < 3) return 'Describe el producto o servicio';
    if (detalle.trim().length < 10) return 'Cuéntanos qué pasó (al menos 10 caracteres)';
    if (pide.trim().length < 3) return 'Escribe qué solicitas';
    if (!acepto) return 'Confirma que los datos son verdaderos';
    return null;
  }

  async function enviar() {
    const problema = validar();
    setError(problema);
    if (problema) return;
    const datos: NuevaReclamacion = {
      tipo,
      nombre: nombre.trim(),
      documento_tipo: documentoTipo,
      documento_numero: documento.trim().toUpperCase(),
      domicilio: domicilio.trim(),
      telefono: telefono.trim() || null,
      correo: correo.trim().toLowerCase(),
      menor_de_edad: menor,
      apoderado: menor ? apoderado.trim() : null,
      bien_tipo: bienTipo,
      monto: monto.trim() ? Number(monto) : null,
      bien_descripcion: bien.trim(),
      pedido_id: pedido ?? null,
      detalle: detalle.trim(),
      pedido_consumidor: pide.trim(),
    };
    setEnviando(true);
    try {
      const r = await registrarReclamacion(datos);
      setHoja({ ...datos, ...r });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (hoja) return <Constancia hoja={hoja} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.contenido}
        keyboardShouldPersistTaps="handled">
        <View style={s.cabecera}>
          <View style={s.icono}>
            <Ionicons name="book" size={26} color={C.naranja} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>Libro de reclamaciones</Text>
            <Text style={s.subtitulo}>
              Conforme al Código de Protección y Defensa del Consumidor. Te respondemos en un
              plazo máximo de 15 días hábiles.
            </Text>
          </View>
        </View>

        <Tarjeta>
          <Etiqueta>Proveedor</Etiqueta>
          <Dato etiqueta="Razón social" valor={PROVEEDOR.razonSocial} />
          <Dato etiqueta="RUC" valor={PROVEEDOR.ruc} />
          <Dato etiqueta="Domicilio" valor={PROVEEDOR.domicilio} />
          <Dato etiqueta="Fecha" valor={fecha(new Date().toISOString())} />
        </Tarjeta>

        <Tarjeta>
          <Subtitulo>1. Tus datos</Subtitulo>
          <Campo etiqueta="Nombre y apellidos" value={nombre} onChangeText={setNombre} maxLength={120} />
          <Etiqueta>Documento</Etiqueta>
          <Opciones
            valor={documentoTipo}
            onChange={setDocumentoTipo}
            opciones={[
              { valor: 'DNI', etiqueta: 'DNI' },
              { valor: 'CE', etiqueta: 'Carné de extranjería' },
              { valor: 'Pasaporte', etiqueta: 'Pasaporte' },
            ]}
          />
          <View style={{ height: E.md }} />
          <Campo
            etiqueta="Número de documento"
            value={documento}
            onChangeText={setDocumento}
            keyboardType={documentoTipo === 'DNI' ? 'number-pad' : 'default'}
            autoCapitalize="characters"
            maxLength={15}
          />
          <Campo etiqueta="Domicilio" value={domicilio} onChangeText={setDomicilio} maxLength={200} placeholder="Calle, número, distrito" />
          <Campo
            etiqueta="Correo"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
            ayuda="Te enviamos aquí la copia de la hoja y la respuesta"
          />
          <Campo etiqueta="Teléfono (opcional)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" maxLength={20} />
          <Casilla marcada={menor} onCambiar={setMenor}>
            Soy menor de edad
          </Casilla>
          {menor && (
            <View style={{ marginTop: E.md }}>
              <Campo etiqueta="Nombre del padre, madre o apoderado" value={apoderado} onChangeText={setApoderado} maxLength={120} />
            </View>
          )}
        </Tarjeta>

        <Tarjeta>
          <Subtitulo>2. Lo que contrataste</Subtitulo>
          <Opciones
            valor={bienTipo}
            onChange={setBienTipo}
            opciones={[
              { valor: 'servicio', etiqueta: 'Servicio', icono: 'briefcase-outline' },
              { valor: 'producto', etiqueta: 'Producto', icono: 'cube-outline' },
            ]}
          />
          <View style={{ height: E.md }} />
          <Campo
            etiqueta="Descripción"
            value={bien}
            onChangeText={setBien}
            maxLength={500}
            placeholder="Ej.: encargo de zapatillas desde EE. UU."
          />
          <Campo
            etiqueta="Monto reclamado (S/, opcional)"
            value={monto}
            onChangeText={setMonto}
            keyboardType="decimal-pad"
          />
          {!!pedido && <Micro>Esta hoja quedará vinculada a tu pedido.</Micro>}
        </Tarjeta>

        <Tarjeta>
          <Subtitulo>3. Detalle</Subtitulo>
          <Opciones
            valor={tipo}
            onChange={setTipo}
            opciones={[
              { valor: 'reclamo', etiqueta: 'Reclamo' },
              { valor: 'queja', etiqueta: 'Queja' },
            ]}
          />
          <Micro style={{ marginVertical: E.sm }}>
            {tipo === 'reclamo'
              ? 'Reclamo: no estás conforme con el producto o el servicio.'
              : 'Queja: no estás conforme con la atención, aunque no tenga que ver con el producto o el servicio.'}
          </Micro>
          <Campo
            etiqueta="¿Qué pasó?"
            value={detalle}
            onChangeText={setDetalle}
            multiline
            numberOfLines={5}
            maxLength={3000}
            style={{ height: 120, textAlignVertical: 'top' }}
          />
          <Campo
            etiqueta="¿Qué solicitas?"
            value={pide}
            onChangeText={setPide}
            multiline
            numberOfLines={3}
            maxLength={1500}
            style={{ height: 80, textAlignVertical: 'top' }}
            placeholder="Ej.: la devolución de mi dinero"
          />
        </Tarjeta>

        <Casilla marcada={acepto} onCambiar={setAcepto}>
          Declaro que los datos son verdaderos. Usaremos tus datos solo para atender esta hoja y
          los conservaremos el tiempo que exige la ley.
        </Casilla>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        <Boton titulo="Enviar hoja de reclamación" icono="send" onPress={enviar} cargando={enviando} />

        <Micro style={{ marginTop: E.md }}>
          La formulación del reclamo no impide acudir a otras vías de solución de controversias
          ni es requisito previo para interponer una denuncia ante el INDECOPI.
        </Micro>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Constancia en pantalla: la copia que la persona puede guardar o capturar. */
function Constancia({ hoja }: { hoja: ReclamacionRegistrada & NuevaReclamacion }) {
  return (
    <ScrollView style={{ backgroundColor: C.fondo }} contentContainerStyle={s.contenido}>
      <Aviso tono="exito" titulo={`Registramos tu hoja ${hoja.correlativo}`}>
        Te responderemos a más tardar el {fecha(hoja.plazo_vence)}.
        {hoja.copiaEnviada
          ? ` Te enviamos una copia a ${hoja.correo}.`
          : ' No pudimos enviarte la copia por correo: guarda esta pantalla (captura o imprime).'}
      </Aviso>

      <Tarjeta>
        <Subtitulo>Hoja N.° {hoja.correlativo}</Subtitulo>
        <Micro>{fechaHora(hoja.creado_en)}</Micro>
        <Separador />
        <Etiqueta>Proveedor</Etiqueta>
        <Dato etiqueta="Razón social" valor={PROVEEDOR.razonSocial} />
        <Dato etiqueta="RUC" valor={PROVEEDOR.ruc} />
        <Separador />
        <Etiqueta>Consumidor</Etiqueta>
        <Dato etiqueta="Nombre" valor={hoja.nombre} />
        <Dato etiqueta={hoja.documento_tipo} valor={hoja.documento_numero} />
        <Dato etiqueta="Domicilio" valor={hoja.domicilio} />
        <Dato etiqueta="Correo" valor={hoja.correo} />
        {!!hoja.apoderado && <Dato etiqueta="Apoderado" valor={hoja.apoderado} />}
        <Separador />
        <Etiqueta>{hoja.bien_tipo === 'producto' ? 'Producto' : 'Servicio'}</Etiqueta>
        <Parrafo>{hoja.bien_descripcion}</Parrafo>
        {hoja.monto != null && <Dato etiqueta="Monto" valor={`S/ ${hoja.monto.toFixed(2)}`} />}
        <Separador />
        <Etiqueta>{hoja.tipo === 'reclamo' ? 'Reclamo' : 'Queja'}</Etiqueta>
        <Parrafo>{hoja.detalle}</Parrafo>
        <Etiqueta>Lo que solicitas</Etiqueta>
        <Parrafo>{hoja.pedido_consumidor}</Parrafo>
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  contenido: {
    padding: E.lg,
    paddingBottom: E.xxl,
    gap: E.md,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  cabecera: { flexDirection: 'row', gap: E.md, alignItems: 'center', marginBottom: E.sm },
  icono: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.naranjaClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 22, fontWeight: '800', color: C.azul, letterSpacing: -0.4 },
  subtitulo: { fontSize: 14, color: C.textoSuave, lineHeight: 20, marginTop: 2 },
});
