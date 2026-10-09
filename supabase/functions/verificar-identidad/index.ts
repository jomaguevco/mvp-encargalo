// Edge Function · verificar-identidad
//
// Verificación biométrica y lectura del DNI, con AWS:
//   - Rekognition CompareFaces: compara la selfie con la foto impresa en el DNI.
//   - Textract DetectDocumentText: lee el número y el nombre impresos en el DNI.
// Lo leído se contrasta con el DNI declarado y con el nombre del perfil, que
// validar-dni ya contrastó con RENIEC. Con eso decide (ver decidir.ts):
//   aprobado  → verifica a la persona y borra las fotos al instante.
//   rechazado → la cara es claramente otra: rechaza y borra las fotos.
//   revisar   → queda en la cola del operador con el motivo.
//
// RENIEC (Decolecta) no entrega la foto de la persona, por eso la comparación es
// contra la foto impresa en el documento.
//
// Se guarda solo el resultado: ni el texto leído ni datos del rostro (retención
// mínima, Ley N° 29733). AWS puede usar las imágenes para mejorar sus modelos
// salvo que la cuenta tenga activada la exclusión («AI services opt-out
// policy» en AWS Organizations): actívala antes de usar fotos reales.
//
// Secretos (la cuenta IAM solo necesita rekognition:CompareFaces y
// textract:DetectDocumentText):
//   supabase secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1
//   supabase functions deploy verificar-identidad --no-verify-jwt   (ver supabase/config.toml)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import {
  decidir,
  nombreEnDocumento,
  numeroEnDocumento,
  type Evaluacion,
  type ResultadoIa,
} from './decidir.ts';

const CABECERAS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: CABECERAS });
}

/** Llamada firmada a una API JSON de AWS (Rekognition y Textract lo son). */
async function llamarAws(
  aws: AwsClient,
  servicio: 'rekognition' | 'textract',
  operacion: string,
  cuerpo: unknown,
) {
  const region = Deno.env.get('AWS_REGION') ?? 'us-east-1';
  const objetivo = servicio === 'rekognition' ? 'RekognitionService' : 'Textract';
  const peticion: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `${objetivo}.${operacion}`,
    },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15000),
  };
  // Los tipos de aws4fetch esperan el RequestInit del navegador; en Deno es el mismo objeto
  const r = await aws.fetch(
    `https://${servicio}.${region}.amazonaws.com/`,
    peticion as Parameters<AwsClient['fetch']>[1],
  );
  const datos = await r.json().catch(() => ({}));
  return { ok: r.ok, datos };
}

type Rostro = Pick<Evaluacion, 'similitud' | 'sinRostro'>;

async function compararRostros(aws: AwsClient, selfie: string, dni: string): Promise<Rostro> {
  const { ok, datos } = await llamarAws(aws, 'rekognition', 'CompareFaces', {
    SourceImage: { Bytes: selfie },
    TargetImage: { Bytes: dni },
    // Con umbral 0 devuelve la similitud de cada rostro del DNI, no solo los
    // que pasan. Se toma la mayor: el DNIe trae además una foto fantasma chica.
    SimilarityThreshold: 0,
  });

  if (!ok) {
    // Sin rostro en la selfie, Rekognition responde InvalidParameterException
    if (String(datos.__type ?? '').includes('InvalidParameter')) {
      return { similitud: null, sinRostro: 'selfie' };
    }
    console.error('verificar-identidad: Rekognition respondió', datos.__type ?? '?');
    return { similitud: null, sinRostro: null };
  }

  const similitudes = (datos.FaceMatches ?? []).map((m: { Similarity: number }) => m.Similarity);
  if (!similitudes.length) return { similitud: null, sinRostro: 'dni' };
  return { similitud: Math.round(Math.max(...similitudes) * 100) / 100, sinRostro: null };
}

