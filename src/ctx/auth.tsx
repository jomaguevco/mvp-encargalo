import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { miPerfil, soyOperador } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/lib/tipos';

type Ctx = {
  sesion: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  verificado: boolean;
  esOperador: boolean;
  refrescarPerfil: () => Promise<void>;
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
  const [cargando, setCargando] = useState(true);

  const refrescarPerfil = useCallback(async () => {
    try {
      setPerfil(await miPerfil());
      setEsOperador(await soyOperador());
    } catch {
      setPerfil(null);
      setEsOperador(false);
    }
  }, []);

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
    await supabase.auth.signOut();
  }, []);

  const valor = useMemo<Ctx>(
    () => ({
      sesion,
      perfil,
      cargando,
      verificado: perfil?.verificacion === 'verificado',
      esOperador,
      refrescarPerfil,
      entrar,
      registrar,
      salir,
    }),
    [sesion, perfil, cargando, esOperador, refrescarPerfil, entrar, registrar, salir],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
