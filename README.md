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
caja proyectado (`Entregables_Unidad2/02_Encargalo_Flujo_de_Caja_y_Medicion.xlsx`, hoja «Supuestos»):
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
| `0009_aviso_cancelacion.sql` | Aviso con motivo a quienes ofertaron cuando el cliente cancela |
| `0010_biometria.sql` | Resultado de la verificación biométrica y umbrales (ver 6b) |
| `0011_correcciones_flujo.sql` | Aviso al comprador ganador, `rechazar_pago`, lectura para el equipo, RENIEC al cambiar el nombre |
| `0012_administracion.sql` | Rol de administrador, suspensión de cuentas, bitácora del equipo y funciones del panel `/admin` (ver 5b) |
| `0013_verificacion_reintentos.sql` | Un rechazo ya no reserva el DNI (se puede reintentar), cada verificación se resuelve una sola vez y con motivo, y el panel detecta cuentas duplicadas |
| `0014_foto_perfil.sql` | Foto de perfil opcional (bucket público `avatares`), visible en ofertas, pedidos y reputación; el administrador puede quitarla |
| `0015_dni_en_registro.sql` | El DNI escrito en el registro se copia al perfil al crear la cuenta |
| `0016_seguridad.sql` | Cierra huecos de seguridad: nombre y DNI fijos una vez en revisión o verificado, fotos solo de la carpeta propia y distintas entre sí, nadie oferta ni acepta en su propio pedido, avisos solo desde los *triggers*, aprobación biométrica automática apagada (ver 6b) |
| `0017_limite_consultas_dni.sql` | Límites persistentes de `consultar-dni` por IP, por usuario y por día (ver 6) |
| `0018_comision_y_limites.sql` | Comisión activa (10 % / 3 %) con 0 % en el primer pedido de los clientes del piloto, límite de S/ 500 para cuentas nuevas y videollamada para pedidos de más de S/ 1,500 (ver 6d) |
| `0019_libro_reclamaciones.sql` | Libro de reclamaciones virtual: hojas con número correlativo, plazo de 15 días hábiles y respuesta desde `/admin` (ver 6e) |

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

### 5b. Panel de administración y cuenta administrativa

El panel vive en la versión web, en **`/admin`** (por ejemplo `encargalo.vercel.app/app/admin`),
y solo entra quien está en la tabla `administradores`. Un administrador también es operador.

| Sección | Qué hace |
|---|---|
| Resumen | Lo que espera al equipo ahora y el reporte del período: cuentas, filtro biométrico, pedidos, dinero, disputas, actividad diaria. Exporta CSV |
| Verificaciones | La cola de lo que la biometría dejó «en revisión» (aprobar o rechazar con fotos, similitud y RENIEC) y el historial de cada decisión de la IA y del equipo |
| Cuentas | Búsqueda por nombre, correo, DNI o celular, filtros, ficha completa, suspender o reactivar |
| Pedidos y Pagos | Todos los pedidos y todo el escrow, con filtros y exportación |
| Operación | La misma consola del equipo: pagos por confirmar, plazos vencidos, disputas |
| Equipo y roles | Dar o quitar los roles de operador y administrador |
| Configuración | Tarifas, plazo de confirmación y umbrales biométricos, con rangos validados en la base |
| Bitácora | Quién hizo qué y cuándo; nadie la puede editar |

Para crear la cuenta administrativa, después de aplicar `0012_administracion.sql`,
ejecuta en el SQL Editor el script local **`supabase/admin_cuenta.local.sql`**. Ese archivo
está en `.gitignore` porque lleva la contraseña: este repositorio es público. Se entra con
el correo completo de esa cuenta. Ya no existe el atajo `admin`: usaba
`EXPO_PUBLIC_ADMIN_CORREO`, y toda variable `EXPO_PUBLIC_` queda escrita en el código
público de la app y de la web. Si tu `.env` la tiene, bórrala, y usa para esa cuenta
una contraseña larga y única.

