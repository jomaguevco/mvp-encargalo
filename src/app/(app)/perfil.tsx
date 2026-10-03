import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/ctx/auth';
import { actualizarPerfil, reputacionDe } from '@/lib/api';
import { codigoReferidoDe, ESTADO_VERIFICACION, fecha } from '@/lib/negocio';
import type { Reputacion } from '@/lib/tipos';
import {
  Avatar,
  Boton,
  Chip,
  Cifra,
  Entrada,
  Estrellas,
  FilaCifras,
  Seccion,
  Tarjeta,
  TarjetaDegradada,
  type NombreIcono,
} from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { C, E, G, R } from '@/ui/tema';

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
  derecha?: React.ReactNode;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.opcion, pressed && { backgroundColor: C.superficieSuave }]}>
      <View style={[s.opcionIcono, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icono} size={19} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.opcionTitulo}>{titulo}</Text>
        {!!detalle && <Text style={s.opcionDetalle}>{detalle}</Text>}
      </View>
      {derecha ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.textoSuave} /> : null)}
    </Pressable>
  );
}

export default function Perfil() {
  const { perfil, sesion, salir, refrescarPerfil, esOperador } = useAuth();
  const [rep, setRep] = useState<Reputacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      refrescarPerfil();
      if (perfil?.id) reputacionDe(perfil.id).then(setRep);
    }, [perfil?.id, refrescarPerfil]),
  );

  if (!perfil) return null;
  const v = ESTADO_VERIFICACION[perfil.verificacion];
  const verificado = perfil.verificacion === 'verificado';
  const codigo = codigoReferidoDe(perfil.id);

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

  return (
    <ScrollView
      style={{ backgroundColor: C.fondo }}
      contentContainerStyle={{ paddingBottom: E.xxl }}>
      {/* ------------------------------------------------ cabecera */}
      <View style={s.cabecera}>
        <LinearGradient
          colors={G.marca}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.burbuja, { top: -70, right: -50, width: 220, height: 220 }]} />
        <View style={{ paddingTop: insets.top + E.xl, alignItems: 'center' }}>
          <View style={s.avatarAro}>
            <Avatar nombre={perfil.nombre_completo} tamano={92} verificado={verificado} />
          </View>
          <Text style={s.nombre}>{perfil.nombre_completo || 'Sin nombre'}</Text>
          <Text style={s.correo}>{sesion?.user.email}</Text>
          <View style={{ flexDirection: 'row', gap: E.sm, marginTop: E.md }}>
            <Chip
              texto={v.etiqueta}
              color={verificado ? '#7EE2B8' : '#FFC59E'}
              fondo="rgba(255,255,255,0.14)"
              icono={verificado ? 'shield-checkmark' : 'shield-outline'}
            />
            {perfil.es_comprador && (
              <Chip
                texto="Comprador externo"
                color="#BFD8F5"
                fondo="rgba(255,255,255,0.14)"
                icono="airplane"
              />
            )}
            {esOperador && (
              <Chip texto="Equipo" color="#FDE68A" fondo="rgba(255,255,255,0.14)" icono="key" />
            )}
          </View>
        </View>
        <View style={{ height: E.xxl + E.lg }} />
      </View>

      <View style={{ paddingHorizontal: E.lg, marginTop: -E.xxl }}>
        {/* ------------------------------------------------ reputación */}
        <Entrada>
          <Tarjeta style={{ padding: E.lg }}>
            <View style={s.repCabecera}>
              <View>
                <Text style={s.repEtiqueta}>Mi reputación</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: E.sm }}>
                  <Text style={s.repNota}>
                    {rep?.calificacion != null ? Number(rep.calificacion).toFixed(1) : '—'}
                  </Text>
                  <Estrellas valor={Number(rep?.calificacion ?? 0)} tamano={17} />
                </View>
                <Text style={s.repDetalle}>
                  {rep?.total_calificaciones
                    ? `${rep.total_calificaciones} calificación${rep.total_calificaciones === 1 ? '' : 'es'}`
                    : 'Aún sin calificaciones'}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/reputacion/${perfil.id}`)}
                style={s.verPublico}>
                <Text style={s.verPublicoTexto}>Ver pública</Text>
                <Ionicons name="open-outline" size={14} color={C.azulMedio} />
              </Pressable>
            </View>
            <View style={{ height: E.md }} />
            <FilaCifras>
              <Cifra
                icono="checkmark-done"
                valor={String(rep?.pedidos_cumplidos ?? 0)}
                etiqueta="Cumplidos"
                color={C.verde}
              />
              <Cifra
                icono="pie-chart"
                valor={rep?.tasa_cumplimiento != null ? `${rep.tasa_cumplimiento}%` : '—'}
                etiqueta="Cumplimiento"
                color={C.azulMedio}
              />
              <Cifra
                icono="timer"
                valor={rep?.puntualidad != null ? `${rep.puntualidad}%` : '—'}
                etiqueta="Puntualidad"
                color={C.naranja}
              />
            </FilaCifras>
            <Text style={s.repPie}>
              Estos números son públicos: son los que mira un cliente al elegir entre varias
              ofertas.
            </Text>
          </Tarjeta>
        </Entrada>

        {/* ------------------------------------------------ verificación */}
        {!verificado && (
          <Entrada i={1}>
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
        )}

        {/* ------------------------------------------------ comprador */}
        <Seccion titulo="Ganar dinero con mis viajes" icono="airplane-outline" style={{ marginTop: E.lg }} />
        <Tarjeta style={{ padding: 0 }}>
          <Opcion
            icono="briefcase"
            color={C.naranja}
            titulo="Soy comprador externo"
            detalle="Recibe pedidos para ofertar cuando viajas o traes productos del extranjero."
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

        {/* ------------------------------------------------ referidos */}
        <Seccion titulo="Invita a un amigo" icono="gift-outline" style={{ marginTop: E.lg }} />
        <TarjetaDegradada colores={G.accion}>
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
            <Ionicons name="share-social" size={18} color={C.naranja} />
            <Text style={s.compartirTexto}>Compartir mi código</Text>
          </Pressable>
        </TarjetaDegradada>

        {/* ------------------------------------------------ datos */}
        <Seccion titulo="Mi cuenta" icono="person-outline" style={{ marginTop: E.lg }} />
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
          <View style={s.linea} />
          <Opcion icono="calendar" titulo="En Encárgalo desde" detalle={fecha(perfil.creado_en)} />
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
            Guardamos solo el número de tu DNI. Las fotos del documento se eliminan una vez
            validada tu identidad (Ley N° 29733).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  cabecera: {
    overflow: 'hidden',
    borderBottomLeftRadius: R.xl + 4,
    borderBottomRightRadius: R.xl + 4,
  },
  burbuja: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  avatarAro: {
    padding: 4,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  nombre: {
    color: C.blanco,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: E.md,
    textAlign: 'center',
    paddingHorizontal: E.lg,
  },
  correo: { color: 'rgba(255,255,255,0.72)', fontSize: 14, marginTop: 2 },

  repCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  repEtiqueta: { fontSize: 13, fontWeight: '700', color: C.textoSuave },
  repNota: { fontSize: 34, fontWeight: '800', color: C.azul, letterSpacing: -1 },
  repDetalle: { fontSize: 12.5, color: C.textoSuave },
  repPie: { fontSize: 12.5, color: C.textoSuave, marginTop: E.md, lineHeight: 18 },
  verPublico: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.azulClaro,
    paddingHorizontal: E.sm + 2,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verPublicoTexto: { fontSize: 12.5, fontWeight: '800', color: C.azulMedio },

  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    padding: E.lg,
    borderRadius: R.lg,
  },
  opcionIcono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionTitulo: { fontSize: 15, fontWeight: '700', color: C.texto },
  opcionDetalle: { fontSize: 13, color: C.textoSuave, marginTop: 2, lineHeight: 18 },
  linea: { height: 1, backgroundColor: C.borde, marginLeft: 70 },

  refTexto: { color: C.blanco, fontSize: 14.5, lineHeight: 21, fontWeight: '600' },
  codigoCaja: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed',
    paddingVertical: E.md,
    marginVertical: E.lg,
  },
  codigo: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 6,
    color: C.blanco,
    textAlign: 'center',
  },
  compartir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: E.sm,
    backgroundColor: C.blanco,
    borderRadius: R.md,
    height: 48,
  },
  compartirTexto: { color: C.naranja, fontWeight: '800', fontSize: 15.5 },

  ley: { flexDirection: 'row', gap: E.sm, paddingHorizontal: E.sm, marginTop: E.sm },
  leyTexto: { flex: 1, fontSize: 12.5, color: C.textoSuave, lineHeight: 18 },
});
