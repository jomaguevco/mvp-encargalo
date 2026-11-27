// deno test supabase/functions/verificar-identidad
import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  decidir,
  nombreEnDocumento,
  numeroEnDocumento,
  pareceDocumento,
  rutasRecortes,
  type Evaluacion,
} from './decidir.ts';

// Líneas como las devuelve Textract para el frente de un DNI
const DNI = [
  'REPÚBLICA DEL PERÚ',
  'DOCUMENTO NACIONAL DE IDENTIDAD',
  'DNI 4602 7897 - 9',
  'Primer Apellido',
  'GUEVARA',
  'Segundo Apellido',
  'RÍOS',
  'Pre Nombres',
  'MARIANO ALBERTO',
  'Fecha de Nacimiento 12 05 1990',
];

const U = { aprobar: 95, rechazar: 50 };
const BIEN: Evaluacion = {
  similitud: 99.1,
  sinRostro: null,
  numeroCoincide: true,
  nombreCoincide: true,
  dniValidacion: 'coincide',
  mismaImagen: false,
  selfieConDocumento: false,
};

Deno.test('lee el número aunque venga separado o con dígito verificador', () => {
  assert(numeroEnDocumento('46027897', DNI));
  assert(!numeroEnDocumento('46027898', DNI));
});

Deno.test('no arma el número juntando líneas distintas', () => {
  assert(!numeroEnDocumento('12051990', ['12 05', '1990']));
});

Deno.test('el nombre del perfil está impreso, sin importar tildes ni orden', () => {
  assert(nombreEnDocumento('Mariano Guevara Rios', DNI));
  assert(!nombreEnDocumento('Mauricio Guevara', DNI));
  assert(!nombreEnDocumento('Mariano', DNI));
});

Deno.test('todo coincide: se aprueba', () => {
  assertEquals(decidir(BIEN, U).resultado, 'aprobado');
});

Deno.test('otra cara: se rechaza aunque el resto coincida', () => {
  assertEquals(decidir({ ...BIEN, similitud: 12 }, U).resultado, 'rechazado');
});

Deno.test('casos dudosos van al operador, nunca se rechazan', () => {
  const casos: Partial<Evaluacion>[] = [
    { similitud: 80 },
    { similitud: null, sinRostro: 'selfie' },
    { similitud: null, sinRostro: 'dni' },
    { similitud: null },
    { numeroCoincide: false },
    { nombreCoincide: false },
    { numeroCoincide: null, nombreCoincide: null },
    { dniValidacion: null },
    { dniValidacion: 'no_coincide' },
    { selfieConDocumento: null },
  ];
  for (const c of casos) {
    const d = decidir({ ...BIEN, ...c }, U);
    assertEquals(d.resultado, 'revisar', JSON.stringify(c));
    assert(d.motivos.length > 0);
  }
});

Deno.test('la misma foto del DNI como selfie nunca se aprueba', () => {
  // Rostro idéntico a sí mismo y texto que coincide: sin este control, se aprobaba.
  const d = decidir({ ...BIEN, similitud: 100, mismaImagen: true }, U);
  assertEquals(d.resultado, 'revisar');
  assert(d.motivos.some((m) => m.includes('misma imagen')));
});

Deno.test('una foto del DNI usada como selfie va al operador', () => {
  const d = decidir({ ...BIEN, similitud: 99.8, selfieConDocumento: true }, U);
  assertEquals(d.resultado, 'revisar');
});

Deno.test('reconoce un documento fotografiado como selfie', () => {
  assert(pareceDocumento('46027897', DNI));
  assert(pareceDocumento('46027897', ['4602 7897']));
  assert(pareceDocumento('11111111', ['Republica del Peru']));
  assert(!pareceDocumento('46027897', []));
  assert(!pareceDocumento('46027897', ['ADIDAS', 'I LOVE NY']));
});

Deno.test('los recortes van junto a la foto del DNI y solo a ella', () => {
  assertEquals(rutasRecortes('abc/dni-123.jpg'), ['abc/dni-123-numero.jpg', 'abc/dni-123-nombres.jpg']);
  assertEquals(rutasRecortes('abc/selfie-123.jpg'), []);
  assertEquals(rutasRecortes('abc/dni-123-numero.jpg'), []);
});
