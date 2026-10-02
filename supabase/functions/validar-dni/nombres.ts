// Comparación entre el nombre que declaró la persona y el que devuelve RENIEC.
// Va aparte de index.ts para poder probarla sin Deno ni red.

export type NombreReniec = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
};

// Partículas que la gente suele omitir o escribir distinto
const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA']);

/** Mayúsculas, sin tildes ni signos, en palabras sueltas. */
export function palabras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .split(' ')
    .filter((p) => p.length >= 2 && !PARTICULAS.has(p));
}

/**
 * Coincide si la persona declaró al menos dos palabras y todas figuran en el
 * nombre de RENIEC, en cualquier orden. Así «Mariano Guevara» y
 * «Guevara Mariano» pasan contra «GUEVARA RIOS MARIANO ALBERTO», pero un solo
 * nombre, o un nombre que no está en el documento, no.
 */
export function coincideNombre(declarado: string, reniec: NombreReniec): boolean {
  const mios = palabras(declarado);
  if (mios.length < 2) return false;
  const suyos = new Set(
    palabras(
      `${reniec.nombres} ${reniec.apellidoPaterno} ${reniec.apellidoMaterno}`,
    ),
  );
  return mios.every((p) => suyos.has(p));
}
