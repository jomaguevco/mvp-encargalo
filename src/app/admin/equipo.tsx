import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/ctx/auth';
import * as api from '@/lib/api';
import { hace } from '@/lib/negocio';
import type { CuentaAdmin } from '@/lib/tipos';
import {
  Bloque,
  BotonAdmin,
  Buscador,
  ChipVerificacion,
  PaginaAdmin,
  Tabla,
  type Columna,
} from '@/ui/admin';
import { Aviso, Avatar, Cargando, Chip } from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { Text } from '@/ui/Texto';
import { C, E } from '@/ui/tema';

/**
 * Quién opera Encárgalo. Operador: atiende las colas. Administrador: además
 * ve reportes, gestiona cuentas, roles y configuración. La base impide
 * quedarse sin administradores y que uno se quite el rol a sí mismo.
 */
export default function EquipoAdmin() {
  const { perfil: yo } = useAuth();
  const [equipo, setEquipo] = useState<CuentaAdmin[] | null>(null);
  const [texto, setTexto] = useState('');
  const [candidatos, setCandidatos] = useState<CuentaAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setEquipo(await api.cuentasAdmin({ filtro: 'equipo', limite: 200 }));
    } catch (e) {
      setError((e as Error).message);
      setEquipo([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function buscar() {
    if (!texto.trim()) {
      setCandidatos(null);
      return;
    }
    try {
      const r = await api.cuentasAdmin({ busqueda: texto, limite: 20 });
      setCandidatos(r.filter((c) => !c.es_operador && !c.es_admin));
    } catch (e) {
      avisar('No se pudo buscar', (e as Error).message);
    }
  }

  async function cambiar(c: CuentaAdmin, rol: 'operador' | 'admin', activo: boolean) {
    const textos = {
      'operador-true': `${c.nombre_completo} podrá aprobar verificaciones, confirmar pagos y resolver disputas.`,
      'operador-false': `${c.nombre_completo} dejará de ver la consola del equipo.`,
      'admin-true': `${c.nombre_completo} tendrá acceso total al panel: reportes, cuentas, roles y configuración.`,
      'admin-false': `${c.nombre_completo} seguirá como operador, sin el panel de administración.`,
    } as const;
    const ok = await confirmar(
      activo ? `Dar rol de ${rol === 'admin' ? 'administrador' : 'operador'}` : 'Quitar rol',
      textos[`${rol}-${activo}`],
      'Confirmar',
      rol === 'admin' && activo,
    );
    if (!ok) return;
    setOcupado(`${c.perfil_id}-${rol}`);
    try {
      await api.asignarRol(c.perfil_id, rol, activo);
      await cargar();
      setCandidatos((xs) => xs?.filter((x) => x.perfil_id !== c.perfil_id) ?? null);
    } catch (e) {
      avisar('No se pudo cambiar el rol', (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const persona = (c: CuentaAdmin) => (
    <View style={s.persona}>
      <Avatar nombre={c.nombre_completo} tamano={34} verificado={c.verificacion === 'verificado'} />
      <View style={{ flex: 1 }}>
        <Text style={s.fuerte} numberOfLines={1}>
          {c.nombre_completo || 'Sin nombre'}
          {c.perfil_id === yo?.id ? ' (tú)' : ''}
        </Text>
        <Text style={s.suave} numberOfLines={1}>{c.correo ?? '—'}</Text>
      </View>
    </View>
  );

  const columnasEquipo: Columna<CuentaAdmin>[] = [
    { clave: 'persona', titulo: 'Persona', ancho: 2.5, render: persona },
    {
      clave: 'rol',
      titulo: 'Rol',
      ancho: 1.3,
      render: (c) =>
        c.es_admin ? (
          <Chip texto="Administrador" color={C.azul} icono="shield-checkmark" />
        ) : (
          <Chip texto="Operador" color={C.azulMedio} icono="shield-half" />
        ),
    },
    { clave: 'verificacion', titulo: 'Identidad', ancho: 1.2, render: (c) => <ChipVerificacion estado={c.verificacion} /> },
    { clave: 'ingreso', titulo: 'Último ingreso', ancho: 1.2, render: (c) => (c.ultimo_ingreso ? hace(c.ultimo_ingreso) : 'Nunca') },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: 2.4,
      render: (c) => (
        <View style={s.acciones}>
          {c.es_admin ? (
            c.perfil_id !== yo?.id && (
              <BotonAdmin
                titulo="Quitar admin"
                icono="key-outline"
                deshabilitado={ocupado === `${c.perfil_id}-admin`}
                onPress={() => cambiar(c, 'admin', false)}
              />
            )
          ) : (
            <>
              <BotonAdmin
                titulo="Hacer admin"
                icono="key-outline"
                deshabilitado={ocupado === `${c.perfil_id}-admin`}
                onPress={() => cambiar(c, 'admin', true)}
              />
              <BotonAdmin
                titulo="Quitar operador"
                icono="close"
                variante="peligro"
                deshabilitado={ocupado === `${c.perfil_id}-operador`}
                onPress={() => cambiar(c, 'operador', false)}
              />
            </>
          )}
        </View>
      ),
    },
  ];

  return (
    <PaginaAdmin
      titulo="Equipo y roles"
      subtitulo="Operador: atiende las colas. Administrador: además reportes, cuentas, roles y configuración.">
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      {equipo === null ? (
        <Cargando />
      ) : (
        <Tabla
          columnas={columnasEquipo}
          filas={equipo}
          clave={(c) => c.perfil_id}
          onFila={(c) => router.push(`/admin/cuenta/${c.perfil_id}`)}
          vacio="Todavía no hay nadie en el equipo"
        />
      )}

      <Bloque titulo="Agregar al equipo" icono="person-add-outline">
        <Text style={s.suave}>
          Busca la cuenta por nombre, correo o DNI. Para nombrar administrador a alguien, debe tener la
          identidad verificada o ser operador.
        </Text>
        <Buscador valor={texto} onCambiar={setTexto} onBuscar={buscar} placeholder="Nombre, correo o DNI (Enter)" />
        {candidatos && (
          <Tabla
            columnas={[
              { clave: 'persona', titulo: 'Persona', ancho: 2.5, render: persona },
              { clave: 'verificacion', titulo: 'Identidad', ancho: 1.2, render: (c) => <ChipVerificacion estado={c.verificacion} /> },
              {
                clave: 'acciones',
                titulo: 'Acciones',
                ancho: 2.4,
                render: (c) => (
                  <View style={s.acciones}>
                    <BotonAdmin
                      titulo="Hacer operador"
                      icono="shield-half-outline"
                      variante="primario"
                      deshabilitado={ocupado === `${c.perfil_id}-operador`}
                      onPress={() => cambiar(c, 'operador', true)}
                    />
                    <BotonAdmin
                      titulo="Hacer admin"
                      icono="key-outline"
                      deshabilitado={ocupado === `${c.perfil_id}-admin` || c.verificacion !== 'verificado'}
                      onPress={() => cambiar(c, 'admin', true)}
                    />
                  </View>
                ),
              },
            ]}
            filas={candidatos}
            clave={(c) => c.perfil_id}
            vacio="Ninguna cuenta fuera del equipo coincide"
          />
        )}
      </Bloque>
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  persona: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  fuerte: { fontSize: 14, fontWeight: '700', color: C.texto },
  suave: { fontSize: 13, color: C.grisTexto },
  acciones: { flexDirection: 'row', gap: E.xs, flexWrap: 'wrap' },
});
