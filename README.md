# Encárgalo · MVP

Aplicación móvil que conecta a consumidores peruanos que quieren productos del
extranjero con **compradores externos verificados** —viajeros que traen productos en su
equipaje e importadores pequeños—, reteniendo el pago hasta que el cliente confirma que
recibió su pedido.

Proyecto del curso **Negocios Electrónicos y Marketing Digital**, Escuela de Ingeniería
de Sistemas y Computación, USAT. Semestre 2026-II.

---

## Qué hace el MVP

Los nueve módulos que la Unidad 2 definió como imprescindibles, todos operativos:

1. Registro y **verificación de identidad** con DNI y selfie
2. **Publicación de pedidos** con enlace, categoría, cantidad y fecha límite
3. **Ofertas** de compradores externos con precio final y fecha de entrega
4. **Aceptación y pago retenido** (escrow) con desglose de precio transparente
5. **Seguimiento por estados** y bitácora automática
6. **Chat interno**, sin intercambiar números de teléfono
7. **Confirmación de recepción** que libera el pago
8. **Calificación mutua** y métricas públicas de reputación
9. **Mediación de disputas** con reembolso desde el dinero retenido

Más una **consola del equipo** para operar el piloto: cola de verificaciones, cola de
pagos por confirmar, disputas abiertas y plazos de confirmación vencidos.

### Lo que se cerró en la última iteración

Los nueve módulos estaban, pero el recorrido tenía huecos por los que un pedido real se
quedaba trabado. Estos son los que se cerraron:

| Módulo | Qué faltaba | Cómo quedó |
|---|---|---|
| **Avisos** | Nada le decía al usuario que tenía una oferta, un pago retenido o un mensaje | Bandeja propia por usuario, escrita por *triggers* de la base sobre los mismos hechos de la bitácora. Globo con el contador en la pestaña |
| **Cancelar un pedido** | El estado `cancelado` existía y nada podía llegar a él | `cancelar_pedido`: solo el cliente, y solo mientras no haya reportado el pago |
| **Retirar una oferta** | El comprador externo que ya no podía viajar no tenía salida | `retirar_oferta`, disponible mientras nadie la acepte |
| **Plazo de confirmación** | `dias_para_confirmar` estaba en `config` sin que nada lo leyera: si el cliente no confirmaba, el dinero quedaba retenido para siempre | El cliente ve su fecha límite; el equipo ve la cola de vencidos y puede liberar con `liberar_por_vencimiento` |
| **Reseñas públicas** | Solo se veía el promedio, no el comentario | Pantalla de reputación pública con las reseñas de quienes ya operaron con esa persona |
| **Ofertas enviadas** | Una oferta sin responder no aparecía en ninguna pantalla | Se listan en «Mis entregas», separadas de los pedidos adjudicados |
| **Disputas** | Solo las abría el cliente y solo al final | Las abren las dos partes, en cualquier estado con dinero retenido, con evidencia adjunta |
| **Búsqueda** | La lista de pedidos abiertos no se podía filtrar | Buscador sin tildes y filtro por categoría |
| **Foto del producto** | El bucket `productos` existía sin que nada subiera nada | Foto opcional al publicar, visible en la tarjeta y en el detalle |
| **Chat** | Había que recargar para ver si te contestaron | Se actualiza solo cada 12 segundos |
| **Borrado de documentos** | Aprobar una verificación descartaba las rutas, pero los archivos quedaban en el bucket | Al aprobar se borran en la misma operación (Ley N° 29733) |

## Decisiones que conviene conocer antes de leer el código

**El dinero se mueve solo en la base de datos, nunca desde el teléfono.** Aceptar una
oferta, retener un pago, liberarlo o reembolsarlo son funciones de Postgres con
`security definer` que validan quién llama y en qué estado está el pedido. La tabla
`pagos` no tiene ninguna política de `insert` ni de `update`: aunque alguien manipulara
la app, no podría liberarse un pago a sí mismo.

**El escrow del piloto se opera a mano.** Integrar una pasarela real exige RUC, cuenta
corriente y afiliación comercial aprobada, que no existen todavía. Mientras tanto el
cliente yapea a una cuenta del equipo y sube el comprobante; un operador confirma que el
dinero llegó y el pedido pasa a «pago retenido». Es dinero real y son ventas reales, que
es lo que pide el indicador IND3 del sílabo. Cuando entre Culqi o Izipay, solo cambia
quién llama a `confirmar_retencion`.

**Las tarifas viven en la tabla `config`, no en el código.** Son las mismas del flujo de
caja proyectado (`Entregables_Unidad2/Encargalo_Flujo_de_Caja_y_OKR.xlsx`, hoja 1):
comisión al cliente 10 %, tarifa al comprador externo 3 %, procesamiento 2.9 %. Si
cambian ahí, cambian aquí.

