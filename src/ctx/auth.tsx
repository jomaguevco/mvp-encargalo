import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
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
  /**
   * Recuperación de contraseña. `recuperacion` es verdadero mientras la sesión
   * abierta viene de un enlace o un código de recuperación: la pantalla
   * /recuperar-clave pide la contraseña nueva antes de dejar pasar a la app.
   */
  recuperacion: boolean;
  /** El enlace del correo llegó vencido o ya usado. */
  errorRecuperacion: string | null;
  pedirRecuperacion: (correo: string) => Promise<void>;
  verificarCodigoRecuperacion: (correo: string, codigo: string) => Promise<void>;
  cambiarClave: (clave: string) => Promise<void>;
  terminarRecuperacion: () => void;
};

/**
 * Página web a la que lleva el enlace del correo de recuperación. Es siempre la
 * web, también desde Android: el correo se abre en el navegador y ahí se cambia
 * la contraseña; luego se ingresa en la app con la nueva. Debe estar en
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 */
const WEB_APP = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://encargalo.vercel.app').replace(/\/$/, '');

function urlRecuperacion() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // En producción la app vive bajo /app (experiments.baseUrl); en desarrollo, en la raíz.
    const base = /^\/app(\/|$)/.test(window.location.pathname) ? '/app' : '';
    return `${window.location.origin}${base}/recuperar-clave`;
  }
  return `${WEB_APP}/app/recuperar-clave`;
}

/**
 * Lee lo que Supabase deja en el fragmento (#) de la URL al volver del correo:
 * los tokens de la sesión de recuperación o el error si el enlace venció. Como
 * el cliente tiene detectSessionInUrl en falso, se hace aquí y a mano.
 */
function leerFragmentoRecuperacion():
  | { tipo: 'tokens'; access_token: string; refresh_token: string }
  | { tipo: 'error'; mensaje: string }
  | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const p = new URLSearchParams(hash);
  const limpiar = () =>
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (p.get('error_code') || p.get('error')) {
    limpiar();
    return {
      tipo: 'error',
      mensaje:
        p.get('error_code') === 'otp_expired'
          ? 'El enlace venció o ya se usó. Pide uno nuevo.'
          : 'No pudimos abrir el enlace. Pide uno nuevo.',
    };
  }
  const access_token = p.get('access_token');
  const refresh_token = p.get('refresh_token');
  if (p.get('type') !== 'recovery' || !access_token || !refresh_token) return null;
  limpiar();
  return { tipo: 'tokens', access_token, refresh_token };
}

/** Los mensajes de Supabase Auth que el usuario puede llegar a ver, en español. */
function traducirErrorAuth(mensaje: string) {
  if (/only request this after|rate limit|too many/i.test(mensaje)) {
    return 'Ya enviamos un correo hace poco. Espera un minuto y vuelve a intentarlo.';
  }
  if (/expired|invalid/i.test(mensaje) && /token|otp/i.test(mensaje)) {
    return 'El código no es válido o ya venció. Pide uno nuevo.';
  }
  if (/different from the old|same password/i.test(mensaje)) {
    return 'La contraseña nueva debe ser distinta de la anterior.';
  }
  if (/weak|at least/i.test(mensaje)) {
    return 'La contraseña es muy débil: usa al menos 8 caracteres con letras y números.';
  }
  return mensaje;
}

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
  const [recuperacion, setRecuperacion] = useState(false);
  const [errorRecuperacion, setErrorRecuperacion] = useState<string | null>(null);

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

    (async () => {
      // Primero el enlace de recuperación, si se llegó desde el correo: abre la
      // sesión con esos tokens antes de mirar si había otra guardada.
      const fragmento = leerFragmentoRecuperacion();
      if (fragmento?.tipo === 'error') {
        setErrorRecuperacion(fragmento.mensaje);
      } else if (fragmento?.tipo === 'tokens') {
        const { error } = await supabase.auth.setSession({
          access_token: fragmento.access_token,
          refresh_token: fragmento.refresh_token,
        });
        if (error) setErrorRecuperacion('El enlace venció o ya se usó. Pide uno nuevo.');
        else setRecuperacion(true);
      }
      return supabase.auth.getSession();
    })().then(async ({ data }) => {
      if (!vivo) return;
      setSesion(data.session);
      if (data.session) await refrescarPerfil();
      if (vivo) setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (evento, s) => {
      if (!vivo) return;
      if (evento === 'PASSWORD_RECOVERY') setRecuperacion(true);
      setSesion(s);
      if (s) {
        await refrescarPerfil();
      } else {
        setPerfil(null);
        setEsOperador(false);
        setEsAdmin(false);
        setAvisosPendientes(0);
        setRecuperacion(false);
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

  const pedirRecuperacion = useCallback(async (correo: string) => {
    setErrorRecuperacion(null);
    const limpio = correo.trim().toLowerCase();
    const email = limpio === 'admin' && CORREO_ADMIN ? CORREO_ADMIN : limpio;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: urlRecuperacion(),
    });
    // Si el correo no existe, Supabase no lo dice, y está bien: así nadie puede
    // averiguar quién tiene cuenta. Solo se muestran los errores reales.
    if (error) throw new Error(traducirErrorAuth(error.message));
  }, []);

  const verificarCodigoRecuperacion = useCallback(async (correo: string, codigo: string) => {
    const limpio = correo.trim().toLowerCase();
    const email = limpio === 'admin' && CORREO_ADMIN ? CORREO_ADMIN : limpio;
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codigo.replace(/\s/g, ''),
      type: 'recovery',
    });
    if (error) throw new Error(traducirErrorAuth(error.message));
    setRecuperacion(true);
  }, []);

  const cambiarClave = useCallback(async (clave: string) => {
    const { error } = await supabase.auth.updateUser({ password: clave });
    if (error) throw new Error(traducirErrorAuth(error.message));
  }, []);

  const terminarRecuperacion = useCallback(() => {
    setRecuperacion(false);
    setErrorRecuperacion(null);
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
      recuperacion,
      errorRecuperacion,
      pedirRecuperacion,
      verificarCodigoRecuperacion,
      cambiarClave,
      terminarRecuperacion,
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
      recuperacion,
      errorRecuperacion,
      pedirRecuperacion,
      verificarCodigoRecuperacion,
      cambiarClave,
      terminarRecuperacion,
    ],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
