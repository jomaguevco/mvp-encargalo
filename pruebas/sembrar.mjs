/**
 * Siembra pedidos de PRUEBA en Encárgalo con fotos reales de producto.
 *
 * Todo pasa por los mismos caminos que la app (src/lib/api.ts): inicia sesión
 * como la cuenta de prueba que corresponde y llama a las funciones RPC
 * (ofertar, aceptar_oferta, reportar_pago, confirmar_retencion, avanzar_pedido,
 * confirmar_recepcion, calificar, abrir_disputa) o hace los mismos insert que
 * la app (pedidos, mensajes) y las mismas subidas a storage. Sin service_role,
 * sin SQL directo.
 *
 * Se puede volver a ejecutar: cada pedido se busca por su título y, si ya
 * existe, el script retoma desde su estado actual hasta el estado objetivo.
 * Los mensajes y las calificaciones tampoco se duplican.
 *
 * Requisitos:
 *   python -I pruebas/descargar_imagenes.py   (fotos en pruebas/imagenes/)
 *   .env                 EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   .env.pruebas.local   A_CORREO, A_CLAVE (cliente y operador), B_CORREO, B_CLAVE (comprador)
 *
 * Uso:  node pruebas/sembrar.mjs
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const AQUI = new URL('.', import.meta.url);
const LEYENDA = '(Pedido de prueba, no es una venta real.)';

// ------------------------------------------------------------ entorno
function leerEnv(nombre) {
  const texto = readFileSync(new URL(`../${nombre}`, AQUI), 'utf8');
  const valores = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) valores[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return valores;
}
const env = { ...leerEnv('.env'), ...leerEnv('.env.pruebas.local') };
for (const clave of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'A_CORREO', 'A_CLAVE', 'B_CORREO', 'B_CLAVE']) {
  if (!env[clave]) throw new Error(`Falta ${clave} en .env o .env.pruebas.local`);
}

async function sesion(correo, clave) {
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
  if (error) throw new Error(`No se pudo iniciar sesión con ${correo}: ${error.message}`);
  return { sb, uid: data.user.id };
}

/** Igual que `revienta` en api.ts: el error de PostgREST se lanza tal cual. */
function revienta(error, contexto) {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

async function rpc(cuenta, funcion, args) {
  const { data, error } = await cuenta.sb.rpc(funcion, args);
  revienta(error, funcion);
  return data;
}

// ------------------------------------------------------------ fechas
function enDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Resta días a una fecha ISO: la entrega ofrecida queda antes de la fecha límite. */
function antesDe(fechaIso, dias) {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------ catálogo
// estado objetivo de cada pedido; la oferta la hace siempre B (única cuenta compradora).
const PEDIDOS = [
  {
    titulo: 'PRUEBA - Nintendo Switch OLED blanca',
    descripcion:
      'Consola Nintendo Switch modelo OLED, color blanco, versión americana con cargador. Nueva y sellada, con boleta de compra.',
    categoria: 'Videojuegos',
    valor: 1250,
    plazo: 30,
    imagen: 'switch-oled.png',
    objetivo: 'publicado',
    oferta: { precio: 1390, diasAntes: 10, nota: 'La compro en Best Buy de Miami y viajo a Lima a fin de mes. (Oferta de prueba.)' },
  },
  {
    titulo: 'PRUEBA - Audífonos Apple AirPods Pro (2.ª generación) USB-C',
    descripcion:
      'AirPods Pro de segunda generación con estuche MagSafe USB-C. Originales, en caja sellada.',
    categoria: 'Tecnología',
    valor: 850,
    plazo: 25,
    imagen: 'airpods-pro.jpg',
    objetivo: 'publicado',
    oferta: { precio: 960, diasAntes: 8, nota: 'Puedo traerlos desde Apple Store de Nueva York, con boleta. (Oferta de prueba.)' },
  },
  {
    titulo: 'PRUEBA - Set LEGO Star Wars Halcón Milenario',
    descripcion:
      'Set LEGO Star Wars del Halcón Milenario, caja sin abrir. Es para regalo, la caja tiene que llegar en buen estado.',
    categoria: 'Coleccionables',
    valor: 690,
    plazo: 45,
    imagen: 'lego-halcon.jpg',
    objetivo: 'publicado', // sin ofertas, a la espera
  },
  {
    titulo: 'PRUEBA - Lector de libros Kobo Clara BW 6"',
    descripcion:
      'Lector de libros electrónicos Kobo Clara BW de 6 pulgadas, 16 GB, color negro. Nuevo, con cable USB-C.',
    categoria: 'Tecnología',
    valor: 520,
    plazo: 30,
    imagen: 'kobo-clara.jpg',
    objetivo: 'aceptado',
    oferta: { precio: 590, diasAntes: 9, nota: 'Lo consigo en Japón, viajo en tres semanas. (Oferta de prueba.)' },
    mensajes: [
      ['B', 'Hola, gracias por aceptar. En cuanto se confirme el pago lo compro. (Mensaje de prueba.)'],
      ['A', 'Perfecto, hoy mismo hago el Yape. ¿Viene con menú en español? (Mensaje de prueba.)'],
      ['B', 'Sí, el idioma se cambia desde la configuración. (Mensaje de prueba.)'],
    ],
  },
  {
    titulo: 'PRUEBA - Zapatillas Adidas Ultraboost talla 42',
    descripcion:
      'Zapatillas Adidas Ultraboost para correr, talla 42 (US 9), color negro. Originales, en su caja.',
    categoria: 'Zapatillas y ropa',
    valor: 560,
    plazo: 35,
    imagen: 'adidas-ultraboost.jpeg',
    objetivo: 'pagado',
    oferta: { precio: 640, diasAntes: 12, nota: 'Las compro en el outlet de Orlando. (Oferta de prueba.)' },
  },
  {
    titulo: 'PRUEBA - Perfume Chanel N°5 Eau de Parfum 100 ml',
    descripcion:
      'Perfume Chanel N°5 Eau de Parfum, frasco de 100 ml, sellado. Comprado en tienda oficial o duty free.',
    categoria: 'Cosméticos',
    valor: 780,
    plazo: 30,
    imagen: 'perfume-chanel.jpg',
    objetivo: 'comprado',
    oferta: { precio: 890, diasAntes: 10, nota: 'Lo compro en el duty free de Madrid-Barajas. (Oferta de prueba.)' },
  },
  {
    titulo: 'PRUEBA - Reloj Garmin Forerunner 965',
    descripcion:
      'Reloj GPS para correr Garmin Forerunner 965, pantalla AMOLED, color negro. Nuevo, con garantía internacional.',
    categoria: 'Tecnología',
    valor: 1450,
    plazo: 40,
    imagen: 'garmin-forerunner.jpeg',
    objetivo: 'en_viaje',
    oferta: { precio: 1500, diasAntes: 15, nota: 'Lo compro en REI de Houston, vuelo a Lima la próxima semana. (Oferta de prueba.)' },
    mensajes: [
      ['B', 'Ya está en mi maleta, llego a Lima el jueves y el viernes lo llevo a Chiclayo. (Mensaje de prueba.)'],
      ['A', '¡Genial! ¿Me avisas cuando estés en Chiclayo para coordinar la entrega? (Mensaje de prueba.)'],
    ],
  },
  {
    titulo: 'PRUEBA - Cámara instantánea Fujifilm Instax Mini',
    descripcion:
      'Cámara instantánea Fujifilm Instax Mini con dos paquetes de película de 10 fotos. Nueva, en caja.',
    categoria: 'Tecnología',
    valor: 330,
    plazo: 30,
    imagen: 'instax-mini.jpg',
    objetivo: 'entregado',
    oferta: { precio: 380, diasAntes: 10, nota: 'La consigo en Tokio con las películas. (Oferta de prueba.)' },
  },
  {
    titulo: 'PRUEBA - Mando DualSense PS5 azul cobalto',
    descripcion:
      'Mando inalámbrico DualSense para PlayStation 5, color Cobalt Blue. Original Sony, sellado.',
    categoria: 'Videojuegos',
    valor: 300,
    plazo: 25,
    imagen: 'dualsense.jpg',
    objetivo: 'confirmado',
    oferta: { precio: 340, diasAntes: 8, nota: 'Lo compro en Target, viajo en dos semanas. (Oferta de prueba.)' },
    calificaciones: {
      A: [5, 'Llegó sellado y antes de la fecha. Muy recomendable. (Calificación de prueba.)'],
      B: [5, 'Pagó rápido y coordinó bien la entrega. (Calificación de prueba.)'],
    },
  },
  {
    titulo: 'PRUEBA - Proteína Gold Standard 100% Whey 2 lb chocolate',
    descripcion:
      'Proteína Optimum Nutrition Gold Standard 100% Whey, envase de 2 lb (907 g), sabor Double Rich Chocolate. Sellada, vencimiento mayor a un año.',
    categoria: 'Suplementos',
    valor: 260,
    plazo: 30,
    imagen: 'proteina-whey.jpg',
    objetivo: 'en_disputa',
    oferta: { precio: 290, diasAntes: 10, nota: 'La compro en GNC de Miami. (Oferta de prueba.)' },
    mensajes: [
      ['A', 'Hola, el envase llegó con el sello de seguridad roto. (Mensaje de prueba.)'],
      ['B', 'Así me la entregaron en la tienda, tengo la boleta. Que lo revise el equipo. (Mensaje de prueba.)'],
    ],
    disputa:
      'El envase llegó con el sello de seguridad roto y no puedo saber si el producto es original. (Disputa de prueba, no es un caso real.)',
  },
];

const ORDEN = ['publicado', 'aceptado', 'pagado', 'comprado', 'en_viaje', 'entregado', 'confirmado'];
const posicion = (estado) => (estado === 'en_disputa' ? ORDEN.indexOf('entregado') + 0.5 : ORDEN.indexOf(estado));

const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

// ------------------------------------------------------------ pasos (como en api.ts)
async function subir(cuenta, bucket, ruta, archivo) {
  const bytes = readFileSync(new URL(`imagenes/${archivo}`, AQUI));
  if (bytes.byteLength === 0) throw new Error(`${archivo} está vacío`);
  const { error } = await cuenta.sb.storage
    .from(bucket)
    .upload(ruta, bytes, { contentType: TIPOS[extname(archivo).toLowerCase()], upsert: false });
  revienta(error, `subir ${bucket}/${ruta}`);
  return ruta;
}

async function buscarPedido(A, titulo) {
  const { data, error } = await A.sb
    .from('pedidos')
    .select('*')
    .eq('cliente_id', A.uid)
    .eq('titulo', titulo)
    .neq('estado', 'cancelado')
    .order('creado_en', { ascending: false })
    .limit(1);
  revienta(error, 'buscar pedido');
  return data?.[0] ?? null;
}

async function verPedido(cuenta, id) {
  const { data, error } = await cuenta.sb.from('pedidos').select('*').eq('id', id).single();
  revienta(error, 'ver pedido');
  return data;
}

/** publicarPedido + subirImagenProducto de api.ts. */
async function publicar(A, spec) {
  const ext = extname(spec.imagen).toLowerCase();
  const ruta = await subir(A, 'productos', `${A.uid}/producto-${Date.now()}${ext}`, spec.imagen);
  const { data, error } = await A.sb
    .from('pedidos')
    .insert({
      titulo: spec.titulo,
      descripcion: `${spec.descripcion} ${LEYENDA}`,
      url_producto: null,
      categoria: spec.categoria,
      cantidad: 1,
      ciudad_entrega: 'Chiclayo',
      fecha_limite: enDias(spec.plazo),
      valor_referencial: spec.valor,
      imagen_path: ruta,
      cliente_id: A.uid,
    })
    .select()
    .single();
  revienta(error, 'publicar pedido');
  return data;
}

/** miOferta de api.ts, como B. */
async function ofertaDeB(B, pedidoId) {
  const { data, error } = await B.sb
    .from('ofertas')
    .select('*')
    .eq('pedido_id', pedidoId)
    .eq('comprador_id', B.uid)
    .in('estado', ['enviada', 'aceptada'])
    .maybeSingle();
  revienta(error, 'ver oferta');
  return data;
}

async function pagoDelPedido(A, pedidoId) {
  const { data, error } = await A.sb.from('pagos').select('*').eq('pedido_id', pedidoId).maybeSingle();
  revienta(error, 'ver pago');
  return data;
}

async function mandarMensajes(cuentas, pedidoId, mensajes) {
  if (!mensajes?.length) return;
  const { data: previos, error } = await cuentas.A.sb.from('mensajes').select('emisor_id, cuerpo').eq('pedido_id', pedidoId);
  revienta(error, 'ver mensajes');
  for (const [quien, cuerpo] of mensajes) {
    const c = cuentas[quien];
    if (previos.some((m) => m.emisor_id === c.uid && m.cuerpo === cuerpo)) continue;
    const { error: e } = await c.sb.from('mensajes').insert({ pedido_id: pedidoId, emisor_id: c.uid, cuerpo });
    revienta(e, 'enviar mensaje');
    console.log(`    mensaje de ${quien}`);
  }
}

// ------------------------------------------------------------ máquina de estados
async function llevarAlObjetivo(cuentas, spec) {
  const { A, B } = cuentas;
  let pedido = await buscarPedido(A, spec.titulo);
  if (!pedido) {
    pedido = await publicar(A, spec);
    console.log(`  publicado (${pedido.id})`);
  } else {
    console.log(`  ya existía en «${pedido.estado}» (${pedido.id})`);
  }
  const meta = posicion(spec.objetivo);

  // Oferta de B
  if (spec.oferta && pedido.estado === 'publicado' && !(await ofertaDeB(B, pedido.id))) {
    await rpc(B, 'ofertar', {
      p_pedido_id: pedido.id,
      p_precio_final: spec.oferta.precio,
      p_fecha_entrega: antesDe(pedido.fecha_limite, spec.oferta.diasAntes),
      p_nota: spec.oferta.nota,
    });
    console.log(`  B ofertó S/ ${spec.oferta.precio}`);
  }

  // A acepta
  if (pedido.estado === 'publicado' && meta >= posicion('aceptado')) {
    const oferta = await ofertaDeB(B, pedido.id);
    await rpc(A, 'aceptar_oferta', { p_oferta_id: oferta.id });
    pedido = await verPedido(A, pedido.id);
    console.log('  A aceptó la oferta');
  }

  // El chat solo existe cuando hay comprador asignado (participa_en exige un pago).
  // En el pedido en disputa los mensajes van justo antes de abrirla.
  if (spec.objetivo !== 'en_disputa' && posicion(pedido.estado) >= posicion('aceptado')) {
    await mandarMensajes(cuentas, pedido.id, spec.mensajes);
  }

  // A reporta el pago (como reportarPago) y, como operador, lo retiene
  if (pedido.estado === 'aceptado' && meta >= posicion('pagado')) {
    let pago = await pagoDelPedido(A, pedido.id);
    if (pago.estado === 'pendiente') {
      const ruta = await subir(A, 'comprobantes', `${A.uid}/pago-${pedido.id}-${Date.now()}.png`, 'comprobante-prueba.png');
      pago = await rpc(A, 'reportar_pago', {
        p_pedido_id: pedido.id,
        p_metodo: 'yape',
        p_codigo_operacion: `PRUEBA-${pedido.id.slice(0, 8).toUpperCase()}`,
        p_comprobante_path: ruta,
      });
      console.log('  A reportó el pago (Yape simulado)');
    }
    if (pago.estado === 'en_revision') {
      await rpc(A, 'confirmar_retencion', { p_pedido_id: pedido.id });
      console.log('  operador (A) confirmó la retención');
    }
    pedido = await verPedido(A, pedido.id);
  }

  // B avanza: pagado → comprado → en_viaje → entregado
  const tope = Math.min(meta, posicion('entregado'));
  while (['pagado', 'comprado', 'en_viaje'].includes(pedido.estado) && posicion(pedido.estado) < tope) {
    const siguiente = ORDEN[posicion(pedido.estado) + 1];
    pedido = await rpc(B, 'avanzar_pedido', { p_pedido_id: pedido.id, p_nuevo: siguiente });
    console.log(`  B marcó «${siguiente}»`);
  }

  // A confirma la recepción
  if (pedido.estado === 'entregado' && spec.objetivo === 'confirmado') {
    await rpc(A, 'confirmar_recepcion', { p_pedido_id: pedido.id });
    pedido = await verPedido(A, pedido.id);
    console.log('  A confirmó la recepción: pago liberado');
  }

  // A abre la disputa (abrirDisputa de api.ts, sin evidencia)
  if (pedido.estado === 'entregado' && spec.objetivo === 'en_disputa') {
    await mandarMensajes(cuentas, pedido.id, spec.mensajes);
    await rpc(A, 'abrir_disputa', { p_pedido_id: pedido.id, p_motivo: spec.disputa });
    pedido = await verPedido(A, pedido.id);
    console.log('  A abrió una disputa');
  }

  // Calificaciones mutuas (calificar hace upsert: rerun no duplica)
  if (pedido.estado === 'confirmado' && spec.calificaciones) {
    for (const quien of ['A', 'B']) {
      const [puntaje, comentario] = spec.calificaciones[quien];
      await rpc(cuentas[quien], 'calificar', { p_pedido_id: pedido.id, p_puntaje: puntaje, p_comentario: comentario });
    }
    console.log('  A y B se calificaron');
  }

  if (pedido.estado !== spec.objetivo) {
    throw new Error(`«${spec.titulo}» quedó en «${pedido.estado}», se esperaba «${spec.objetivo}»`);
  }
  return pedido;
}

// ------------------------------------------------------------ verificación
async function verificar(A) {
  // misPedidos() de api.ts
  const { data, error } = await A.sb
    .from('pedidos')
    .select('*')
    .eq('cliente_id', A.uid)
    .order('creado_en', { ascending: false });
  revienta(error, 'misPedidos');
  let fallas = 0;
  console.log('\nVerificación (como A, misma consulta que misPedidos):');
  for (const spec of PEDIDOS) {
    const p = data.find((x) => x.titulo === spec.titulo && x.estado !== 'cancelado');
    if (!p) {
      console.log(`  FALTA  ${spec.titulo}`);
      fallas++;
      continue;
    }
    const url = A.sb.storage.from('productos').getPublicUrl(p.imagen_path ?? '').data.publicUrl;
    const r = p.imagen_path ? await fetch(url) : null;
    const tipo = r?.headers.get('content-type') ?? '';
    const pago = await pagoDelPedido(A, p.id);
    const bien =
      p.estado === spec.objetivo &&
      p.descripcion.endsWith(LEYENDA) &&
      !!p.imagen_path &&
      r?.status === 200 &&
      tipo.startsWith('image/');
    if (!bien) fallas++;
    console.log(
      `  ${bien ? 'OK   ' : 'FALLA'}  ${p.estado.padEnd(10)} S/ ${String(pago?.monto_encargo ?? p.valor_referencial).padStart(7)}` +
        `  imagen ${r?.status ?? '-'} ${tipo}  ${p.titulo}`,
    );
  }
  return fallas;
}

// ------------------------------------------------------------ principal
const A = await sesion(env.A_CORREO, env.A_CLAVE);
const B = await sesion(env.B_CORREO, env.B_CLAVE);
const cuentas = { A, B };

for (const spec of PEDIDOS) {
  console.log(`\n${spec.titulo} → ${spec.objetivo}`);
  await llevarAlObjetivo(cuentas, spec);
}

const fallas = await verificar(A);
if (fallas) {
  console.error(`\n${fallas} pedido(s) no pasaron la verificación`);
  process.exit(1);
}
console.log('\nListo.');