**Retención mínima de datos personales.** Solo se guarda el número de DNI. Las imágenes
del documento van a un bucket privado y, al aprobarse la verificación, la base descarta
sus rutas y la app borra los archivos en la misma operación. Es lo que exige la Ley
N° 29733.

---

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto gratuito. Elige la
   región más cercana (`South America (São Paulo)`).
2. Guarda la contraseña de la base de datos que te pide al crearlo.

### 2. Ejecutar las migraciones

En el panel de Supabase, **SQL Editor** → *New query*. Pega y ejecuta **en este orden**
el contenido de cada archivo de `supabase/migrations/`:

| Archivo | Qué crea |
|---|---|
| `0001_schema.sql` | Tablas, tipos, índices, vista de reputación y buckets |
| `0002_funciones.sql` | Reglas de negocio: ofertar, aceptar, pagar, confirmar, calificar |
| `0003_rls.sql` | Seguridad a nivel de fila y políticas de almacenamiento |
| `0004_config.sql` | Tarifas del modelo de negocio |
| `0005_operador.sql` | Consola del equipo |
| `0006_modulos.sql` | Cancelación, retiro de ofertas, reseñas, plazo de confirmación |
| `0007_avisos.sql` | Bandeja de avisos y sus *triggers* |
| `0008_validacion_dni.sql` | Resultado de la validación del DNI contra RENIEC |

Para comprobar que quedó bien, ejecuta:

```sql
select * from desglose_precio(491.40);
-- Debe devolver: encargo 491.40 · comisión 49.14 · procesamiento 15.68
--                total 556.22 · tarifa comprador 14.74 · recibe 476.66
```

### 3. Configurar la app

```bash
cp .env.example .env
```

Abre `.env` y pega la URL y la clave anónima de tu proyecto
(**Project Settings → API**), más el número de Yape al que los clientes pagarán durante
el piloto.

### 4. Correr la app

```bash
npm install
npx expo start
```

Escanea el código QR con la aplicación **Expo Go** desde un teléfono Android. Si cambias
el `.env`, reinicia con `npx expo start -c`.

### 5. Darse de alta como operador

Los operadores son quienes validan verificaciones y confirman pagos. Después de que cada
miembro del equipo cree su cuenta en la app:

1. Supabase → **Authentication → Users** → copia el UID de cada uno.
2. SQL Editor:

```sql
insert into operadores (perfil_id, nombre) values
  ('PEGA-AQUI-EL-UID', 'Guevara, Mariano')
on conflict (perfil_id) do nothing;
```

La pestaña **Equipo** aparecerá en la app solo para ellos.

### 6. Activar la consulta y la validación del DNI contra RENIEC

Son dos Edge Functions que usan el mismo token de Decolecta:

| Función | Cuándo se llama | Qué hace |
|---|---|---|
| `consultar-dni` | Al escribir los 8 dígitos en el registro y en la verificación | Devuelve el nombre de RENIEC y la app lo completa sola. No guarda nada. Límite de 8 consultas por IP cada 10 minutos y caché de una hora por DNI, para cuidar el cupo |
| `validar-dni` | Al enviar la verificación | Contrasta DNI y nombre del perfil, y guarda solo el resultado |

Si `consultar-dni` no está desplegada o RENIEC no responde, la app avisa y deja
escribir el nombre a mano: nadie queda bloqueado.

