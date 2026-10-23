import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { avisosNoLeidos, miPerfil, soyAdmin, soyOperador } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/lib/tipos';

type Ctx = {
  sesion: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  verificado: boolean;
  esOperador: boolean;
  /** Administrador: entra al panel /admin. Siempre es también operador. */
  esAdmin: boolean;
  /** Avisos sin leer. Alimenta el globo de la pestaña. */
  avisosPendientes: number;
  refrescarPerfil: () => Promise<void>;
  refrescarAvisos: () => Promise<void>;
  entrar: (correo: string, clave: string) => Promise<void>;
  registrar: (datos: DatosRegistro) => Promise<void>;
  salir: () => Promise<void>;
};

/**
 * Lo que pide la pantalla de registro. El origen, el código de referido y la
 * aceptación de los términos viajan como metadatos del usuario de Supabase Auth
 * (auth.users.raw_user_meta_data): quedan registrados sin agregar columnas ni
 * tocar la base de datos, que está congelada hasta después de la presentación.
 * Se consultan con la consulta Q11 del instrumento de medición.
 */
export type DatosRegistro = {
  correo: string;
  clave: string;
  nombre: string;
  telefono: string;
  origen: string;
  codigoReferido?: string;
  versionTerminos: string;
  /** El DNI del registro. Un trigger lo copia al perfil al crear la cuenta (0015). */
  dni?: string;
  /** El nombre salió de RENIEC con ese DNI: la verificación no vuelve a consultar. */
  dniConsultado?: boolean;
};

/**
 * Correo de la cuenta administrativa. Vive en el .env (EXPO_PUBLIC_ADMIN_CORREO) y
 * no aquí porque el repositorio es público. Sin él, «admin» no es un atajo.
 */
const CORREO_ADMIN = process.env.EXPO_PUBLIC_ADMIN_CORREO ?? null;

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [esOperador, setEsOperador] = useState(false);
  const [esAdmin, setEsAdmin] = useState(false);
  const [avisosPendientes, setAvisosPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);

  const refrescarAvisos = useCallback(async () => {
    try {
      setAvisosPendientes(await avisosNoLeidos());
    } catch {
      setAvisosPendientes(0);
    }
  }, []);

  const refrescarPerfil = useCallback(async () => {
    try {
      setPerfil(await miPerfil());
      const [operador, admin] = await Promise.all([soyOperador(), soyAdmin()]);
      setEsOperador(operador || admin);
      setEsAdmin(admin);
      await refrescarAvisos();
    } catch {
      setPerfil(null);
      setEsOperador(false);
      setEsAdmin(false);
      setAvisosPendientes(0);
    }
  }, [refrescarAvisos]);

  useEffect(() => {
    let vivo = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSesion(data.session);
      if (data.session) await refrescarPerfil();
      if (vivo) setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, s) => {
      if (!vivo) return;
      setSesion(s);
      if (s) {
        await refrescarPerfil();
      } else {
        setPerfil(null);
        setEsOperador(false);
        setEsAdmin(false);
        setAvisosPendientes(0);
      }
      setCargando(false);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [refrescarPerfil]);

  const entrar = useCallback(async (correo: string, clave: string) => {
    // La cuenta administrativa entra con «admin» a secas.
    const limpio = correo.trim().toLowerCase();
    const email = limpio === 'admin' && CORREO_ADMIN ? CORREO_ADMIN : limpio;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: clave,
    });
    if (error) {
      throw new Error(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : error.message,
      );
    }
  }, []);

  const registrar = useCallback(
    async (d: DatosRegistro) => {
      const { error } = await supabase.auth.signUp({
        email: d.correo.trim().toLowerCase(),
        password: d.clave,
        options: {
          data: {
            nombre_completo: d.nombre.trim(),
            telefono: d.telefono.trim(),
            origen: d.origen,
            codigo_referido: d.codigoReferido?.trim().toUpperCase() || null,
            terminos_version: d.versionTerminos,
            terminos_aceptados_en: new Date().toISOString(),
            dni: d.dni ?? null,
            dni_consultado: !!d.dniConsultado,
          },
        },
      });
      if (error) {
        throw new Error(
          error.message.includes('already registered')
            ? 'Ya existe una cuenta con ese correo'
            : error.message,
        );
      }
    },
    [],
  );

  const salir = useCallback(async () => {
    // signOut() llama al servidor por defecto. Si la red falla o el token ya
    // venció, lanza excepción y el usuario se queda atrapado dentro de la app.
    // Pase lo que pase, la sesión local se limpia.
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* la sesión local se limpia igual más abajo */
      }
    } finally {
      setSesion(null);
      setPerfil(null);
      setEsOperador(false);
      setEsAdmin(false);
      setAvisosPendientes(0);
    }
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      sesion,
      perfil,
      cargando,
      verificado: perfil?.verificacion === 'verificado',
      esOperador,
      esAdmin,
      avisosPendientes,
      refrescarPerfil,
      refrescarAvisos,
      entrar,
      registrar,
      salir,
    }),
    [
      sesion,
      perfil,
      cargando,
      esOperador,
      esAdmin,
      avisosPendientes,
      refrescarPerfil,
      refrescarAvisos,
      entrar,
      registrar,
      salir,
    ],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
