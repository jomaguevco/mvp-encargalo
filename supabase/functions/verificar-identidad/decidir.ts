// Reglas de decisión de verificar-identidad. Van aparte de index.ts para poder
// probarlas sin Deno.serve, sin AWS y sin red (decidir.test.ts).

import { palabras } from '../validar-dni/nombres.ts';

export type ResultadoIa = 'aprobado' | 'revisar' | 'rechazado';

export type Evaluacion = {
  /** Similitud 0-100 entre la selfie y la foto del DNI. Null = no se pudo comparar. */
  similitud: number | null;
  /** Falta un rostro en alguna de las dos fotos. */
  sinRostro: 'selfie' | 'dni' | null;
  /** Null = no se pudo leer el documento. */
  numeroCoincide: boolean | null;
  nombreCoincide: boolean | null;
  /** Lo que guardó validar-dni: el nombre del perfil contra RENIEC. */
  dniValidacion: string | null;
};

export type Umbrales = { aprobar: number; rechazar: number };

export type Decision = { resultado: ResultadoIa; motivos: string[] };

/**
 * ¿Aparece el DNI declarado en alguna línea del documento? Se quitan espacios,
 * guiones y puntos dentro de cada línea, porque el lector a veces separa
 * «4602 7897» o pega el dígito verificador («46027897-9»). Se mira línea por
 * línea, y no el texto entero, para no armar el número juntando fechas.
 */
export function numeroEnDocumento(dni: string, lineas: string[]): boolean {
  return lineas.some((l) => l.replace(/[\s.\-]/g, '').includes(dni));
}

/**
 * ¿Están impresas en el documento todas las palabras del nombre del perfil?
 * El perfil ya se contrastó con RENIEC, así que si coincide con lo impreso, lo
 * impreso coincide con RENIEC. Se pide al menos dos palabras, igual que en
 * validar-dni.
 */
export function nombreEnDocumento(nombrePerfil: string, lineas: string[]): boolean {
  const mias = palabras(nombrePerfil);
  if (mias.length < 2) return false;
  const impresas = new Set(palabras(lineas.join(' ')));
  return mias.every((p) => impresas.has(p));
}

/**
 * Aprobado: todo coincide. Rechazado: hay dos rostros y claramente no son la
 * misma persona. Todo lo demás, incluido cualquier fallo del servicio, queda
 * para el operador: la IA nunca rechaza por una foto mala, solo por otra cara.
 */
export function decidir(e: Evaluacion, u: Umbrales): Decision {
  if (e.similitud !== null && e.similitud < u.rechazar) {
    return {
      resultado: 'rechazado',
      motivos: ['La selfie no corresponde a la persona de la foto del DNI'],
    };
  }

  const motivos: string[] = [];
  if (e.sinRostro === 'selfie') motivos.push('No se detectó un rostro en la selfie');
  else if (e.sinRostro === 'dni') motivos.push('No se detectó el rostro en la foto del DNI');
  else if (e.similitud === null) motivos.push('No se pudo comparar los rostros');
  else if (e.similitud < u.aprobar) {
    motivos.push(`Similitud facial dudosa (${e.similitud.toFixed(1)} %)`);
  }

  if (e.numeroCoincide === null) motivos.push('No se pudo leer el documento');
  else {
    if (!e.numeroCoincide) motivos.push('El número impreso no se leyó igual al declarado');
    if (!e.nombreCoincide) motivos.push('El nombre impreso no se leyó igual al del perfil');
  }

  if (e.dniValidacion !== 'coincide') {
    motivos.push(
      e.dniValidacion === 'no_coincide'
        ? 'RENIEC: el nombre del perfil no coincide'
        : e.dniValidacion === 'no_existe'
          ? 'RENIEC no reconoce el DNI'
          : 'Sin validar con RENIEC',
    );
  }

  return motivos.length ? { resultado: 'revisar', motivos } : { resultado: 'aprobado', motivos };
}
