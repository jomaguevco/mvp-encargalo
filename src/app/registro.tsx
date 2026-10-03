import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/ctx/auth';
import { actualizarPerfil } from '@/lib/api';
import { ORIGENES, VERSION_TERMINOS } from '@/lib/negocio';
import {
  Aviso,
  Boton,
  Campo,
  Casilla,
  Entrada,
  Etiqueta,
  Opciones,
  Tarjeta,
} from '@/ui/componentes';
import { CampoDni, type EstadoDni } from '@/ui/CampoDni';
import { C, E } from '@/ui/tema';

type Origen = (typeof ORIGENES)[number]['valor'];

/** Cabecera de un bloque del formulario: número, título y explicación corta. */
function Bloque({ n, titulo, detalle }: { n: number; titulo: string; detalle: string }) {
  return (
    <View style={s.bloque}>
      <View style={s.bloqueNumero}>
        <Text style={s.bloqueNumeroTexto}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.bloqueTitulo}>{titulo}</Text>
        <Text style={s.bloqueDetalle}>{detalle}</Text>
      </View>
    </View>
  );
}

export default function Registro() {
  const { registrar, entrar } = useAuth();
  const [dni, setDni] = useState('');
  const [estadoDni, setEstadoDni] = useState<EstadoDni>({ tipo: 'vacio' });
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [origen, setOrigen] = useState<Origen | null>(null);
  const [codigo, setCodigo] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Con el nombre de RENIEC el campo queda fijo: es lo que hace que la
  // verificación posterior coincida sola. Si RENIEC no respondió, se escribe a mano.
  const nombreFijo = estadoDni.tipo === 'encontrado';

  function alCambiarEstado(e: EstadoDni) {
    setEstadoDni(e);
    if (e.tipo === 'encontrado') setNombre(e.nombre);
  }

  function validar(): string | null {
    if (!/^[0-9]{8}$/.test(dni)) return 'Escribe los 8 dígitos de tu DNI';
    if (estadoDni.tipo === 'no_existe') return 'RENIEC no reconoce ese DNI. Revísalo';
    if (estadoDni.tipo === 'buscando') return 'Espera un segundo: estamos consultando RENIEC';
    if (nombre.trim().length < 5) return 'Escribe tu nombre y apellidos completos';
    if (!/^9\d{8}$/.test(telefono.trim()))
      return 'El celular debe tener 9 dígitos y empezar en 9';
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) return 'Revisa tu correo electrónico';
    if (clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!origen) return 'Cuéntanos cómo conociste Encárgalo';
    if (codigo.trim() && !/^[0-9A-Fa-f]{6}$/.test(codigo.trim()))
      return 'El código de quien te invitó tiene 6 caracteres, como A1B2C3';
    if (!acepto)
      return 'Para crear la cuenta tienes que aceptar los términos y la política de privacidad';
    return null;
  }

  async function enviar() {
    const problema = validar();
    setError(problema);
    if (problema) return;

    setCargando(true);
    try {
      await registrar({
        correo,
        clave,
        nombre,
        telefono,
        origen: origen as string,
        codigoReferido: codigo,
        versionTerminos: VERSION_TERMINOS,
      });
      // Si el proyecto no exige confirmación por correo, la sesión ya queda abierta.
      let conSesion = false;
      try {
        await entrar(correo, clave);
        conSesion = true;
      } catch {
        /* el proyecto pide confirmar el correo */
      }
      if (!conSesion) {
        router.replace('/entrar');
        return;
      }
      // El DNI se guarda en el perfil para que la verificación ya lo traiga
      // escrito. No va en los metadatos de auth: así hay una sola copia.
      try {
        await actualizarPerfil({ dni });
      } catch {
        /* se vuelve a pedir en la verificación */
      }
      router.replace('/(app)/pedidos');
      router.push('/verificacion');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
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
              <Ionicons name="person-add" size={24} color={C.naranja} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.introTitulo}>Crea tu cuenta</Text>
              <Text style={s.introTexto}>
                Toma dos minutos. Después verificas tu identidad y ya puedes pedir u
                ofertar.
              </Text>
            </View>
          </View>
        </Entrada>

        {!!error && <Aviso tono="error">{error}</Aviso>}

        <Entrada i={1}>
          <Tarjeta>
            <Bloque
              n={1}
              titulo="Tu identidad"
              detalle="Escribe tu DNI y completamos tu nombre con los datos de RENIEC."
            />
            <CampoDni valor={dni} onCambiar={setDni} onEstado={alCambiarEstado} />
            <Campo
              etiqueta="Nombre y apellidos"
              icono="person-outline"
              value={nombre}
              onChangeText={setNombre}
              editable={!nombreFijo}
              placeholder={
                estadoDni.tipo === 'sin_servicio' ? 'Como figura en tu DNI' : 'Se completa con tu DNI'
              }
              autoComplete="name"
              ayuda={
                nombreFijo
                  ? 'Tomado de RENIEC. Si no es tuyo, revisa el número de DNI.'
                  : undefined
              }
            />
          </Tarjeta>
        </Entrada>

        <Entrada i={2}>
          <Tarjeta>
            <Bloque n={2} titulo="Tu cuenta" detalle="Con esto entras a la app." />
            <Campo
              etiqueta="Celular"
              icono="call-outline"
              value={telefono}
              onChangeText={(t) => setTelefono(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={9}
              placeholder="9XXXXXXXX"
              ayuda="Lo usamos solo para avisarte de tus pedidos"
            />
            <Campo
              etiqueta="Correo electrónico"
              icono="mail-outline"
              value={correo}
              onChangeText={setCorreo}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="tucorreo@ejemplo.com"
            />
            <Campo
              etiqueta="Contraseña"
              icono="lock-closed-outline"
              value={clave}
              onChangeText={setClave}
              secureTextEntry={!verClave}
              placeholder="Mínimo 8 caracteres"
              derecha={
                <Pressable onPress={() => setVerClave((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={verClave ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={C.textoSuave}
                  />
                </Pressable>
              }
            />
            <FuerzaClave clave={clave} />
          </Tarjeta>
        </Entrada>

        <Entrada i={3}>
          <Tarjeta>
            <Bloque
              n={3}
              titulo="Un par de preguntas"
              detalle="Nos ayuda a saber qué canales funcionan."
            />
            <View style={{ marginBottom: E.lg }}>
              <Etiqueta>¿Cómo conociste Encárgalo?</Etiqueta>
              <Opciones
                valor={origen}
                onChange={setOrigen}
                opciones={ORIGENES.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))}
              />
            </View>
            <Campo
              etiqueta="Código de quien te invitó"
              icono="gift-outline"
              value={codigo}
              onChangeText={setCodigo}
              autoCapitalize="characters"
              maxLength={6}
              placeholder="Opcional"
              ayuda="Si alguien te recomendó Encárgalo, los dos reciben un descuento en su primer pedido"
            />
          </Tarjeta>
        </Entrada>

        <View style={{ marginVertical: E.md }}>
          <Casilla marcada={acepto} onCambiar={setAcepto}>
            <Text style={{ color: C.texto, fontSize: 14, lineHeight: 21 }}>
              Acepto los{' '}
              <Link href="/legal" style={{ color: C.azulMedio, fontWeight: '800' }}>
                términos y condiciones y la política de privacidad
              </Link>
              , incluido que Encárgalo retiene mi pago hasta que confirme la recepción y que
              trata mi DNI solo para verificar mi identidad.
            </Text>
          </Casilla>
        </View>

        <Boton
          titulo="Crear cuenta"
          icono="arrow-forward-circle"
          onPress={enviar}
          cargando={cargando}
        />

        <View style={s.pie}>
          <Text style={s.pieTexto}>¿Ya tienes cuenta? </Text>
          <Link href="/entrar" style={s.enlace}>
            Ingresa
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Tres rayas que se llenan según la contraseña: largo, números, mayúsculas. */
function FuerzaClave({ clave }: { clave: string }) {
  if (!clave) return null;
  const puntos =
    (clave.length >= 8 ? 1 : 0) +
    (/\d/.test(clave) && /[a-zA-Z]/.test(clave) ? 1 : 0) +
    (clave.length >= 12 || /[^a-zA-Z0-9]/.test(clave) ? 1 : 0);
  const conf = [
    { texto: 'Muy corta', color: C.rojo },
    { texto: 'Aceptable', color: C.ambar },
    { texto: 'Buena', color: C.azulMedio },
    { texto: 'Fuerte', color: C.verde },
  ][puntos];
  return (
    <View style={{ marginTop: -E.sm }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < puntos ? conf.color : C.borde,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: conf.color, marginTop: 4 }}>
        {conf.texto}
      </Text>
    </View>
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
  introTitulo: { fontSize: 22, fontWeight: '800', color: C.azul, letterSpacing: -0.4 },
  introTexto: { fontSize: 14, color: C.textoSuave, lineHeight: 20, marginTop: 2 },

  bloque: { flexDirection: 'row', gap: E.md, marginBottom: E.lg, alignItems: 'flex-start' },
  bloqueNumero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloqueNumeroTexto: { color: C.blanco, fontWeight: '800', fontSize: 13.5 },
  bloqueTitulo: { fontSize: 16.5, fontWeight: '800', color: C.azul },
  bloqueDetalle: { fontSize: 13, color: C.textoSuave, marginTop: 2, lineHeight: 18 },

  pie: { flexDirection: 'row', justifyContent: 'center', marginTop: E.lg },
  pieTexto: { color: C.textoSuave, fontSize: 14.5 },
  enlace: { color: C.naranja, fontWeight: '800', fontSize: 14.5 },
});
