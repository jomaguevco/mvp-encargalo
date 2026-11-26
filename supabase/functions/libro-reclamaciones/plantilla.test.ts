import { assert, assertEquals } from 'jsr:@std/assert@1';
import { correoCopia, correoRespuesta, escapar, type Hoja } from './plantilla.ts';

const hoja: Hoja = {
  correlativo: 'REC-2026-000001',
  creado_en: '2026-11-25T15:00:00Z',
  plazo_vence: '2026-12-18',
  tipo: 'reclamo',
  nombre: 'Juan <b>Rojas</b>',
  documento_tipo: 'DNI',
  documento_numero: '12345678',
  domicilio: 'Av. Balta 123',
  telefono: null,
  correo: 'juan@x.pe',
  menor_de_edad: false,
  apoderado: null,
  bien_tipo: 'servicio',
  monto: 350,
  bien_descripcion: 'Encargo de zapatillas',
  detalle: 'Llegó <script>alert(1)</script> rota',
  pedido_consumidor: 'Devolución',
  respuesta: 'Te devolvemos el dinero',
  respondido_en: null,
};

Deno.test('escapa el HTML que escribe el reclamante', () => {
  const c = correoCopia(hoja);
  assert(!c.html.includes('<script>'));
  assert(c.html.includes('&lt;script&gt;'));
  assert(!c.html.includes('<b>Rojas'));
});

Deno.test('la copia lleva correlativo, plazo y proveedor', () => {
  const c = correoCopia(hoja);
  assert(c.asunto.includes('REC-2026-000001'));
  assert(c.html.includes('18/12/2026'));
  assert(c.html.includes('RUC'));
  assert(c.html.includes('S/ 350.00'));
  assert(!c.html.includes('Teléfono'), 'omite los campos vacíos');
});

Deno.test('la respuesta incluye el texto del proveedor', () => {
  const c = correoRespuesta(hoja);
  assert(c.html.includes('Te devolvemos el dinero'));
  assertEquals(escapar(`"a'&`), '&quot;a&#39;&amp;');
});