async function leerDocumento(aws: AwsClient, dni: string): Promise<string[] | null> {
  const { ok, datos } = await llamarAws(aws, 'textract', 'DetectDocumentText', {
    Document: { Bytes: dni },
  });
  if (!ok) {
    console.error('verificar-identidad: Textract respondió', datos.__type ?? '?');
    return null;
  }
  return (datos.Blocks ?? [])
    .filter((b: { BlockType: string }) => b.BlockType === 'LINE')
    .map((b: { Text: string }) => b.Text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. ¿Quién llama? Se toma de su sesión, nunca del cuerpo de la petición.
  const usuario = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: sesion } = await usuario.auth.getUser();
  if (!sesion.user) return responder({ error: 'No autorizado' }, 401);
  const uid = sesion.user.id;

  const admin = createClient(url, servicio);
  const { data: perfil } = await admin
    .from('profiles')
    .select(
      'nombre_completo, dni, verificacion, dni_validacion, dni_frente_path, selfie_path, ia_resultado',
    )
    .eq('id', uid)
    .single();

  if (!perfil) return responder({ error: 'Perfil no encontrado' }, 404);
  if (perfil.verificacion !== 'en_revision') {
    return responder({ error: 'No hay una verificación en revisión' }, 409);
  }
  // Una evaluación por envío: no se repite el gasto ni se deja probar fotos.
  if (perfil.ia_resultado) return responder({ resultado: perfil.ia_resultado as ResultadoIa });
  if (!perfil.dni || !perfil.dni_frente_path || !perfil.selfie_path) {
    return responder({ error: 'Faltan el DNI o las fotos' }, 400);
  }

  const claveId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const claveSecreta = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if (!claveId || !claveSecreta) {
    // Sin configurar no se marca nada: queda en revisión como antes.
    console.error('verificar-identidad: faltan los secretos de AWS');
    return responder({ resultado: null });
  }
  const aws = new AwsClient({ accessKeyId: claveId, secretAccessKey: claveSecreta });

  // 2. Las fotos, desde el bucket privado
  const [fotoDni, fotoSelfie] = await Promise.all(
    [perfil.dni_frente_path, perfil.selfie_path].map(async (ruta) => {
      const { data } = await admin.storage.from('documentos').download(ruta);
      return data ? encodeBase64(new Uint8Array(await data.arrayBuffer())) : null;
    }),
  );
  if (!fotoDni || !fotoSelfie) return responder({ error: 'No se encontraron las fotos' }, 404);

  // 3. Umbrales desde config (ver 0010_biometria.sql)
  const { data: filas } = await admin
    .from('config')
    .select('clave, valor')
    .in('clave', ['umbral_rostro_aprobar', 'umbral_rostro_rechazar']);
  const umbral = (clave: string, defecto: number) =>
    Number(filas?.find((f) => f.clave === clave)?.valor ?? defecto);

  // 4. Rostro y documento, en paralelo
  let rostro: Rostro = { similitud: null, sinRostro: null };
  let lineas: string[] | null = null;
  try {
    [rostro, lineas] = await Promise.all([
      compararRostros(aws, fotoSelfie, fotoDni),
      leerDocumento(aws, fotoDni),
    ]);
  } catch (e) {
    console.error('verificar-identidad: fallo al llamar a AWS', (e as Error).name);
  }

  const evaluacion: Evaluacion = {
    ...rostro,
    numeroCoincide: lineas ? numeroEnDocumento(perfil.dni, lineas) : null,
    nombreCoincide: lineas ? nombreEnDocumento(perfil.nombre_completo, lineas) : null,
    dniValidacion: perfil.dni_validacion,
  };
  const { resultado, motivos } = decidir(evaluacion, {
    aprobar: umbral('umbral_rostro_aprobar', 95),
    rechazar: umbral('umbral_rostro_rechazar', 50),
  });

  // 5. Se guarda solo el resultado. Con service_role los triggers lo permiten.
  const cambios: Record<string, unknown> = {
    ia_resultado: resultado,
    ia_similitud: evaluacion.similitud,
    ia_numero_coincide: evaluacion.numeroCoincide,
    ia_nombre_coincide: evaluacion.nombreCoincide,
    ia_detalle: motivos.join(' · ') || null,
    ia_evaluado_en: new Date().toISOString(),
  };

  // 6. Si ya está resuelto, las fotos sobran: se borran después de guardar.
  if (resultado !== 'revisar') {
    Object.assign(cambios, {
      verificacion: resultado === 'aprobado' ? 'verificado' : 'rechazado',
      verificado_en: resultado === 'aprobado' ? new Date().toISOString() : null,
      motivo_rechazo:
        resultado === 'rechazado'
          ? 'La selfie no coincide con la foto de tu DNI. Vuelve a intentarlo con tu propio documento, buena luz y el rostro descubierto.'
          : null,
      dni_frente_path: null,
      selfie_path: null,
    });
  }

  const { error } = await admin.from('profiles').update(cambios).eq('id', uid);
  if (error) {
    console.error('verificar-identidad: no se pudo guardar', error.message);
    return responder({ error: 'No se pudo guardar el resultado' }, 500);
  }

  if (resultado !== 'revisar') {
    await admin.storage
      .from('documentos')
      .remove([perfil.dni_frente_path, perfil.selfie_path]);
  }

  return responder({ resultado });
});
