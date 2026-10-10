# Encárgalo · notas para trabajar en este repositorio

App Expo (React Native, Android) + Supabase. Marketplace de encargos del extranjero con
verificación de identidad, pago retenido y reputación pública. Ver `README.md` para la
puesta en marcha.

## Reglas del proyecto

- **Nada que mueva dinero o cambie el estado de un pedido se escribe desde la app.**
  Esas operaciones son funciones `security definer` en `supabase/migrations/0002_funciones.sql`.
  Si hace falta una transición nueva, se agrega ahí y se expone en `src/lib/api.ts`.
- **`pagos` no tiene políticas de insert ni de update.** Es deliberado. No las agregues.
- **Las tarifas viven en la tabla `config`**, nunca como número en el código. Deben
  coincidir con `Entregables_Unidad2/02_Encargalo_Flujo_de_Caja_y_Medicion.xlsx`, hoja «Supuestos».
- **Datos personales: retención mínima.** Solo se guarda el número de DNI. Las imágenes
  van a buckets privados y se descartan al resolver la verificación (Ley N° 29733).
- **La verificación automática nunca rechaza por una foto mala**, solo por otra cara.
  Lo dudoso va al operador. Ver `supabase/functions/verificar-identidad/decidir.ts`.
- El código y la interfaz están **en español**, incluidos nombres de funciones, tablas y
  variables. Mantén ese criterio.
- Ninguna funcionalidad entra si no refuerza **verificación, pago protegido o
  reputación**: es el criterio de producto acordado por el equipo fundador.

## Diseño

- La marca está en `encargalo/branding` (Monte, Terracota, Trigo, Arena; Bricolage
  Grotesque + Instrument Sans; plana, sin degradados). En la app vive en `src/ui/tema.ts`
  y el logo en `src/ui/Logo.tsx`.
- **`Text` y `TextInput` se importan de `@/ui/Texto`, no de `react-native`.** Ese
  componente traduce fontWeight/fontSize a la familia de la fuente de marca; con el
  `Text` nativo la pantalla sale con la letra del sistema.
- Las claves `C.azul` y `C.naranja` de `tema.ts` se llaman así por historia: hoy son
  Monte y Terracota. Renombrarlas no gana nada.
- El check del logo va Terracota sobre claro y Trigo sobre oscuro, nunca Trigo sobre
  claro. Íconos, splash e imágenes de la web salen de `python marca/generar.py`.

## Comandos

```bash
npx expo start          # desarrollo (Expo Go)
npx expo start -c       # limpiando caché, tras tocar .env
npx tsc --noEmit        # comprobación de tipos
npx expo export --platform android   # verificar que el bundle compila
```

## Al tocar la base de datos

Las migraciones se aplican a mano desde el SQL Editor de Supabase, en orden numérico.
Si agregas una, créala como `000N_nombre.sql` y no edites las anteriores: puede que ya
estén aplicadas en el proyecto del equipo.
