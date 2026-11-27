import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import { fechaHora } from '@/lib/negocio';
import type { EliminacionAdmin, EstadoEliminacion } from '@/lib/tipos';
import {
  BotonAdmin,
  Fichas,
  PaginaAdmin,
  pedirTexto,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Cargando, Chip } from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { Text } from '@/ui/Texto';
import { C } from '@/ui/tema';

type Filtro = EstadoEliminacion | 'todas';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'en_espera', etiqueta: 'En espera' },
  { valor: 'completada', etiqueta: 'Completadas' },
  { valor: 'rechazada', etiqueta: 'Rechazadas' },
  { valor: 'todas', etiqueta: 'Todas' },
];

const CHIP: Record<EstadoEliminacion, { texto: string; color: string }> = {
  pendiente: { texto: 'Pendiente', color: C.ambar },
  en_espera: { texto: 'En espera', color: C.azulMedio },
  completada: { texto: 'Completada', color: C.verde },
  rechazada: { texto: 'Rechazada', color: C.rojo },
};

/**
 * Solicitudes de eliminación de cuenta (Google Play, Ley N° 29733). Llegan
 * desde el perfil de la app o desde la página pública /eliminar-cuenta.
 * Completar una anonimiza la cuenta en la base (0021_eliminacion_cuenta);
 * el usuario de Supabase Auth se borra a mano.
 */
export default function EliminacionesAdmin() {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [filas, setFilas] = useState<EliminacionAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(await api.eliminacionesAdmin(filtro === 'todas' ? null : filtro));
    } catch (e) {
      setError((e as Error).message);
      setFilas([]);
    }
  }, [filtro]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function resolver(f: EliminacionAdmin, estado: 'en_espera' | 'completada' | 'rechazada') {
    if (estado === 'completada') {
      const ok = await confirmar(
        `Eliminar la cuenta de ${f.cuenta_nombre ?? f.correo}`,
        'Se borran el nombre, el celular, el DNI y la foto, se cierran sus pedidos sin comprador y la ' +
          'cuenta queda suspendida. Lo ya operado se conserva sin su nombre.\n\n' +
          'Después borra el usuario en Supabase → Authentication → Users y escríbele a ' +
          `${f.correo} para confirmarlo.`,
        'Eliminar',
        true,
      );
      if (!ok) return;
    }
    const nota = pedirTexto(
      estado === 'completada'
        ? 'Nota de la eliminación'
        : estado === 'en_espera'
          ? 'Dejar en espera'
          : 'Rechazar la solicitud',
      estado === 'completada'
        ? 'Cómo se confirmó que la cuenta es del titular.'
        : estado === 'en_espera'
          ? 'Qué falta cerrar (pedido, pago o disputa).'
          : 'Por qué se rechaza (por ejemplo, el correo y el DNI no corresponden a una cuenta).',
    );
    if (nota == null) return;
    setOcupado(f.id);
    try {
      await api.resolverEliminacion(f.id, estado, nota);
      await cargar();
    } catch (e) {
      avisar('No se pudo guardar', (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const columnas: Columna<EliminacionAdmin>[] = [
    {
      clave: 'solicitante',
      titulo: 'Solicitud',
      ancho: 2.2,
      render: (f) => (
        <View>
          <Text style={s.fuerte} numberOfLines={1}>{f.correo}</Text>
          <Text style={s.suave} numberOfLines={1}>
            {f.origen === 'app' ? 'Desde la app' : 'Desde la web'} · DNI {f.dni ?? '—'} ·{' '}
            {fechaHora(f.creado_en)}
          </Text>
          {!!f.motivo && <Text style={s.suave} numberOfLines={2}>«{f.motivo}»</Text>}
        </View>
      ),
    },
    {
      clave: 'cuenta',
      titulo: 'Cuenta',
      ancho: 1.6,
      render: (f) =>
        f.cuenta_id ? (
          <Text style={s.enlace} onPress={() => router.push(`/admin/cuenta/${f.cuenta_id}` as never)}>
            {f.cuenta_nombre ?? 'Ver cuenta'}
          </Text>
        ) : (
          <Chip texto="Correo y DNI no coinciden" color={C.rojo} />
        ),
    },
    {
      clave: 'pendientes',
      titulo: 'En curso',
      ancho: 1.4,
      render: (f) => {
        const n = f.pedidos_en_curso + f.pagos_en_curso + f.disputas_abiertas;
        if (!f.cuenta_id) return '—';
        return n === 0 ? (
          <Chip texto="Nada en curso" color={C.verde} />
        ) : (
          <Text style={s.suave}>
            {f.pedidos_en_curso} pedidos · {f.pagos_en_curso} pagos · {f.disputas_abiertas} disputas
          </Text>
        );
      },
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      ancho: 1.6,
      render: (f) => (
        <View style={{ gap: 2 }}>
          <Chip texto={CHIP[f.estado].texto} color={CHIP[f.estado].color} />
          {!!f.nota && <Text style={s.suave} numberOfLines={2}>{f.nota}</Text>}
          {!!f.resuelta_en && (
            <Text style={s.suave}>{f.resuelta_por ?? 'Equipo'} · {fechaHora(f.resuelta_en)}</Text>
          )}
        </View>
      ),
    },
    {
      clave: 'acciones',
      titulo: '',
      ancho: 2.4,
      render: (f) =>
        f.estado === 'pendiente' || f.estado === 'en_espera' ? (
          <View style={s.acciones}>
            <BotonAdmin
              titulo="Eliminar"
              icono="trash-outline"
              variante="peligro"
              deshabilitado={ocupado === f.id || !f.cuenta_id}
              onPress={() => resolver(f, 'completada')}
            />
            {f.estado === 'pendiente' && (
              <BotonAdmin
                titulo="En espera"
                deshabilitado={ocupado === f.id}
                onPress={() => resolver(f, 'en_espera')}
              />
            )}
            <BotonAdmin
              titulo="Rechazar"
              deshabilitado={ocupado === f.id}
              onPress={() => resolver(f, 'rechazada')}
            />
          </View>
        ) : null,
    },
  ];

  return (
    <PaginaAdmin
      titulo="Eliminación de cuentas"
      subtitulo="Solicitudes de la app y de la web. Respóndelas en un máximo de 10 días hábiles."
      onRefrescar={cargar}>
      <Aviso tono="info" titulo="Antes de eliminar">
        Una solicitud web solo se vincula si el correo y el DNI son de la misma cuenta. Si hay pedidos,
        pagos o disputas en curso, déjala en espera hasta que se cierren. Al completarla, borra también
        el usuario en Supabase → Authentication → Users.
      </Aviso>
      <Fichas valor={filtro} opciones={FILTROS} onCambiar={setFiltro} />
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      {filas === null ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnas}
          filas={filas}
          clave={(f) => f.id}
          vacio="No hay solicitudes en esta lista"
        />
      )}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  fuerte: { fontSize: 14, fontWeight: '700', color: C.texto },
  suave: { fontSize: 12.5, color: C.grisTexto },
  enlace: { fontSize: 14, fontWeight: '700', color: C.azulMedio },
  acciones: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
