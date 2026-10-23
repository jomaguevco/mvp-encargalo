// deno test supabase/functions/verificar-identidad
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { decidir, nombreEnDocumento, numeroEnDocumento, type Evaluacion } from './decidir.ts';

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
  ];
  for (const c of casos) {
    const d = decidir({ ...BIEN, ...c }, U);
    assertEquals(d.resultado, 'revisar', JSON.stringify(c));
    assert(d.motivos.length > 0);
  }
});