Para nombrar administrador a otra persona, hazlo desde **Equipo y roles** o con:

```sql
insert into administradores (perfil_id) values ('PEGA-AQUI-EL-UID') on conflict do nothing;
insert into operadores (perfil_id, nombre) values ('PEGA-AQUI-EL-UID', 'Nombre') on conflict do nothing;
```

### 6. Activar la consulta y la validación del DNI contra RENIEC

Son dos Edge Functions que usan el mismo token de Decolecta:

| Función | Cuándo se llama | Qué hace |
|---|---|---|
| `consultar-dni` | En el registro (sin sesión) y en la verificación (con sesión) | **Sin sesión** recibe el DNI y el nombre escrito y responde solo si coinciden: nunca revela un nombre, para que nadie la use como buscador de personas. **Con sesión** devuelve el nombre de RENIEC para corregir el propio. No guarda el DNI ni la respuesta. Límites persistentes en la base (`0017`): 10 por IP cada hora y 150 al día sin sesión; 6 por usuario al día y 300 al día con sesión |
| `validar-dni` | Al enviar la verificación | Contrasta DNI y nombre del perfil, y guarda solo el resultado |
| `verificar-identidad` | Justo después | Compara selfie y foto del DNI, y lee lo impreso (ver 6b) |

Si `consultar-dni` no está desplegada o RENIEC no responde, la app avisa y deja
escribir el nombre a mano: nadie queda bloqueado.

