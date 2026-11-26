// Edge Function · libro-reclamaciones
//
// Manda por correo, con la API de Brevo:
//   { accion: 'copia', id, token }  la copia de la hoja al reclamante, una sola
//      vez. No pide sesión (el formulario es público): el token lo devuelve
//      registrar_reclamacion() solo a quien acaba de enviar la hoja.
//   { accion: 'respuesta', id }     la respuesta del proveedor. Solo con la
//      sesión de un administrador.
//
// La hoja se guarda aunque el correo falle: la app muestra la copia en
// pantalla para que la persona la guarde.
//
//   supabase secrets set BREVO_API_KEY=... CORREO_REMITENTE=reclamos@... CORREO_RECLAMOS=equipo@...
//   supabase functions deploy libro-reclamaciones --no-verify-jwt   (ver supabase/config.toml)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { correoCopia, correoRespuesta, type Hoja } from './plantilla.ts';

const ORIGENES_WEB = [
  'https://encargalo.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
];

const COLUMNAS =
  'id, correlativo, creado_en, plazo_vence, tipo, nombre, documento_tipo, documento_numero, ' +
  'domicilio, telefono, correo, menor_de_edad, apoderado, bien_tipo, monto, bien_descripcion, ' +
  'detalle, pedido_consumidor, estado, respuesta, respondido_en, copia_enviada_en, respuesta_enviada_en';

function cabeceras(req: Request): Record<string, string> {
  const extra = (Deno.env.get('CORS_ORIGENES') ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const origen = req.headers.get('Origin');
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
  if (origen && [...ORIGENES_WEB, ...extra].includes(origen)) h['Access-Control-Allow-Origin'] = origen;
  return h;
}

async function enviarCorreo(opts: {
  para: { email: string; name: string };
  copiaOculta?: string | null;
  asunto: string;
  html: string;
  texto: string;
}): Promise<boolean> {
  const clave = Deno.env.get('BREVO_API_KEY');
  const remitente = Deno.env.get('CORREO_REMITENTE');
  if (!clave || !remitente) {
    console.error('libro-reclamaciones: faltan BREVO_API_KEY o CORREO_REMITENTE');
    return false;
  }
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': clave, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Encárgalo', email: remitente },
      to: [opts.para],
      ...(opts.copiaOculta ? { bcc: [{ email: opts.copiaOculta }] } : {}),
      replyTo: { email: Deno.env.get('CORREO_RECLAMOS') || remitente },
      subject: opts.asunto,
      htmlContent: opts.html,
      textContent: opts.texto,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) console.error(`libro-reclamaciones: Brevo respondió ${r.status}`);
  return r.ok;
}

Deno.serve(async (req) => {
  const h = cabeceras(req);
  const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: h });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  let cuerpo: { accion?: string; id?: string; token?: string } = {};
  try {
    cuerpo = await req.json();
  } catch {
    /* se rechaza abajo */
  }
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!cuerpo.id || !uuid.test(cuerpo.id)) return responder({ error: 'Falta la hoja' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const servicio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (cuerpo.accion === 'copia') {
    if (!cuerpo.token || !uuid.test(cuerpo.token)) return responder({ error: 'Falta el código de la hoja' }, 400);
    const { data: hoja } = await servicio
      .from('reclamaciones')
      .select(COLUMNAS)
      .eq('id', cuerpo.id)
      .eq('token_copia', cuerpo.token)
      .maybeSingle();
    if (!hoja) return responder({ error: 'No encontramos esa hoja' }, 404);
    if (hoja.copia_enviada_en) return responder({ enviada: true });

    const c = correoCopia(hoja as unknown as Hoja);
    const ok = await enviarCorreo({
      para: { email: hoja.correo, name: hoja.nombre },
      copiaOculta: Deno.env.get('CORREO_RECLAMOS'),
      asunto: c.asunto,
      html: c.html,
      texto: c.texto,
    });
    if (!ok) return responder({ enviada: false, error: 'No se pudo enviar el correo' }, 502);
    await servicio.from('reclamaciones').update({ copia_enviada_en: new Date().toISOString() }).eq('id', hoja.id);
    return responder({ enviada: true });
  }

  if (cuerpo.accion === 'respuesta') {
    const autorizacion = req.headers.get('Authorization') ?? '';
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: autorizacion } },
    });
    const { data: esAdmin } = await usuario.rpc('soy_admin');
    if (esAdmin !== true) return responder({ error: 'Solo un administrador puede enviar la respuesta' }, 403);

    const { data: hoja } = await servicio.from('reclamaciones').select(COLUMNAS).eq('id', cuerpo.id).maybeSingle();
    if (!hoja) return responder({ error: 'No encontramos esa hoja' }, 404);
    if (hoja.estado !== 'respondido' || !hoja.respuesta) {
      return responder({ error: 'Primero registra la respuesta en el panel' }, 409);
    }
    const c = correoRespuesta(hoja as unknown as Hoja);
    const ok = await enviarCorreo({
      para: { email: hoja.correo, name: hoja.nombre },
      copiaOculta: Deno.env.get('CORREO_RECLAMOS'),
      asunto: c.asunto,
      html: c.html,
      texto: c.texto,
    });
    if (!ok) return responder({ enviada: false, error: 'No se pudo enviar el correo' }, 502);
    await servicio.from('reclamaciones').update({ respuesta_enviada_en: new Date().toISOString() }).eq('id', hoja.id);
    return responder({ enviada: true });
  }

  return responder({ error: 'Acción no válida' }, 400);
});
