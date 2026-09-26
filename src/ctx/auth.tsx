import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { avisosNoLeidos, miPerfil, soyOperador } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/lib/tipos';

type Ctx = {
  sesion: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  verificado: boolean;
  esOperador: boolean;
  /** Avisos sin leer. Alimenta el globo de la pestaña. */
  avisosPendientes: number;
  refrescarPerfil: () => Promise<void>;
  refrescarAvisos: () => Promise<void>;
  entrar: (correo: string, clave: string) => Promise<void>;
  registrar: (datos: {
    correo: string;
    clave: string;
    nombre: string;
    telefono: string;
  }) => Promise<void>;
  salir: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [esOperador, setEsOperador] = useState(false);
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
      setEsOperador(await soyOperador());
      await refrescarAvisos();
    } catch {
      setPerfil(null);
      setEsOperador(false);
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
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
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
    async (d: { correo: string; clave: string; nombre: string; telefono: string }) => {
      const { error } = await supabase.auth.signUp({
        email: d.correo.trim().toLowerCase(),
        password: d.clave,
        options: {
          data: { nombre_completo: d.nombre.trim(), telefono: d.telefono.trim() },
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
