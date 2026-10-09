// Edge Function · validar-dni
//
// Consulta el DNI declarado por la persona en la API RENIEC de Decolecta y
// compara el nombre con el de su perfil. Guarda solo el RESULTADO, nunca los
// datos que devuelve RENIEC (retención mínima, Ley N° 29733).
//
// El token de Decolecta vive en los secretos de Supabase, no en la app:
//   supabase secrets set DECOLECTA_TOKEN=...
//   supabase functions deploy validar-dni --no-verify-jwt   (ver supabase/config.toml)
//
// Esta función NO aprueba verificaciones. Eso sigue haciéndolo un operador con
// resolver_verificacion(). Aquí solo se deja constancia de qué dijo RENIEC.
// Opcional: RECHAZO_AUTOMATICO=1 rechaza solo los DNI que RENIEC no reconoce.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { coincideNombre } from './nombres.ts';

type Resultado = 'coincide' | 'no_coincide' | 'no_existe' | 'sin_validar';

const CABECERAS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: CABECERAS });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = Deno.env.get('DECOLECTA_TOKEN');

  // 1. ¿Quién llama? Se toma de su sesión, nunca del cuerpo de la petición.
  const usuario = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: sesion } = await usuario.auth.getUser();
  if (!sesion.user) return responder({ error: 'No autorizado' }, 401);

  const admin = createClient(url, servicio);
  const { data: perfil } = await admin
    .from('profiles')
    .select('nombre_completo, dni, verificacion, dni_validacion, dni_frente_path, selfie_path')
    .eq('id', sesion.user.id)
    .single();

  if (!perfil?.dni) return responder({ error: 'Falta el DNI' }, 400);
  if (perfil.verificacion !== 'en_revision') {
    return responder({ error: 'No hay una verificación en revisión' }, 409);
  }

  // 2. Si este DNI ya se validó, se devuelve lo guardado. El plan gratuito de
  //    Decolecta es de 100 consultas al mes; no se gastan en repeticiones.
  if (perfil.dni_validacion) {
    return responder({ resultado: perfil.dni_validacion as Resultado });
  }

  if (!token) {
    console.error('validar-dni: falta el secreto DECOLECTA_TOKEN');
    return responder({ resultado: 'sin_validar' as Resultado });
  }

  // 3. Consulta a RENIEC vía Decolecta
  let resultado: Resultado = 'sin_validar';
  try {
    const r = await fetch(
      `https://api.decolecta.com/v1/reniec/dni?numero=${encodeURIComponent(perfil.dni)}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (r.ok) {
      const d = await r.json();
      resultado = coincideNombre(perfil.nombre_completo, {
        nombres: d.first_name ?? '',
        apellidoPaterno: d.first_last_name ?? '',
        apellidoMaterno: d.second_last_name ?? '',
      })
        ? 'coincide'
        : 'no_coincide';
    } else if (r.status === 400 || r.status === 404) {
      // La documentación solo describe el 400 («Invalid request»). El DNI ya
      // llega con 8 dígitos validados, así que se interpreta como «no existe».
      resultado = 'no_existe';
    } else {
      // 401/403 (token), 402/429 (cupo), 5xx: no es culpa de la persona
      console.error(`validar-dni: Decolecta respondió ${r.status}`);
    }
  } catch (e) {
    console.error('validar-dni: fallo al consultar Decolecta', (e as Error).name);
  }

  if (resultado === 'sin_validar') return responder({ resultado });

  // 4. Se guarda solo el resultado. Con service_role el trigger lo permite.
  await admin
    .from('profiles')
    .update({ dni_validacion: resultado, dni_validado_en: new Date().toISOString() })
    .eq('id', sesion.user.id);

  // 5. Rechazo automático, solo si el equipo lo activó
  if (resultado === 'no_existe' && Deno.env.get('RECHAZO_AUTOMATICO') === '1') {
    const rutas = [perfil.dni_frente_path, perfil.selfie_path].filter(Boolean) as string[];
    if (rutas.length) await admin.storage.from('documentos').remove(rutas);
    await admin
      .from('profiles')
      .update({
        verificacion: 'rechazado',
        motivo_rechazo:
          'No encontramos ese número de DNI en RENIEC. Revísalo y vuelve a enviarlo.',
        dni_frente_path: null,
        selfie_path: null,
      })
      .eq('id', sesion.user.id);
  }

  return responder({ resultado });
});