Al enviar su verificación, la app llama a la Edge Function `validar-dni`, que consulta
el DNI en la API RENIEC de [Decolecta](https://decolecta.gitbook.io/docs) y compara el
nombre con el del perfil. El equipo ve el resultado en la consola; la comparación del
rostro y la aprobación automática están en el paso 6b. Solo se guarda el resultado
(`coincide`, `no_coincide`, `no_existe`), nunca los datos que devuelve RENIEC.

1. Genera un token en [decolecta.com/profile](https://decolecta.com/profile). El plan
   gratuito incluye 100 consultas al mes.
2. Ejecuta `0008_validacion_dni.sql` en el SQL Editor.
3. Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) vinculada al proyecto:

```bash
npx supabase login
npx supabase link --project-ref TU_REF      # el ref es lo que va antes de .supabase.co en la URL
npx supabase secrets set DECOLECTA_TOKEN=tu_token
npx supabase functions deploy consultar-dni --no-verify-jwt
npx supabase functions deploy validar-dni --no-verify-jwt
```

Ejecuta también `0017_limite_consultas_dni.sql`: sin esa tabla, `consultar-dni`
responde que no está disponible (prefiere cerrarse a consultar sin límite).

Para comprobarlo sin la app, sin sesión (debe devolver `encontrado: true` y
`coincide: true` o `false`, nunca el nombre):

```bash
curl -X POST "https://TU_REF.supabase.co/functions/v1/consultar-dni" \
  -H "Authorization: Bearer TU_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"dni":"46027897","nombre":"Mariano Guevara"}'
```

En la web, la función solo acepta llamadas desde `encargalo.vercel.app` y `localhost`.
Si la web vive en otro dominio: `npx supabase secrets set CORS_ORIGENES=https://otro-dominio`.

Si la consulta falla (cupo agotado, sin red), la solicitud queda en revisión y se
resuelve a mano como antes. Opcionalmente, `supabase secrets set RECHAZO_AUTOMATICO=1`
rechaza los DNI que RENIEC no reconoce; actívalo solo después de comprobar cómo responde
Decolecta ante un DNI inexistente.

### 6b. Activar la verificación biométrica (AWS)

La Edge Function `verificar-identidad` se llama justo después de `validar-dni`:

| Paso | Servicio | Qué comprueba |
|---|---|---|
| Rostro | AWS Rekognition `CompareFaces` | Que la selfie sea la misma persona de la foto impresa en el DNI |
| Documento | AWS Textract `DetectDocumentText` | Que el número impreso sea el declarado y el nombre impreso el del perfil |
| Selfie | AWS Rekognition `DetectText` | Que la selfie no sea la foto de un documento |

RENIEC (Decolecta) solo devuelve nombres, no la foto: por eso el rostro se compara con
la foto del documento. La cadena queda cerrada así: nombre impreso = nombre del perfil
= nombre en RENIEC (`validar-dni`).

Decisión (umbrales en la tabla `config`):

- **Aprobado**: similitud ≥ `umbral_rostro_aprobar` (95), número y nombre leídos
  coinciden, RENIEC dijo `coincide`, la selfie no es la misma imagen que el DNI y en
  ella no se lee un documento. Con `aprobacion_automatica = 0` (lo predeterminado
  desde `0016_seguridad.sql`) queda como **recomendación** en la consola y un operador
  confirma; con `1` se verifica al instante y las fotos se borran. Encenderla solo
  cuando haya prueba de vida: sin ella, una foto del DNI de otra persona subida como
  selfie podía aprobarse.
- **Rechazado**: similitud < `umbral_rostro_rechazar` (50), es otra persona. Se
  rechaza y las fotos se borran.
- **Revisar**: cualquier otro caso, incluido un fallo de AWS. Queda en la consola del
  equipo con la similitud, lo que se leyó y el motivo.

Costo aproximado: US$ 0.001 por comparación y US$ 0.0015 por lectura, con capa
gratuita los primeros 12 meses.

1. Crea una cuenta en AWS y un usuario IAM con solo esta política:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["rekognition:CompareFaces", "rekognition:DetectText", "textract:DetectDocumentText"],
    "Resource": "*"
  }]
}
```

2. Genera una clave de acceso para ese usuario.
3. **Antes de usar fotos reales**, activa la exclusión de uso de datos de AWS («AI
   services opt-out policy» en AWS Organizations) para que AWS no use las imágenes
   para entrenar. Los términos de privacidad de la app lo prometen.
4. Ejecuta `0010_biometria.sql` en el SQL Editor.
5. Configura y despliega:

```bash
npx supabase secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1
npx supabase functions deploy verificar-identidad --no-verify-jwt
```

Si los secretos no están, la función no marca nada y todo sigue como antes: revisión
humana. Las reglas de decisión tienen pruebas:
`deno test supabase/functions/verificar-identidad`.

### 6c. Recuperar la contraseña

La pantalla de ingreso tiene «¿Olvidaste tu contraseña?». Envía un **código** al
correo (no un enlace, para que funcione igual en el APK y en la web sin configurar
enlaces profundos). La persona escribe el código y su contraseña nueva, y entra.

Hay que hacer un cambio una sola vez en Supabase: **Authentication → Emails →
Reset Password** y reemplazar la plantilla por algo como:

```html
<h2>Recupera tu contraseña de Encárgalo</h2>
<p>Tu código es:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Escríbelo en la app junto con tu nueva contraseña. Vence en una hora.</p>
<p>Si no lo pediste, ignora este correo.</p>
```

Sin `{{ .Token }}` el correo solo trae un enlace y la app no tiene dónde usarlo.

El servidor de correo de prueba de Supabase envía muy pocos correos por hora. Para
el piloto conviene configurar un SMTP propio (Resend, Brevo, Gmail) en
**Authentication → Emails → SMTP Settings**.

### 6d. Comisión, beneficio del piloto y límites de cuentas nuevas

`0018_comision_y_limites.sql` deja la comisión en 10 % al cliente y 3 % al comprador
externo (los valores de la hoja «Supuestos» del flujo de caja) y agrega tres montos que
se cambian en **/admin → Configuración**:

| Clave | Valor | Qué hace |
|---|---|---|
| `limite_cuenta_nueva` | 500 | Tope por pedido (S/) mientras el cliente no completa sus primeros pedidos. Se aplica al publicar (valor referencial) y al aceptar la oferta |
| `pedidos_para_quitar_limite` | 3 | Pedidos confirmados para dejar de tener el tope |
| `monto_videollamada` | 1500 | Por encima de este monto, aceptar una oferta exige que un operador haya registrado una videollamada con el cliente |

- **Beneficio del piloto.** Quien tuvo un pedido creado antes del 02/11/2026 con pago
  retenido o liberado no paga comisión en su primer pedido posterior (el comprador
  externo sí paga su 3 %). El pago queda marcado con `beneficio_piloto = true`. Si ese
  pedido se cancela, el beneficio vuelve a estar disponible.
- **Videollamada.** El operador la hace (WhatsApp o Meet: cara y DNI en cámara) y la
  registra en **/admin → Cuentas → la cuenta → Registrar videollamada**. Queda en la
  bitácora.

### 6e. Libro de reclamaciones virtual

Formulario público en `/app/reclamaciones` (enlazado en el pie de la web, en el perfil
y en cada pedido). Cada hoja recibe un número `REC-AAAA-000001` sin saltos y un plazo
de 15 días hábiles que descuenta fines de semana y los feriados de la tabla
`feriados` (cargados 2026 y 2027). Se responde desde **/admin → Reclamaciones**.

La copia al reclamante y la respuesta se envían con la API de Brevo (la misma cuenta
del SMTP). Una sola vez:

```bash
npx supabase secrets set BREVO_API_KEY=xkeysib-... CORREO_REMITENTE=remitente-verificado@... CORREO_RECLAMOS=correo-del-equipo@...
npx supabase functions deploy libro-reclamaciones --no-verify-jwt
```

La clave se crea en Brevo → **SMTP & API → API Keys** (no es la contraseña SMTP).
`CORREO_REMITENTE` debe ser un remitente verificado en Brevo. `CORREO_RECLAMOS` recibe
una copia oculta de cada hoja. Si el correo falla, la hoja igual queda registrada y la
persona ve la constancia en pantalla.

Antes de publicar, cambia la razón social y el RUC en `PROVEEDOR`
(`src/lib/negocio.ts` y `supabase/functions/libro-reclamaciones/plantilla.ts`).

### Indicadores de las tareas

```sql
-- ES-03 · ingresos por comisión de pagos liberados (por mes)
select date_trunc('month', liberado_en) as mes,
       sum(comision_cliente + tarifa_comprador) as ingreso,
       count(*) filter (where beneficio_piloto) as con_beneficio_piloto
