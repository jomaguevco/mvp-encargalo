import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/ui/Texto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/ctx/auth';
import { actualizarPerfil, misPedidos, reputacionDe } from '@/lib/api';
import { codigoReferidoDe, ESTADO_VERIFICACION, fecha } from '@/lib/negocio';
import type { Pedido, Reputacion } from '@/lib/tipos';
import {
  Avatar,
  Boton,
  Chip,
  Cuadricula,
  Entrada,
  Estrellas,
  Seccion,
  Tarjeta,
  type NombreIcono,
} from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { useEscritorio } from '@/ui/escritorio';
import { PedidoCard } from '@/ui/PedidoCard';
import { C, E, R } from '@/ui/tema';

/** Una fila de dato o de ajuste dentro de una tarjeta. */
function Opcion({
  icono,
  titulo,
  detalle,
  onPress,
  derecha,
  color = C.azulMedio,
}: {
  icono: NombreIcono;
  titulo: string;
  detalle?: string;
  onPress?: () => void;
  derecha?: ReactNode;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.opcion, pressed && { backgroundColor: C.superficieSuave }]}>
      <View style={[s.opcionIcono, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icono} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.opcionTitulo}>{titulo}</Text>
        {!!detalle && <Text style={s.opcionDetalle}>{detalle}</Text>}
      </View>
      {derecha ??
        (onPress ? <Ionicons name="chevron-forward" size={18} color={C.textoSuave} /> : null)}
    </Pressable>
  );
}

