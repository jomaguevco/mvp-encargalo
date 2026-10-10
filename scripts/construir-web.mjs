/**
 * Arma el sitio completo para Vercel en la carpeta `publico/`:
 *
 *   /            la página pública (carpeta web/)
 *   /app/...     la aplicación, exportada para navegador con Expo
 *
 *   node scripts/construir-web.mjs
 *   cd publico && npx vercel deploy --prod
 *
 * Se construye aquí y no en Vercel porque las variables EXPO_PUBLIC_* viven en
 * el .env local (los datos de Yape no van al repositorio, que es público).
 * Vercel solo recibe archivos estáticos ya armados.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const publico = join(raiz, 'publico');
const exportado = join(raiz, 'dist-web');

console.log('1/3 Exportando la aplicación para navegador…');
rmSync(exportado, { recursive: true, force: true });
execSync(`npx expo export --platform web --output-dir dist-web`, { cwd: raiz, stdio: 'inherit' });

console.log('2/3 Juntando la página pública y la aplicación…');
// publico/.vercel enlaza la carpeta con el proyecto de Vercel: se conserva.
const enlace = join(raiz, '.vercel-publico');
if (existsSync(join(publico, '.vercel'))) cpSync(join(publico, '.vercel'), enlace, { recursive: true });
rmSync(publico, { recursive: true, force: true });
cpSync(join(raiz, 'web'), publico, { recursive: true });
if (existsSync(enlace)) {
  cpSync(enlace, join(publico, '.vercel'), { recursive: true });
  rmSync(enlace, { recursive: true, force: true });
}
cpSync(exportado, join(publico, 'app'), { recursive: true });
rmSync(exportado, { recursive: true, force: true });

console.log('3/3 Ajustando el HTML de la aplicación…');
const indice = join(publico, 'app', 'index.html');
let html = readFileSync(indice, 'utf8');
html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace('httpEquiv=', 'http-equiv=')
  .replace(
    '<link rel="icon" href="/app/favicon.ico"/>',
    '<link rel="icon" type="image/svg+xml" href="/img/isotipo.svg"/>' +
      '<link rel="apple-touch-icon" href="/img/apple-touch-icon.png"/>',
  );
writeFileSync(indice, html);

for (const necesario of ['index.html', 'vercel.json', 'img/social.png', 'app/index.html']) {
  if (!existsSync(join(publico, necesario))) {
    throw new Error(`Falta publico/${necesario}. ¿Corriste python marca/generar.py?`);
  }
}
console.log('Listo: publico/');
