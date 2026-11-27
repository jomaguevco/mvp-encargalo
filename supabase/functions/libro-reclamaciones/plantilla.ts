// Texto de los correos del libro de reclamaciones. Aparte del index.ts para
// poder probarlo sin Deno.

/**
 * Datos del proveedor que exige la hoja de reclamación. Mantenerlos iguales a
 * PROVEEDOR en src/lib/negocio.ts. Cambiar la razón social y el RUC en cuanto
 * la empresa esté inscrita en SUNARP y SUNAT.
 */
export const PROVEEDOR = {
  razonSocial: 'Encárgalo (razón social en trámite)',
  ruc: 'En trámite',
  domicilio: 'Chiclayo, Lambayeque, Perú',
};

export type Hoja = {
  correlativo: string;
  creado_en: string;
  plazo_vence: string;
  tipo: 'reclamo' | 'queja';
  nombre: string;
  documento_tipo: string;
  documento_numero: string;
  domicilio: string;
  telefono: string | null;
  correo: string;
  menor_de_edad: boolean;
  apoderado: string | null;
  bien_tipo: string;
  monto: number | null;
  bien_descripcion: string;
  detalle: string;
  pedido_consumidor: string;
  respuesta: string | null;
  respondido_en: string | null;
};

export function escapar(t: string | number | null | undefined): string {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fechaLima = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' });

const fechaCorta = (dia: string) => {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
};

function filas(pares: [string, string | number | null | undefined][]) {
  return pares
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#5b6b66;vertical-align:top;white-space:nowrap">${escapar(k)}</td>` +
        `<td style="padding:6px 0;color:#1f2d2a">${escapar(v).replace(/\n/g, '<br>')}</td></tr>`,
    )
    .join('');
}

function seccion(titulo: string, contenido: string) {
  return (
    `<h3 style="font:600 15px sans-serif;color:#24453c;margin:24px 0 6px">${escapar(titulo)}</h3>` +
    `<table style="font:14px/1.5 sans-serif;border-collapse:collapse">${contenido}</table>`
  );
}

/** Copia de la hoja para el reclamante (y para el equipo, en copia oculta). */
export function correoCopia(h: Hoja): { asunto: string; html: string; texto: string } {
  const tipo = h.tipo === 'reclamo' ? 'Reclamo' : 'Queja';
  const asunto = `Hoja de reclamación ${h.correlativo} · Encárgalo`;
  const html =
    `<div style="max-width:640px;margin:auto;padding:24px;background:#f6f1e8">` +
    `<h2 style="font:700 20px sans-serif;color:#24453c;margin:0 0 4px">Libro de reclamaciones</h2>` +
    `<p style="font:14px sans-serif;color:#1f2d2a;margin:0 0 16px">Hoja N.° <b>${escapar(h.correlativo)}</b> · ${escapar(fechaLima(h.creado_en))}</p>` +
    `<p style="font:14px/1.5 sans-serif;color:#1f2d2a">Hola ${escapar(h.nombre.split(' ')[0])}: registramos tu ${tipo.toLowerCase()}. ` +
    `Te responderemos a este correo a más tardar el <b>${escapar(fechaCorta(h.plazo_vence))}</b> (15 días hábiles).</p>` +
    seccion('Proveedor', filas([
      ['Razón social', PROVEEDOR.razonSocial],
      ['RUC', PROVEEDOR.ruc],
      ['Domicilio', PROVEEDOR.domicilio],
    ])) +
    seccion('1. Consumidor reclamante', filas([
      ['Nombre', h.nombre],
      [h.documento_tipo, h.documento_numero],
      ['Domicilio', h.domicilio],
      ['Teléfono', h.telefono],
      ['Correo', h.correo],
      ['Padre, madre o apoderado', h.menor_de_edad ? h.apoderado : null],
    ])) +
    seccion('2. Bien contratado', filas([
      ['Tipo', h.bien_tipo === 'producto' ? 'Producto' : 'Servicio'],
      ['Monto reclamado', h.monto != null ? `S/ ${Number(h.monto).toFixed(2)}` : null],
      ['Descripción', h.bien_descripcion],
    ])) +
    seccion(`3. Detalle del ${tipo.toLowerCase()}`, filas([
      ['Tipo', tipo],
      ['Detalle', h.detalle],
      ['Pedido del consumidor', h.pedido_consumidor],
    ])) +
    `<p style="font:12px/1.5 sans-serif;color:#5b6b66;margin-top:24px">` +
    `Reclamo: disconformidad relacionada con los productos o servicios. ` +
    `Queja: disconformidad no relacionada con los productos o servicios, o malestar respecto a la atención. ` +
    `La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito ` +
    `previo para interponer una denuncia ante el INDECOPI. El proveedor debe dar respuesta en un plazo no ` +
    `mayor a quince (15) días hábiles.</p></div>`;

  const texto = [
    `Libro de reclamaciones · Encárgalo`,
    `Hoja N.° ${h.correlativo} · ${fechaLima(h.creado_en)}`,
    `Respuesta a más tardar el ${fechaCorta(h.plazo_vence)} (15 días hábiles).`,
    ``,
    `Proveedor: ${PROVEEDOR.razonSocial} · RUC ${PROVEEDOR.ruc} · ${PROVEEDOR.domicilio}`,
    `Consumidor: ${h.nombre} · ${h.documento_tipo} ${h.documento_numero} · ${h.domicilio}`,
    h.menor_de_edad ? `Apoderado: ${h.apoderado}` : '',
    `Bien: ${h.bien_tipo} · ${h.bien_descripcion}${h.monto != null ? ` · S/ ${Number(h.monto).toFixed(2)}` : ''}`,
    `${tipo}: ${h.detalle}`,
    `Pedido: ${h.pedido_consumidor}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { asunto, html, texto };
}

/** Respuesta del proveedor a la hoja. */
export function correoRespuesta(h: Hoja): { asunto: string; html: string; texto: string } {
  const asunto = `Respuesta a tu hoja ${h.correlativo} · Encárgalo`;
  const html =
    `<div style="max-width:640px;margin:auto;padding:24px;background:#f6f1e8">` +
    `<h2 style="font:700 20px sans-serif;color:#24453c;margin:0 0 4px">Respuesta a tu ${h.tipo}</h2>` +
    `<p style="font:14px sans-serif;color:#1f2d2a;margin:0 0 16px">Hoja N.° <b>${escapar(h.correlativo)}</b> · presentada el ${escapar(fechaLima(h.creado_en))}</p>` +
    `<p style="font:14px/1.6 sans-serif;color:#1f2d2a">Hola ${escapar(h.nombre.split(' ')[0])}:</p>` +
    `<p style="font:14px/1.6 sans-serif;color:#1f2d2a">${escapar(h.respuesta).replace(/\n/g, '<br>')}</p>` +
    seccion('Lo que nos indicaste', filas([
      ['Detalle', h.detalle],
      ['Tu pedido', h.pedido_consumidor],
    ])) +
    `<p style="font:12px/1.5 sans-serif;color:#5b6b66;margin-top:24px">${escapar(PROVEEDOR.razonSocial)} · RUC ${escapar(PROVEEDOR.ruc)} · ${escapar(PROVEEDOR.domicilio)}. ` +
    `Si no estás conforme, puedes acudir al INDECOPI.</p></div>`;
  const texto = `Respuesta a tu hoja ${h.correlativo}\n\n${h.respuesta}\n\n${PROVEEDOR.razonSocial}`;
  return { asunto, html, texto };
}
