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
pagos por confirmar y disputas abiertas.

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
del documento van a un bucket privado y, al aprobarse la verificación, la app descarta
sus rutas para que el equipo pueda borrarlas. Es lo que exige la Ley N° 29733.

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

### 6. Generar el APK para repartir

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
    pedido/[id].tsx       Detalle: ofertas, pago, seguimiento, chat, calificación
    (app)/                Pestañas para sesión iniciada
      pedidos.tsx         Mis pedidos (lado cliente)
      explorar.tsx        Pedidos abiertos (lado comprador externo)
      entregas.tsx        Pedidos que estoy trayendo
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
```

## Estado actual y qué falta

| Módulo | Estado |
|---|---|
| Registro, verificación, pedidos, ofertas, escrow, seguimiento, chat, calificación, disputas | Operativo |
| Consola del equipo | Operativa |
| Validación de DNI contra RENIEC | Manual. Queda pendiente contratar el proveedor |
| Pasarela de pagos | Manual. Requiere RUC y afiliación comercial |
| Notificaciones push | Pendiente |
| Versión iOS | Fuera del alcance del MVP, prevista para T1 2027 |
