// Edge Function · consultar-dni
//
// Recibe un número de DNI y devuelve el nombre que figura en RENIEC (vía la API
// de Decolecta), para que la app lo complete sola en el registro y en la
// verificación. Así nadie escribe su nombre «a su manera» y la validación
// posterior (validar-dni) coincide a la primera.
//
// Qué devuelve y qué no:
//   - Solo nombres y apellidos. Nada de dirección, fecha de nacimiento ni foto.
//   - No guarda nada: ni el número consultado ni la respuesta (Ley N° 29733).
//
// Cómo se protege el cupo y se evita usarla como buscador de personas:
//   - Límite por IP: CONSULTAS_POR_VENTANA consultas cada VENTANA_MS.
//   - Caché en memoria del resultado por DNI, para no gastar consultas en
//     repeticiones (el plan gratuito de Decolecta es de 100 al mes).
//
// La llama la app con la clave anónima (en el registro todavía no hay sesión),
// por eso se despliega con verificación de JWT activada: la clave anónima es un
// JWT válido y deja fuera a quien no tenga la app.
//
//   supabase secrets set DECOLECTA_TOKEN=...
//   supabase functions deploy consultar-dni

const CABECERAS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const VENTANA_MS = 10 * 60 * 1000;
const CONSULTAS_POR_VENTANA = 8;
const CACHE_MS = 60 * 60 * 1000;

type Persona = {
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
};

const porIp = new Map<string, number[]>();
const cache = new Map<string, { persona: Persona | null; hasta: number }>();

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: CABECERAS });
}

/** true si esta IP todavía puede consultar. Registra la consulta. */
function dentroDelLimite(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (porIp.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= CONSULTAS_POR_VENTANA) {
    porIp.set(ip, recientes);
    return false;
  }
  recientes.push(ahora);
  porIp.set(ip, recientes);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  let dni = '';
  try {
    dni = String((await req.json())?.dni ?? '').trim();
  } catch {
    /* cuerpo vacío o inválido: se rechaza abajo */
  }
  if (!/^[0-9]{8}$/.test(dni)) {
    return responder({ error: 'El DNI debe tener 8 dígitos' }, 400);
  }

  const enCache = cache.get(dni);
  if (enCache && enCache.hasta > Date.now()) {
    return enCache.persona
      ? responder({ encontrado: true, ...enCache.persona })
      : responder({ encontrado: false });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'desconocida';
  if (!dentroDelLimite(ip)) {
    return responder(
      { error: 'Hiciste demasiadas consultas seguidas, espera unos minutos' },
      429,
    );
  }

  const token = Deno.env.get('DECOLECTA_TOKEN');
  if (!token) {
    console.error('consultar-dni: falta el secreto DECOLECTA_TOKEN');
    return responder({ error: 'La consulta a RENIEC no está configurada' }, 503);
  }

  try {
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
      if (!persona.nombres && !persona.apellido_paterno) {
        cache.set(dni, { persona: null, hasta: Date.now() + CACHE_MS });
        return responder({ encontrado: false });
      }
      cache.set(dni, { persona, hasta: Date.now() + CACHE_MS });
      return responder({ encontrado: true, ...persona });
    }

    if (r.status === 400 || r.status === 404) {
      cache.set(dni, { persona: null, hasta: Date.now() + CACHE_MS });
      return responder({ encontrado: false });
    }

    // 401/403 (token), 402/429 (cupo), 5xx: no es culpa de la persona
    console.error(`consultar-dni: Decolecta respondió ${r.status}`);
    return responder({ error: 'RENIEC no respondió' }, 502);
  } catch (e) {
    console.error('consultar-dni: fallo al consultar Decolecta', (e as Error).name);
    return responder({ error: 'RENIEC no respondió' }, 502);
  }
});