/** Una cifra de la reputación: valor grande, etiqueta y, si hace falta, algo más debajo. */
function Cifra({
  icono,
  valor,
  etiqueta,
  color,
  children,
}: {
  icono: NombreIcono;
  valor: string;
  etiqueta: string;
  color: string;
  children?: ReactNode;
}) {
  const { es: escritorio } = useEscritorio();
  return (
    <View style={[s.cifra, escritorio && s.cuarto]}>
      <View style={[s.cifraIcono, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icono} size={16} color={color} />
      </View>
      <Text style={s.cifraValor}>{valor}</Text>
      <Text style={s.cifraEtiqueta}>{etiqueta}</Text>
      {children}
    </View>
  );
}

/** Acceso rápido: lo que la persona viene a hacer, a un toque desde su perfil. */
function Acceso({
  icono,
  titulo,
  detalle,
  color,
  destino,
  globo,
}: {
  icono: NombreIcono;
  titulo: string;
  detalle: string;
  color: string;
  destino: Href;
  globo?: number;
}) {
  const { es: escritorio } = useEscritorio();
  return (
    <Pressable
      onPress={() => router.push(destino)}
      style={({ pressed }) => [s.acceso, escritorio && s.cuarto, pressed && { borderColor: color }]}>
      <View style={[s.accesoIcono, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icono} size={20} color={color} />
        {!!globo && globo > 0 && (
          <View style={s.globo}>
            <Text style={s.globoTexto}>{globo > 9 ? '9+' : globo}</Text>
          </View>
        )}
      </View>
      <Text style={s.accesoTitulo} numberOfLines={1}>
        {titulo}
      </Text>
      <Text style={s.accesoDetalle} numberOfLines={2}>
        {detalle}
      </Text>
    </Pressable>
  );
}

export default function Perfil() {
  const { perfil, sesion, salir, refrescarPerfil, esOperador, avisosPendientes } = useAuth();
  const { es: escritorio, columnas } = useEscritorio();
  const [rep, setRep] = useState<Reputacion | null>(null);
  const [recientes, setRecientes] = useState<Pedido[]>([]);
  const [guardando, setGuardando] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      refrescarPerfil();
      if (perfil?.id) reputacionDe(perfil.id).then(setRep);
      misPedidos()
        .then(setRecientes)
        .catch(() => setRecientes([]));
    }, [perfil?.id, refrescarPerfil]),
  );

  if (!perfil) return null;
  const v = ESTADO_VERIFICACION[perfil.verificacion];
  const verificado = perfil.verificacion === 'verificado';
  const codigo = codigoReferidoDe(perfil.id);
  // Los pedidos recientes se muestran en una sola fila de la cuadrícula.
  const porFila = Math.min(columnas, 4);
  const ultimos = recientes.slice(0, porFila);

  async function alternarComprador(valor: boolean) {
    setGuardando(true);
    try {
      await actualizarPerfil({ es_comprador: valor });
      await refrescarPerfil();
    } catch (e) {
      avisar('No se pudo guardar', (e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // ------------------------------------------------------------- bloques
  const verificacion = !verificado && (
    <Entrada i={2}>
      <Tarjeta
        style={{
          borderColor: perfil.verificacion === 'rechazado' ? C.rojo : C.naranja,
          borderWidth: 1.5,
        }}>
        <View style={{ flexDirection: 'row', gap: E.md, alignItems: 'center' }}>
          <View style={[s.opcionIcono, { backgroundColor: `${v.color}18`, width: 44, height: 44 }]}>
            <Ionicons name="shield-half" size={22} color={v.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.opcionTitulo}>{v.etiqueta}</Text>
            <Text style={s.opcionDetalle}>
              {v.detalle}
              {perfil.verificacion === 'rechazado' && perfil.motivo_rechazo
                ? `. Motivo: ${perfil.motivo_rechazo}`
                : ''}
            </Text>
          </View>
        </View>
        {perfil.verificacion !== 'en_revision' && (
          <Boton
            titulo="Verificar mi identidad"
            icono="finger-print"
            onPress={() => router.push('/verificacion')}
            style={{ marginTop: E.md }}
          />
        )}
      </Tarjeta>
    </Entrada>
  );

  const comprador = (
    <>
      <Seccion titulo="Ganar con mis viajes" icono="airplane-outline" />
      <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
        <Image
          source={require('../../../assets/fotos/maleta-lista.jpg')}
          style={s.fotoTarjeta}
          resizeMode="cover"
        />
        <Opcion
          icono="briefcase"
          color={C.naranja}
          titulo="Soy comprador externo"
          detalle={
            perfil.es_comprador
              ? 'Ves los pedidos abiertos y puedes ofertar cuando viajas.'
              : 'Actívalo para ofertar por pedidos cuando viajas o traes productos.'
          }
          derecha={
            <Switch
              value={perfil.es_comprador}
              onValueChange={alternarComprador}
              disabled={guardando}
              trackColor={{ true: C.naranja, false: C.borde }}
              thumbColor={C.blanco}
            />
          }
        />
      </Tarjeta>
    </>
  );

  const referidos = (
    <>
      <Seccion titulo="Invita a un amigo" icono="gift-outline" />
      <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
        <View style={s.refFila}>
          <Image
            source={require('../../../assets/fotos/entrega.jpg')}
            style={s.refFoto}
            resizeMode="cover"
          />
          <View style={s.refCuerpo}>
            <Text style={s.refTexto}>
              Cuando tu amigo complete su primer pedido, los dos reciben un descuento.
            </Text>
            <View style={s.codigoCaja}>
              <Text selectable style={s.codigo}>
                {codigo}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                Share.share({
                  message:
                    'Pide lo que quieras del extranjero sin miedo a que te estafen. ' +
                    'Regístrate en Encárgalo con mi código ' +
                    codigo +
                    ' y los dos tenemos un descuento en el primer pedido.',
                })
              }
              style={({ pressed }) => [s.compartir, pressed && { opacity: 0.85 }]}>
              <Ionicons name="share-social" size={17} color={C.blanco} />
              <Text style={s.compartirTexto}>Compartir mi código</Text>
            </Pressable>
          </View>
        </View>
      </Tarjeta>
    </>
  );

  const cuenta = (
    <>
      <Seccion titulo="Mi cuenta" icono="person-outline" />
      <Tarjeta style={{ padding: 0 }}>
        <Opcion icono="call" titulo="Celular" detalle={perfil.telefono ?? '—'} />
        <View style={s.linea} />
        <Opcion icono="location" titulo="Ciudad" detalle={perfil.ciudad} />
        <View style={s.linea} />
        <Opcion
          icono="card"
          titulo="DNI"
          detalle={
            perfil.dni
              ? `••••${perfil.dni.slice(-4)}${
                  perfil.dni_validacion === 'coincide' ? ' · validado con RENIEC' : ''
                }`
              : 'Sin registrar'
          }
        />
      </Tarjeta>

      <Tarjeta style={{ padding: 0 }}>
        <Opcion
          icono="document-text"
          titulo="Términos y privacidad"
          detalle="Qué hacemos con tu DNI y con tu dinero"
          onPress={() => router.push('/legal')}
        />
        <View style={s.linea} />
        <Opcion
          icono="log-out"
          color={C.rojo}
          titulo="Cerrar sesión"
          onPress={async () => {
            const seguro = await confirmar(
              'Cerrar sesión',
              '¿Seguro que quieres salir?',
              'Salir',
              true,
            );
            if (!seguro) return;
            await salir();
            router.replace('/entrar');
          }}
        />
      </Tarjeta>

      <View style={s.ley}>
        <Ionicons name="lock-closed" size={14} color={C.textoSuave} />
        <Text style={s.leyTexto}>
          Guardamos solo el número de tu DNI. Las fotos del documento se eliminan una vez validada
          tu identidad (Ley N° 29733).
        </Text>
      </View>
    </>
  );

  // ------------------------------------------------------------- pantalla
  return (
    <ScrollView
      style={{ backgroundColor: C.fondo }}
      contentContainerStyle={{ paddingBottom: E.xxl }}>
      {/* Portada: una foto de viaje, como la cabecera de un perfil. */}
      <View style={[s.portada, escritorio && s.portadaEscritorio, { height: (escritorio ? 220 : 190) + insets.top }]}>
        <Image
          source={require('../../../assets/fotos/aeropuerto.jpg')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={s.portadaVelo} />
      </View>

      <View style={[s.contenido, escritorio && { paddingHorizontal: E.sm }]}>
        {/* ---------------------------------------------- identidad */}
        <Entrada>
          <View style={[s.identidad, escritorio && s.identidadEscritorio]}>
            <View style={s.avatarAro}>
              <Avatar nombre={perfil.nombre_completo} tamano={escritorio ? 96 : 80} verificado={verificado} />
            </View>
            <View style={[s.identidadTexto, escritorio && { alignItems: 'flex-start' }]}>
              <Text style={[s.nombre, escritorio && { textAlign: 'left' }]}>
                {perfil.nombre_completo || 'Sin nombre'}
              </Text>
              <Text style={s.correo}>{sesion?.user.email}</Text>
              <View style={[s.chips, escritorio && { justifyContent: 'flex-start' }]}>
                <Chip
                  texto={v.etiqueta}
                  color={verificado ? C.verde : v.color}
                  icono={verificado ? 'shield-checkmark' : 'shield-outline'}
                />
                {perfil.es_comprador && (
                  <Chip texto="Comprador externo" color={C.naranjaOscuro} icono="airplane" />
                )}
                {esOperador && <Chip texto="Equipo" color={C.ambar} icono="key" />}
                <Chip
                  texto={`Desde ${fecha(perfil.creado_en)}`}
                  color={C.textoSuave}
                  icono="calendar-outline"
                />
              </View>
            </View>
            <Pressable
              onPress={() => router.push(`/reputacion/${perfil.id}`)}
              style={({ pressed }) => [
                s.verPublico,
                !escritorio && { alignSelf: 'stretch', justifyContent: 'center' },
                pressed && { opacity: 0.8 },
              ]}>
              <Ionicons name="eye-outline" size={16} color={C.azul} />
              <Text style={s.verPublicoTexto}>Ver mi perfil público</Text>
            </Pressable>
          </View>
        </Entrada>

        {/* ---------------------------------------------- reputación */}
        <Entrada i={1}>
          <View style={s.cifras}>
            <Cifra
              icono="star"
              color={C.estrella}
              valor={rep?.calificacion != null ? Number(rep.calificacion).toFixed(1) : '—'}
              etiqueta={
                rep?.total_calificaciones
                  ? `${rep.total_calificaciones} calificación${rep.total_calificaciones === 1 ? '' : 'es'}`
                  : 'Sin calificaciones'
              }>
              <View style={{ marginTop: 4 }}>
                <Estrellas valor={Number(rep?.calificacion ?? 0)} tamano={13} />
              </View>
            </Cifra>
            <Cifra
              icono="checkmark-done"
              color={C.verde}
              valor={String(rep?.pedidos_cumplidos ?? 0)}
              etiqueta="Pedidos cumplidos"
            />
            <Cifra
              icono="pie-chart"
              color={C.azulMedio}
              valor={rep?.tasa_cumplimiento != null ? `${rep.tasa_cumplimiento}%` : '—'}
              etiqueta="Cumplimiento"
            />
            <Cifra
              icono="timer"
              color={C.naranja}
              valor={rep?.puntualidad != null ? `${rep.puntualidad}%` : '—'}
              etiqueta="Puntualidad"
            />
          </View>
          <Text style={s.repPie}>
            Estas cifras son públicas: son las que mira un cliente al elegir entre varias ofertas.
          </Text>
        </Entrada>

        {/* ---------------------------------------------- accesos */}
        <Seccion titulo="Accesos rápidos" icono="flash-outline" />
        <View style={s.accesos}>
          <Acceso
            icono="cube"
            color={C.azul}
            titulo="Mis pedidos"
            detalle={`${recientes.length} en total`}
            destino="/(app)/pedidos"
          />
          <Acceso
            icono="add-circle"
            color={C.naranja}
            titulo="Publicar"
            detalle="Pide algo del extranjero"
            destino={verificado ? '/publicar' : '/verificacion'}
          />
          <Acceso
            icono="airplane"
            color={C.verde}
            titulo={perfil.es_comprador ? 'Ofertar' : 'Ganar viajando'}
            detalle={perfil.es_comprador ? 'Pedidos abiertos' : 'Trae encargos y cobra'}
            destino="/(app)/explorar"
          />
          <Acceso
            icono="notifications"
            color={C.ambar}
            titulo="Avisos"
            detalle={avisosPendientes ? `${avisosPendientes} sin leer` : 'Todo al día'}
            destino="/(app)/avisos"
            globo={avisosPendientes}
          />
        </View>

        {/* ---------------------------------------------- pedidos recientes */}
        {ultimos.length > 0 && (
          <>
            <Seccion
              titulo="Tus pedidos recientes"
              icono="time-outline"
              accion="Ver todos"
              onAccion={() => router.push('/(app)/pedidos')}
            />
            <Cuadricula
              datos={ultimos}
              columnas={porFila}
              clave={(p) => p.id}
              render={(p) => <PedidoCard pedido={p} />}
            />
          </>
        )}

        {/* ---------------------------------------------- resto */}
        {escritorio ? (
          <View style={s.columnas}>
            <View style={s.columna}>
              {verificacion}
              {cuenta}
            </View>
            <View style={s.columna}>
              {comprador}
              {referidos}
            </View>
          </View>
        ) : (
          <>
            {verificacion}
            {comprador}
            {referidos}
            {cuenta}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  portada: {
    overflow: 'hidden',
    borderBottomLeftRadius: R.xl,
    borderBottomRightRadius: R.xl,
    backgroundColor: C.azul,
  },
  portadaEscritorio: { borderRadius: R.lg, marginHorizontal: E.sm },
  // Velo Monte sobre la foto: la integra con la marca sin apagarla.
  portadaVelo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,53,43,0.35)' },
  contenido: { paddingHorizontal: E.lg, marginTop: -56 },

  identidad: {
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borde,
    padding: E.lg,
    alignItems: 'center',
    gap: E.md,
  },
  identidadEscritorio: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: E.lg,
    paddingHorizontal: E.xl,
  },
  avatarAro: {
    padding: 4,
    borderRadius: 60,
    backgroundColor: C.blanco,
    marginTop: -48,
  },
  identidadTexto: { flex: 1, alignItems: 'center', alignSelf: 'stretch' },
  nombre: {
    color: C.azul,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  correo: { color: C.textoSuave, fontSize: 14, marginTop: 2 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: E.sm,
    marginTop: E.md,
  },
  verPublico: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.bordeFuerte,
    backgroundColor: C.blanco,
    paddingHorizontal: E.md + 2,
    paddingVertical: E.sm + 2,
    borderRadius: R.md,
  },
  verPublicoTexto: { fontSize: 14, fontWeight: '600', color: C.azul },

  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: E.sm + 2, marginTop: E.md },
  cifra: {
    // 2 por fila en el teléfono, 4 en escritorio (21 % + los huecos).
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 150,
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borde,
    padding: E.md + 2,
  },
  cifraIcono: {
    width: 30,
    height: 30,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.sm,
  },
  cifraValor: { fontSize: 24, fontWeight: '800', color: C.azul, letterSpacing: -0.6 },
  cifraEtiqueta: { fontSize: 12.5, color: C.textoSuave, fontWeight: '500', marginTop: 1 },
  repPie: { fontSize: 12.5, color: C.textoSuave, marginTop: E.sm, lineHeight: 18 },

  accesos: { flexDirection: 'row', flexWrap: 'wrap', gap: E.sm + 2 },
  /** En escritorio, cuatro por fila. */
  cuarto: { flexBasis: '22%' },
  acceso: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 150,
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borde,
    padding: E.md + 2,
  },
  accesoIcono: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: E.sm,
  },
  accesoTitulo: { fontSize: 15, fontWeight: '600', color: C.texto },
  accesoDetalle: { fontSize: 12.5, color: C.textoSuave, marginTop: 2 },
  globo: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.rojo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.blanco,
  },
  globoTexto: { fontSize: 10, fontWeight: '700', color: C.blanco },

  columnas: { flexDirection: 'row', gap: E.xl, alignItems: 'flex-start' },
  columna: { flex: 1, minWidth: 0 },

  opcion: { flexDirection: 'row', alignItems: 'center', gap: E.md, padding: E.lg },
  opcionIcono: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionTitulo: { fontSize: 15, fontWeight: '600', color: C.texto },
  opcionDetalle: { fontSize: 13, color: C.textoSuave, marginTop: 2, lineHeight: 18 },
  linea: { height: 1, backgroundColor: C.borde, marginLeft: 70 },

  fotoTarjeta: { width: '100%', height: 120 },

  refFila: { flexDirection: 'row', flexWrap: 'wrap' },
  refFoto: { flexGrow: 1, flexBasis: 160, minHeight: 150 },
  refCuerpo: { flexGrow: 2, flexBasis: 220, padding: E.lg },
  refTexto: { color: C.texto, fontSize: 14.5, lineHeight: 21 },
  codigoCaja: {
    backgroundColor: C.superficieSuave,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.bordeFuerte,
    borderStyle: 'dashed',
    paddingVertical: E.md,
    marginVertical: E.md,
  },
  codigo: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
    color: C.azul,
    textAlign: 'center',
  },
  compartir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: E.sm,
    backgroundColor: C.naranja,
    borderRadius: R.md,
    height: 46,
  },
  compartirTexto: { color: C.blanco, fontWeight: '600', fontSize: 15 },

  ley: { flexDirection: 'row', gap: E.sm, paddingHorizontal: E.sm, marginTop: E.sm },
  leyTexto: { flex: 1, fontSize: 12.5, color: C.textoSuave, lineHeight: 18 },
});