Al enviar su verificación, la app llama a la Edge Function `validar-dni`, que consulta
el DNI en la API RENIEC de [Decolecta](https://decolecta.gitbook.io/docs) y compara el
nombre con el del perfil. El equipo ve el resultado en la consola; la **aprobación sigue
siendo humana** (la selfie se compara con el documento). Solo se guarda el resultado
(`coincide`, `no_coincide`, `no_existe`), nunca los datos que devuelve RENIEC.

1. Genera un token en [decolecta.com/profile](https://decolecta.com/profile). El plan
   gratuito incluye 100 consultas al mes.
2. Ejecuta `0008_validacion_dni.sql` en el SQL Editor.
3. Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) vinculada al proyecto:

```bash
npx supabase login
npx supabase link --project-ref TU_REF      # el ref es lo que va antes de .supabase.co en la URL
npx supabase secrets set DECOLECTA_TOKEN=tu_token
npx supabase functions deploy consultar-dni
npx supabase functions deploy validar-dni
```

Para comprobarlo sin la app (debe devolver `encontrado: true` y el nombre):

```bash
curl -X POST "https://TU_REF.supabase.co/functions/v1/consultar-dni" \
  -H "Authorization: Bearer TU_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"dni":"46027897"}'
```

Si la consulta falla (cupo agotado, sin red), la solicitud queda en revisión y se
resuelve a mano como antes. Opcionalmente, `supabase secrets set RECHAZO_AUTOMATICO=1`
rechaza los DNI que RENIEC no reconoce; actívalo solo después de comprobar cómo responde
Decolecta ante un DNI inexistente.

### 7. Generar el APK para repartir

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Devuelve un enlace de descarga del `.apk`, que se puede instalar directamente sin pasar
por Google Play. Es lo que conviene usar para el piloto.

---

## Cómo probar el flujo completo

Hacen falta **dos cuentas** (usa dos teléfonos, o un teléfono y el emulador):

1. **Cuenta A** se registra, verifica su DNI y publica un pedido.
2. **Cuenta B** se registra, verifica su DNI, activa «Soy comprador externo» en su perfil
   y envía una oferta desde la pestaña *Ofertar*.
3. **Cuenta A** compara las ofertas y acepta una. Aparece el desglose de precio.
4. **Cuenta A** yapea, sube el comprobante y pulsa «Ya pagué».
5. Un **operador** entra a la pestaña *Equipo*, mira el comprobante y confirma la
   retención. El pedido pasa a «pago retenido».
6. **Cuenta B** va marcando: compré → en viaje → entregado.
7. **Cuenta A** confirma la recepción. El pago se libera.
8. Ambas se califican. La reputación aparece en el perfil y en las próximas ofertas.

Cada uno de esos pasos deja un aviso en la pestaña **Avisos** de la otra parte, con el
globo del contador en la barra inferior. Es la forma más rápida de mostrar en la
demostración que las dos cuentas están viendo lo mismo desde los dos lados.

Ese recorrido es exactamente la demostración de cinco minutos del informe
(sección 1.9).

---

## Estructura

```
src/
  app/                    Pantallas (expo-router, rutas por archivo)
    entrar.tsx            Ingreso
    registro.tsx          Alta de cuenta
    verificacion.tsx      DNI + selfie
    publicar.tsx          Nuevo pedido
    pedido/[id].tsx       Detalle: ofertas, pago, seguimiento, chat, disputa, calificación
    reputacion/[id].tsx   Perfil público: métricas y reseñas
    (app)/                Pestañas para sesión iniciada
      pedidos.tsx         Mis pedidos (lado cliente)
      explorar.tsx        Pedidos abiertos, con buscador y filtro
      entregas.tsx        Ofertas enviadas y pedidos que estoy trayendo
      avisos.tsx          Bandeja de avisos
      operador.tsx        Consola del equipo (solo operadores)
      perfil.tsx          Perfil y reputación
  ctx/auth.tsx            Sesión, perfil y rol de operador
  lib/
    supabase.ts           Cliente
    tipos.ts              Espejo de los tipos de la base de datos
    api.ts                Toda la capa de datos
    negocio.ts            Estados, etiquetas y formato
  ui/                     Componentes y paleta
supabase/migrations/      Esquema, funciones, RLS y configuración
supabase/functions/       Edge Functions: consultar-dni (nombre desde RENIEC) y validar-dni (contraste)
```

## Estado actual y qué falta

| Módulo | Estado |
|---|---|
| Registro, verificación, pedidos, ofertas, escrow, seguimiento, chat, calificación, disputas | Operativo |
| Cancelación, retiro de ofertas, reseñas públicas, plazo de confirmación, búsqueda | Operativo |
| Avisos dentro de la app | Operativo |
| Consola del equipo | Operativa: verificaciones, pagos, disputas y plazos vencidos |
| Validación de DNI contra RENIEC | Automática (existencia y nombre, vía Decolecta). La aprobación final, con la selfie, es manual |
| Pasarela de pagos | Manual. Requiere RUC y afiliación comercial |
| Envío push de los avisos | Pendiente. La bandeja ya existe y los *triggers* ya registran el hecho: falta el *build* nativo con Expo Notifications y guardar el token del dispositivo. En Expo Go no hay push |
| Publicación en Google Play | Pendiente. El piloto se reparte por APK |
| Versión iOS | Fuera del alcance del MVP, prevista para T1 2027 |

### Por qué los avisos no son push todavía

El pendiente que decía «notificaciones push» era en realidad dos cosas: registrar el
hecho y transportarlo al teléfono. Lo primero es lo que importa y es lo que ahora hace la
base de datos: cada oferta, cada movimiento de dinero, cada mensaje y cada calificación
crean una fila en `avisos`, con el mismo *trigger* que ya alimentaba la bitácora. El
transporte push exige un *build* nativo —Expo Go dejó de recibir notificaciones remotas—
y cuando ese *build* exista no hay que rehacer nada: el mismo `insert` dispara el envío.
