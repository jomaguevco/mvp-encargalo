import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import * as api from '@/lib/api';
import { fecha, fechaHora, hace, soles } from '@/lib/negocio';
import type { CuentaParecida, FichaCuenta } from '@/lib/tipos';
import {
  ACCION_BITACORA,
  Bloque,
  BotonAdmin,
  ChipIa,
  ChipPago,
  ChipPedido,
  ChipReniec,
  ChipVerificacion,
  FilaDato,
  GrillaKpi,
  Kpi,
  PaginaAdmin,
  pedirTexto,
  Tabla,
} from '@/ui/admin';
import { Aviso, Avatar, Cargando, Chip, Estrellas } from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { useEscritorio } from '@/ui/escritorio';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

export default function FichaCuentaAdmin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil: yo } = useAuth();
  const [ficha, setFicha] = useState<FichaCuenta | null>(null);
  const [parecidas, setParecidas] = useState<CuentaParecida[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const { es: escritorio } = useEscritorio();

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [f, p] = await Promise.all([
        api.fichaCuenta(id),
        api.cuentasParecidas(id).catch(() => [] as CuentaParecida[]),
      ]);
      setFicha(f);
      setParecidas(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function hacer(fn: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await fn();
      await cargar();
    } catch (e) {
      avisar('No se pudo completar', (e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (error && !ficha) {
    return (
      <PaginaAdmin titulo="Cuenta">
        <Aviso tono="error" titulo="No se pudo abrir la ficha">{error}</Aviso>
        <BotonAdmin titulo="Volver a cuentas" icono="arrow-back" onPress={() => router.replace('/admin/cuentas')} />
      </PaginaAdmin>
    );
  }
  if (!ficha) return <Cargando texto="Abriendo la ficha…" />;

  const p = ficha.perfil;
  const r = ficha.reputacion;
  const soyYo = yo?.id === p.id;

  const acciones = (
    <>
      <BotonAdmin titulo="Volver" icono="arrow-back" onPress={() => router.back()} />
      {p.verificacion === 'en_revision' && (
        <BotonAdmin
          titulo="Revisar verificación"
          icono="id-card-outline"
          variante="primario"
          onPress={() => router.push('/admin/verificaciones')}
        />
      )}
      {!soyYo &&
        (p.suspendido ? (
          <BotonAdmin
            titulo="Reactivar cuenta"
            icono="checkmark-circle-outline"
            variante="exito"
            deshabilitado={ocupado}
            onPress={async () => {
              if (await confirmar('Reactivar cuenta', `${p.nombre_completo} podrá volver a publicar, ofertar y escribir en el chat.`, 'Reactivar')) {
                hacer(() => api.suspenderCuenta(p.id, false));
              }
            }}
          />
        ) : (
          <BotonAdmin
            titulo="Suspender cuenta"
            icono="ban-outline"
            variante="peligro"
            deshabilitado={ocupado}
            onPress={() => {
              const motivo = pedirTexto(
                `Suspender a ${p.nombre_completo}`,
                'Escribe el motivo. No podrá publicar, ofertar ni escribir en el chat; sí podrá abrir una disputa si tiene dinero retenido.',
              );
              if (motivo) hacer(() => api.suspenderCuenta(p.id, true, motivo));
            }}
          />
        ))}
      {!p.es_admin && (
        <BotonAdmin
          titulo={p.es_operador ? 'Quitar operador' : 'Hacer operador'}
          icono="shield-half-outline"
          deshabilitado={ocupado}
          onPress={async () => {
            const ok = await confirmar(
              p.es_operador ? 'Quitar rol de operador' : 'Dar rol de operador',
              p.es_operador
                ? `${p.nombre_completo} dejará de ver la consola del equipo.`
                : `${p.nombre_completo} podrá aprobar verificaciones, confirmar pagos y resolver disputas.`,
              'Confirmar',
            );
            if (ok) hacer(() => api.asignarRol(p.id, 'operador', !p.es_operador));
          }}
        />
      )}
      {!soyYo && (
        <BotonAdmin
          titulo={p.es_admin ? 'Quitar administrador' : 'Hacer administrador'}
          icono="key-outline"
          deshabilitado={ocupado}
          onPress={async () => {
            const ok = await confirmar(
              p.es_admin ? 'Quitar rol de administrador' : 'Dar rol de administrador',
              p.es_admin
                ? `${p.nombre_completo} seguirá siendo operador, pero perderá el panel de administración.`
                : `${p.nombre_completo} tendrá acceso total: reportes, cuentas, roles y configuración.`,
              'Confirmar',
              !p.es_admin,
            );
            if (ok) hacer(() => api.asignarRol(p.id, 'admin', !p.es_admin));
          }}
        />
      )}
    </>
  );

  return (
    <PaginaAdmin titulo={p.nombre_completo || 'Cuenta sin nombre'} subtitulo={p.correo ?? undefined} acciones={acciones}>
      {p.suspendido && (
        <Aviso tono="error" titulo={`Cuenta suspendida ${p.suspendido_en ? hace(p.suspendido_en) : ''}`}>
          {p.suspendido_motivo || 'Sin motivo registrado'}
        </Aviso>
      )}

      {/* En qué punto está la verificación y qué puede hacer el equipo. */}
      {p.verificacion === 'pendiente' && (
        <Aviso tono="info" titulo="Todavía no envió sus documentos">
          Por eso no aparece en la cola de verificaciones: no hay DNI ni selfie que aprobar o rechazar.
          La persona debe entrar a la app y tocar «Verificar identidad».
        </Aviso>
      )}
      {p.verificacion === 'en_revision' && (
        <Aviso tono="alerta" titulo="Esperando la decisión del equipo">
          La biometría no pudo decidir sola. Revísala en Verificaciones, donde están el DNI y la selfie.
        </Aviso>
      )}
      {p.verificacion === 'rechazado' && (
        <Aviso tono="error" titulo="Verificación rechazada: puede volver a intentarlo">
          {`Motivo que ve la persona: «${p.motivo_rechazo ?? 'sin motivo'}». Desde la app, en esta misma cuenta, puede enviar sus documentos otra vez; su DNI no queda reservado por el rechazo.`}
        </Aviso>
      )}

      <View style={[s.cabecera, !escritorio && { flexDirection: 'column', alignItems: 'flex-start' }]}>
        <Avatar nombre={p.nombre_completo} tamano={64} verificado={p.verificacion === 'verificado'} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={s.chips}>
            <ChipVerificacion estado={p.verificacion} />
            <ChipIa resultado={p.ia_resultado} />
            <ChipReniec r={p.dni_validacion} />
            {p.es_admin && <Chip texto="Administrador" color={C.azul} icono="shield-checkmark" />}
            {!p.es_admin && p.es_operador && <Chip texto="Operador" color={C.azulMedio} icono="shield-half" />}
            {p.es_comprador && <Chip texto="Comprador externo" color={C.naranja} icono="airplane" />}
          </View>
          <Text style={s.meta}>
            Registrada el {fecha(p.creado_en)} · {p.ultimo_ingreso ? `último ingreso ${hace(p.ultimo_ingreso)}` : 'nunca entró'}
          </Text>
        </View>
      </View>

      <GrillaKpi>
        <Kpi icono="cart" etiqueta="Pagó como cliente" valor={soles(ficha.dinero.pagado_como_cliente)} />
        <Kpi icono="airplane" etiqueta="Cobró como comprador" valor={soles(ficha.dinero.cobrado_como_comprador)} color={C.verde} />
        <Kpi icono="lock-closed" etiqueta="Retenido ahora" valor={soles(ficha.dinero.retenido_ahora)} color={C.verdeOscuro} />
        <Kpi icono="return-down-back" etiqueta="Reembolsado" valor={soles(ficha.dinero.reembolsado)} color={C.rojo} />
      </GrillaKpi>

      <View style={{ flexDirection: escritorio ? 'row' : 'column', gap: E.lg, alignItems: 'flex-start' }}>
        <Bloque titulo="Datos de la cuenta" icono="person-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          <FilaDato etiqueta="DNI" valor={p.dni ?? '—'} />
          <FilaDato etiqueta="Celular" valor={p.telefono ?? '—'} />
          <FilaDato etiqueta="Ciudad" valor={p.ciudad} />
          <FilaDato etiqueta="Correo confirmado" valor={p.correo_confirmado ? 'Sí' : 'No'} />
          <FilaDato etiqueta="Cómo nos conoció" valor={p.origen ?? '—'} />
          <FilaDato etiqueta="Código de referido usado" valor={p.codigo_referido ?? '—'} />
          <FilaDato etiqueta="Aceptó los términos" valor={fechaHora(p.terminos_aceptados_en)} />
          <FilaDato etiqueta="Verificada el" valor={fechaHora(p.verificado_en)} />
          {!!p.motivo_rechazo && <FilaDato etiqueta="Motivo del último rechazo" valor={p.motivo_rechazo} />}
        </Bloque>

        <Bloque titulo="Reputación pública" icono="star-outline" style={{ flex: 1, alignSelf: 'stretch' }}>
          {r?.calificacion != null && <Estrellas valor={Number(r.calificacion)} />}
          <FilaDato etiqueta="Calificación" valor={r?.calificacion != null ? `${Number(r.calificacion).toFixed(2)} (${r.total_calificaciones})` : 'Sin calificaciones'} />
          <FilaDato etiqueta="Pedidos cumplidos como comprador" valor={String(r?.pedidos_cumplidos ?? 0)} />
          <FilaDato etiqueta="Tasa de cumplimiento" valor={r?.tasa_cumplimiento != null ? `${r.tasa_cumplimiento} %` : '—'} />
          <FilaDato etiqueta="Puntualidad" valor={r?.puntualidad != null ? `${r.puntualidad} %` : '—'} />
          <FilaDato etiqueta="Similitud facial al verificarse" valor={p.ia_similitud != null ? `${Number(p.ia_similitud).toFixed(1)} %` : '—'} />
        </Bloque>
      </View>

      {parecidas.length > 0 && (
        <Bloque titulo={`Cuentas parecidas (${parecidas.length})`} icono="copy-outline">
          <Text style={s.meta}>
            Mismo DNI o mismo nombre: casi siempre es alguien que se volvió a registrar. Conviene que use
            una sola cuenta.
          </Text>
          <Tabla
            columnas={[
              { clave: 'nombre_completo', titulo: 'Cuenta', ancho: 2 },
              { clave: 'correo', titulo: 'Correo', ancho: 2, render: (x) => x.correo ?? '—' },
              { clave: 'verificacion', titulo: 'Identidad', ancho: 1.3, render: (x) => <ChipVerificacion estado={x.verificacion} /> },
              { clave: 'motivo', titulo: 'Coincide en', ancho: 1.1 },
              { clave: 'fecha', titulo: 'Registro', render: (x) => fecha(x.creado_en) },
            ]}
            filas={parecidas}
            clave={(x) => x.perfil_id}
            onFila={(x) => router.push(`/admin/cuenta/${x.perfil_id}`)}
          />
        </Bloque>
      )}

      <Bloque titulo={`Pedidos como cliente (${ficha.pedidos.length})`} icono="cube-outline">
        <Tabla
          columnas={[
            { clave: 'titulo', titulo: 'Pedido', ancho: 3 },
            { clave: 'estado', titulo: 'Estado', ancho: 1.3, render: (x) => <ChipPedido estado={x.estado} /> },
            { clave: 'pago', titulo: 'Pago', ancho: 1.3, render: (x) => <ChipPago estado={x.pago_estado} /> },
            { clave: 'total', titulo: 'Total', alinear: 'derecha', render: (x) => soles(x.total_cobrado ?? x.valor_referencial) },
            { clave: 'fecha', titulo: 'Fecha', render: (x) => fecha(x.creado_en) },
          ]}
          filas={ficha.pedidos}
          clave={(x) => x.id}
          onFila={(x) => router.push(`/pedido/${x.id}`)}
          vacio="No publicó pedidos"
        />
      </Bloque>

      <Bloque titulo={`Ofertas como comprador externo (${ficha.entregas.length})`} icono="airplane-outline">
        <Tabla
          columnas={[
            { clave: 'titulo', titulo: 'Pedido', ancho: 3 },
            { clave: 'estado', titulo: 'Estado del pedido', ancho: 1.4, render: (x) => <ChipPedido estado={x.estado} /> },
            { clave: 'oferta', titulo: 'Oferta', render: (x) => x.oferta_estado },
            { clave: 'precio', titulo: 'Precio', alinear: 'derecha', render: (x) => soles(x.precio_final) },
            { clave: 'fecha', titulo: 'Fecha', render: (x) => fecha(x.creado_en) },
          ]}
          filas={ficha.entregas}
          clave={(x) => `${x.id}-${x.creado_en}`}
          onFila={(x) => router.push(`/pedido/${x.id}`)}
          vacio="No envió ofertas"
        />
      </Bloque>

      {ficha.disputas.length > 0 && (
        <Bloque titulo={`Disputas (${ficha.disputas.length})`} icono="flag-outline">
          <Tabla
            columnas={[
              { clave: 'titulo', titulo: 'Pedido', ancho: 2 },
              { clave: 'motivo', titulo: 'Motivo', ancho: 3 },
              { clave: 'estado', titulo: 'Estado', ancho: 1.3 },
              { clave: 'quien', titulo: 'La abrió', render: (x) => (x.la_abrio ? 'Esta cuenta' : 'La otra parte') },
              { clave: 'fecha', titulo: 'Fecha', render: (x) => fecha(x.creado_en) },
            ]}
            filas={ficha.disputas}
            clave={(x) => x.id}
            onFila={(x) => router.push(`/pedido/${x.pedido_id}`)}
          />
        </Bloque>
      )}

      {ficha.resenas.length > 0 && (
        <Bloque titulo={`Reseñas recibidas (${ficha.resenas.length})`} icono="chatbubble-ellipses-outline">
          <Tabla
            columnas={[
              { clave: 'puntaje', titulo: 'Nota', render: (x) => `${x.puntaje} ★` },
              { clave: 'comentario', titulo: 'Comentario', ancho: 4, render: (x) => x.comentario || '—' },
              { clave: 'autor', titulo: 'De', ancho: 1.5 },
              { clave: 'fecha', titulo: 'Fecha', render: (x) => fecha(x.creado_en) },
            ]}
            filas={ficha.resenas}
            clave={(x) => `${x.autor}-${x.creado_en}`}
          />
        </Bloque>
      )}

      <Bloque titulo="Historial administrativo" icono="document-text-outline">
        <Tabla
          columnas={[
            { clave: 'accion', titulo: 'Acción', ancho: 2.5, render: (x) => ACCION_BITACORA[x.accion] ?? x.accion },
            { clave: 'actor', titulo: 'Quién', ancho: 1.5, render: (x) => x.actor ?? 'Sistema' },
            {
              clave: 'detalle',
              titulo: 'Detalle',
              ancho: 3,
              render: (x) => {
                const d = x.detalle ?? {};
                const partes = [d.motivo, d.rol && `rol ${d.rol}`, d.ia_similitud != null && `similitud ${d.ia_similitud} %`]
                  .filter(Boolean)
                  .join(' · ');
                return partes || '—';
              },
            },
            { clave: 'fecha', titulo: 'Fecha', ancho: 1.5, render: (x) => fechaHora(x.creado_en) },
          ]}
          filas={ficha.bitacora}
          clave={(x) => `${x.accion}-${x.creado_en}`}
          vacio="Sin acciones del equipo sobre esta cuenta"
        />
      </Bloque>
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: E.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: E.xs },
  meta: { fontSize: 13.5, color: C.textoSuave },
});