from pagos where estado = 'liberado' group by 1 order by 1;

-- ES-15 · reclamaciones respondidas en plazo ÷ recibidas
select count(*) filter (where estado = 'respondido'
         and (respondido_en at time zone 'America/Lima')::date <= plazo_vence)::numeric
       / nullif(count(*), 0) as es15
from reclamaciones;

-- ES-17 · disputas ÷ pedidos con pago retenido (desde el 16/11)
select (select count(distinct d.pedido_id) from disputas d
          join pedidos p on p.id = d.pedido_id where p.creado_en >= '2026-11-16')::numeric
     / nullif((select count(*) from pagos g join pedidos p on p.id = g.pedido_id
               where p.creado_en >= '2026-11-16'
                 and g.retenido_en is not null), 0) as es17;
```

### 7. Generar el APK para repartir

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Devuelve un enlace de descarga del `.apk`, que se puede instalar directamente sin pasar
por Google Play. Es lo que conviene usar para el piloto.

Las variables `EXPO_PUBLIC_*` del `.env` no viajan solas a la compilación en la nube:
la URL y la clave publicable de Supabase (públicas por diseño) están declaradas en el
perfil de `eas.json`. Nunca poner ahí la `service_role`. Los datos de Yape no van en
`eas.json` porque el repositorio es público: viajan en `.env`, que `.easignore` sí sube
a EAS y `.gitignore` deja fuera de GitHub. `eas.json` no admite comentarios: EAS rechaza
cualquier campo que no conozca.

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
supabase/functions/       Edge Functions: consultar-dni (nombre desde RENIEC), validar-dni (contraste) y verificar-identidad (rostro + lectura del DNI)
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
