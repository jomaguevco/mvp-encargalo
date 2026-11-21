// Edge Function · consultar-dni
//
// Consulta un DNI en RENIEC (vía la API de Decolecta). Tiene dos modos, según
// quién llama:
//
//   Sin sesión (el registro): la app manda el DNI y el nombre que escribió la
//   persona, y la función solo responde si coinciden. NUNCA devuelve el nombre:
//   si lo hiciera, cualquiera podría recorrer números de DNI y juntar nombres de
//   personas (datos personales, Ley N° 29733).
//
//   Con sesión (la verificación): devuelve nombres y apellidos para que la
//   persona corrija el suyo. Tiene un límite diario por usuario.
//
// Qué devuelve y qué no:
//   - Como mucho, nombres y apellidos. Nada de dirección, fecha de nacimiento ni foto.
//   - No guarda el DNI ni la respuesta. En consultas_dni (0017) se anota solo
//     quién consultó y cuándo, para los límites.
//
// Límites (persistentes, en la base; no se reinician con cada arranque):
//   - Sin sesión: LIMITE_IP consultas por IP cada hora y LIMITE_ANONIMO_DIA en
//     total por día.
//   - Con sesión: LIMITE_USUARIO por usuario cada día y LIMITE_USUARIOS_DIA en
//     total por día.
//   El tope global protege el cupo de Decolecta aunque alguien falsee su IP.
//
// CORS: solo los orígenes de la web (ORIGENES_WEB, ampliable con el secreto
// CORS_ORIGENES separado por comas). La app nativa no usa CORS.
//
//   supabase secrets set DECOLECTA_TOKEN=...
//   supabase functions deploy consultar-dni --no-verify-jwt   (ver supabase/config.toml)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { coincideNombre, palabras } from '../validar-dni/nombres.ts';

const ORIGENES_WEB = [
  'https://encargalo.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
];

const LIMITE_IP = 10; // por hora
const LIMITE_ANONIMO_DIA = 150;
const LIMITE_USUARIO = 6; // por día
const LIMITE_USUARIOS_DIA = 300;
const CACHE_MS = 60 * 60 * 1000;

type Persona = {
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
};

// Caché por instancia: ahorra consultas del cupo, no reemplaza los límites.
const cache = new Map<string, { persona: Persona | null; hasta: number }>();

function origenesPermitidos(): string[] {
  const extra = (Deno.env.get('CORS_ORIGENES') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...ORIGENES_WEB, ...extra];
}

function cabeceras(req: Request): Record<string, string> {
  const origen = req.headers.get('Origin');
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
  if (origen && origenesPermitidos().includes(origen)) {
    base['Access-Control-Allow-Origin'] = origen;
  }
  return base;
}

async function consultarDecolecta(
  dni: string,
  token: string,
): Promise<{ persona: Persona | null } | { error: true }> {
  const enCache = cache.get(dni);
  if (enCache && enCache.hasta > Date.now()) return { persona: enCache.persona };

  const r = await fetch(
    `https://api.decolecta.com/v1/reniec/dni?numero=${encodeURIComponent(dni)}`,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    },
  );

  if (r.ok) {
    const d = await r.json();
    const persona: Persona = {
      nombres: d.first_name ?? '',
      apellido_paterno: d.first_last_name ?? '',
      apellido_materno: d.second_last_name ?? '',
    };
    const encontrada = persona.nombres || persona.apellido_paterno ? persona : null;
    cache.set(dni, { persona: encontrada, hasta: Date.now() + CACHE_MS });
    return { persona: encontrada };
  }
  if (r.status === 400 || r.status === 404) {
    cache.set(dni, { persona: null, hasta: Date.now() + CACHE_MS });
    return { persona: null };
  }
  // 401/403 (token), 402/429 (cupo), 5xx: no es culpa de la persona
  console.error(`consultar-dni: Decolecta respondió ${r.status}`);
  return { error: true };
}

Deno.serve(async (req) => {
  const h = cabeceras(req);
  const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: h });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  let dni = '';
  let nombre = '';
  try {
    const cuerpo = await req.json();
    dni = String(cuerpo?.dni ?? '').trim();
    nombre = String(cuerpo?.nombre ?? '').trim();
  } catch {
    /* cuerpo vacío o inválido: se rechaza abajo */
  }
  if (!/^[0-9]{8}$/.test(dni)) {
    return responder({ error: 'El DNI debe tener 8 dígitos' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // ¿Hay una sesión de verdad? La clave anónima también es un JWT, pero no es
  // de ningún usuario: getUser falla y se trata como sin sesión.
  let uid: string | null = null;
  const autorizacion = req.headers.get('Authorization') ?? '';
  if (autorizacion) {
    const usuario = createClient(url, anon, {
      global: { headers: { Authorization: autorizacion } },
    });
    const { data } = await usuario.auth.getUser();
    uid = data.user?.id ?? null;
  }

  // Sin sesión hace falta el nombre: solo se confirma, nunca se revela.
  if (!uid && palabras(nombre).length < 2) {
    return responder({ error: 'Escribe tu nombre y apellidos para validarlos con tu DNI' }, 400);
  }

  const admin = createClient(url, servicio);
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'desconocida';
  const { data: permitido, error: errorLimite } = await admin.rpc('registrar_consulta_dni', {
    p_clave: uid ? `usuario:${uid}` : `ip:${ip}`,
    p_modo: uid ? 'usuario' : 'anonimo',
    p_limite: uid ? LIMITE_USUARIO : LIMITE_IP,
    p_ventana: uid ? '1 day' : '1 hour',
    p_global_dia: uid ? LIMITE_USUARIOS_DIA : LIMITE_ANONIMO_DIA,
  });
  if (errorLimite) {
    // Sin la tabla de límites (0017 sin aplicar) no se consulta: mejor cerrado.
    console.error('consultar-dni: no se pudo revisar el límite', errorLimite.code);
    return responder({ error: 'La consulta a RENIEC no está disponible' }, 503);
  }
  if (!permitido) {
    return responder(
      { error: 'Se hicieron demasiadas consultas. Inténtalo más tarde o continúa sin ella' },
      429,
    );
  }

  const token = Deno.env.get('DECOLECTA_TOKEN');
  if (!token) {
    console.error('consultar-dni: falta el secreto DECOLECTA_TOKEN');
    return responder({ error: 'La consulta a RENIEC no está configurada' }, 503);
  }

  try {
    const r = await consultarDecolecta(dni, token);
    if ('error' in r) return responder({ error: 'RENIEC no respondió' }, 502);
    if (!r.persona) return responder({ encontrado: false });

    if (uid) return responder({ encontrado: true, ...r.persona });

    return responder({
      encontrado: true,
      coincide: coincideNombre(nombre, {
        nombres: r.persona.nombres,
        apellidoPaterno: r.persona.apellido_paterno,
        apellidoMaterno: r.persona.apellido_materno,
      }),
    });
  } catch (e) {
    console.error('consultar-dni: fallo al consultar Decolecta', (e as Error).name);
    return responder({ error: 'RENIEC no respondió' }, 502);
  }
});
