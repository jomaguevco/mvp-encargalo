import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Share, Switch, Text, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import { actualizarPerfil, reputacionDe } from '@/lib/api';
import { codigoReferidoDe, ESTADO_VERIFICACION, fecha } from '@/lib/negocio';
import type { Reputacion } from '@/lib/tipos';
import {
  Aviso,
  Boton,
  Chip,
  Dato,
  Micro,
  Parrafo,
  Separador,
  Subtitulo,
  Tarjeta,
  Titulo,
} from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { C, E } from '@/ui/tema';

export default function Perfil() {
  const { perfil, sesion, salir, refrescarPerfil } = useAuth();
  const [rep, setRep] = useState<Reputacion | null>(null);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refrescarPerfil();
      if (perfil?.id) reputacionDe(perfil.id).then(setRep);
    }, [perfil?.id, refrescarPerfil]),
  );

  if (!perfil) return null;
  const v = ESTADO_VERIFICACION[perfil.verificacion];

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
    <ScrollView contentContainerStyle={{ padding: E.lg, paddingBottom: E.xxl }}>
      <Titulo>{perfil.nombre_completo || 'Sin nombre'}</Titulo>
      <Micro style={{ marginBottom: E.md }}>{sesion?.user.email}</Micro>
      <Chip texto={v.etiqueta} color={v.color} />

      {perfil.verificacion !== 'verificado' && (
        <View style={{ marginTop: E.lg }}>
          <Aviso
            tono={perfil.verificacion === 'rechazado' ? 'error' : 'alerta'}
            titulo={v.etiqueta}>
            {v.detalle}
            {perfil.verificacion === 'rechazado' && perfil.motivo_rechazo
              ? `\n\nMotivo: ${perfil.motivo_rechazo}`
              : ''}
          </Aviso>
          {perfil.verificacion !== 'en_revision' && (
            <Boton
              titulo="Verificar mi identidad"
              onPress={() => router.push('/verificacion')}
            />
          )}
        </View>
      )}

      <View style={{ height: E.xl }} />

      <Subtitulo>Mi reputación</Subtitulo>
      <Parrafo suave style={{ marginBottom: E.md }}>
        Estos números son públicos: son los que mira un cliente al elegir entre varias
        ofertas.
      </Parrafo>
      <Tarjeta>
        <Dato etiqueta="Pedidos cumplidos" valor={String(rep?.pedidos_cumplidos ?? 0)} />
        <Dato
          etiqueta="Tasa de cumplimiento"
          valor={rep?.tasa_cumplimiento != null ? `${rep.tasa_cumplimiento} %` : '—'}
        />
        <Dato
          etiqueta="Puntualidad"
          valor={rep?.puntualidad != null ? `${rep.puntualidad} %` : '—'}
        />
        <Dato
          etiqueta="Calificación"
          valor={
            rep?.calificacion != null
              ? `${rep.calificacion} / 5  (${rep.total_calificaciones})`
              : 'Sin calificaciones'
          }
        />
        <Separador />
        <Dato etiqueta="En Encárgalo desde" valor={fecha(perfil.creado_en)} />
      </Tarjeta>

      <View style={{ height: E.lg }} />

      <Subtitulo>Ganar dinero con mis viajes</Subtitulo>
      <Tarjeta>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: E.md,
          }}>
          <View style={{ flex: 1 }}>
            <Parrafo style={{ fontWeight: '700' }}>Soy comprador externo</Parrafo>
            <Parrafo suave>
              Actívalo si viajas o traes productos del extranjero y quieres recibir
              pedidos para ofertar.
            </Parrafo>
          </View>
          <Switch
            value={perfil.es_comprador}
            onValueChange={alternarComprador}
            disabled={guardando}
            trackColor={{ true: C.naranja, false: C.borde }}
          />
        </View>
      </Tarjeta>

      <View style={{ height: E.lg }} />

      <Subtitulo>Invita a un amigo</Subtitulo>
      <Tarjeta>
        <Parrafo suave>
          Comparte tu código. Cuando tu amigo complete su primer pedido, los dos reciben
          un descuento.
        </Parrafo>
        <Text
          selectable
          style={{
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: 4,
            color: C.azul,
            textAlign: 'center',
            marginVertical: E.md,
          }}>
          {codigoReferidoDe(perfil.id)}
        </Text>
        <Boton
          titulo="Compartir mi código"
          variante="secundario"
          onPress={() =>
            Share.share({
              message:
                'Pide lo que quieras del extranjero sin miedo a que te estafen. ' +
                'Regístrate en Encárgalo con mi código ' +
                codigoReferidoDe(perfil.id) +
                ' y los dos tenemos un descuento en el primer pedido.',
            })
          }
        />
      </Tarjeta>

      <View style={{ height: E.lg }} />

      <Subtitulo>Mis datos</Subtitulo>
      <Tarjeta>
        <Dato etiqueta="Celular" valor={perfil.telefono ?? '—'} />
        <Dato etiqueta="Ciudad" valor={perfil.ciudad} />
        <Dato
          etiqueta="DNI"
          valor={perfil.dni ? `••••${perfil.dni.slice(-4)}` : 'Sin registrar'}
        />
      </Tarjeta>

      <Aviso tono="info" titulo="Qué hacemos con tu DNI">
        Guardamos solo el número, cifrado en la base de datos. Las fotos del documento se
        eliminan una vez validada tu identidad, tal como exige la Ley N° 29733 de
        Protección de Datos Personales.
      </Aviso>

      <View style={{ height: E.md }} />
      <Boton
        titulo="Cerrar sesión"
        variante="fantasma"
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
    </ScrollView>
  );
}
