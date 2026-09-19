-- =====================================================================
--  ENCÁRGALO · MVP · Esquema de base de datos
--  Ejecutar en el SQL Editor de Supabase, en orden: 0001, 0002, 0003, 0004
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type estado_verificacion as enum (
    'pendiente',      -- aún no envió documentos
    'en_revision',    -- envió DNI y selfie, falta validar
    'verificado',
    'rechazado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pedido as enum (
    'publicado',      -- visible para compradores externos
    'aceptado',       -- el cliente eligió una oferta, falta pagar
    'pagado',         -- dinero retenido por la plataforma (escrow)
    'comprado',       -- el comprador externo ya compró el producto
    'en_viaje',
    'entregado',      -- el comprador externo marcó la entrega
    'confirmado',     -- el cliente confirmó: se libera el pago
    'en_disputa',
    'cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_oferta as enum ('enviada', 'aceptada', 'rechazada', 'retirada');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'pendiente'  el cliente aún no reporta el pago
  -- 'en_revision' subió comprobante, el equipo lo valida
  -- 'retenido'   dinero confirmado y bloqueado por la plataforma
  -- 'liberado'   transferido al comprador externo
  -- 'reembolsado' devuelto al cliente tras una disputa
  create type estado_pago as enum
    ('pendiente', 'en_revision', 'retenido', 'liberado', 'reembolsado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type metodo_pago as enum ('yape', 'plin', 'transferencia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_disputa as enum
    ('abierta', 'en_revision', 'resuelta_cliente', 'resuelta_comprador');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
--  Configuración del negocio (tarifas sin quemar en el código)
-- ---------------------------------------------------------------------
create table if not exists config (
  clave        text primary key,
  valor        numeric not null,
  descripcion  text not null
);

comment on table config is
  'Tarifas del modelo de negocio. Cambiarlas aquí recalcula todo pago nuevo.';


-- ---------------------------------------------------------------------
--  Perfiles (extiende auth.users)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nombre_completo     text        not null default '',
  telefono            text,
  ciudad              text        not null default 'Chiclayo',
  es_cliente          boolean     not null default true,
  es_comprador        boolean     not null default false,
  dni                 text,
  verificacion        estado_verificacion not null default 'pendiente',
  dni_frente_path     text,
  selfie_path         text,
  verificado_en       timestamptz,
  motivo_rechazo      text,
  creado_en           timestamptz not null default now(),
  constraint dni_formato check (dni is null or dni ~ '^[0-9]{8}$')
);

create unique index if not exists profiles_dni_unico
  on profiles (dni) where dni is not null;

comment on column profiles.dni is
  'Solo se guarda el número. Las imágenes del DNI se eliminan tras la validación '
  '(retención mínima, Ley N° 29733).';


-- ---------------------------------------------------------------------
--  Operadores: los miembros del equipo que validan pagos y verificaciones.
--  Durante el piloto el escrow se opera a mano, y esta tabla es la que
--  define quién tiene permiso para hacerlo. Se llena desde el panel de
--  Supabase, nunca desde la app.
-- ---------------------------------------------------------------------
create table if not exists operadores (
  perfil_id uuid primary key references profiles(id) on delete cascade,
  nombre    text not null default '',
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Pedidos
-- ---------------------------------------------------------------------
create table if not exists pedidos (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references profiles(id) on delete cascade,
  titulo              text not null check (length(trim(titulo)) between 3 and 120),
  descripcion         text not null default '',
  url_producto        text,
  imagen_path         text,
  categoria           text not null default 'otros',
  cantidad            int  not null default 1 check (cantidad between 1 and 20),
  ciudad_entrega      text not null default 'Chiclayo',
  fecha_limite        date not null,
  valor_referencial   numeric(10,2) check (valor_referencial is null
                                           or valor_referencial > 0),
  estado              estado_pedido not null default 'publicado',
  oferta_aceptada_id  uuid,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);

create index if not exists pedidos_estado_idx      on pedidos (estado, creado_en desc);
create index if not exists pedidos_cliente_idx     on pedidos (cliente_id, creado_en desc);


-- ---------------------------------------------------------------------
--  Ofertas
-- ---------------------------------------------------------------------
create table if not exists ofertas (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null references pedidos(id) on delete cascade,
  comprador_id        uuid not null references profiles(id) on delete cascade,
  precio_final        numeric(10,2) not null check (precio_final > 0),
  fecha_entrega       date not null,
  nota                text not null default '',
  estado              estado_oferta not null default 'enviada',
  creado_en           timestamptz not null default now()
);

-- Un comprador externo solo puede tener una oferta viva por pedido
create unique index if not exists ofertas_una_por_comprador
  on ofertas (pedido_id, comprador_id) where estado in ('enviada', 'aceptada');

create index if not exists ofertas_pedido_idx on ofertas (pedido_id, creado_en);

alter table pedidos
  drop constraint if exists pedidos_oferta_aceptada_fk;
alter table pedidos
  add constraint pedidos_oferta_aceptada_fk
  foreign key (oferta_aceptada_id) references ofertas(id) on delete set null;


-- ---------------------------------------------------------------------
--  Pagos (escrow)
-- ---------------------------------------------------------------------
create table if not exists pagos (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null unique references pedidos(id) on delete cascade,
  oferta_id           uuid not null references ofertas(id) on delete cascade,
  cliente_id          uuid not null references profiles(id),
  comprador_id        uuid not null references profiles(id),

  -- Desglose que ve el cliente antes de pagar (sin sorpresas posteriores)
  monto_encargo       numeric(10,2) not null,  -- precio final de la oferta
  comision_cliente    numeric(10,2) not null,  -- 10 % sobre el encargo
  cargo_procesamiento numeric(10,2) not null,  -- 2.9 % del total cobrado
  total_cobrado       numeric(10,2) not null,  -- lo que paga el cliente

  -- Lo que finalmente recibe el comprador externo
  tarifa_comprador    numeric(10,2) not null,  -- 3 % sobre el encargo
  monto_liberado      numeric(10,2) not null,  -- encargo − tarifa

  metodo              metodo_pago,
  codigo_operacion    text,
  comprobante_path    text,
  estado              estado_pago not null default 'pendiente',
  reportado_en        timestamptz,
  retenido_en         timestamptz,
  liberado_en         timestamptz,
  creado_en           timestamptz not null default now()
);

create index if not exists pagos_estado_idx on pagos (estado, creado_en desc);


-- ---------------------------------------------------------------------
--  Bitácora de estados del pedido
-- ---------------------------------------------------------------------
create table if not exists eventos_pedido (
  id            bigserial primary key,
  pedido_id     uuid not null references pedidos(id) on delete cascade,
  actor_id      uuid references profiles(id),
  estado_previo estado_pedido,
  estado_nuevo  estado_pedido not null,
  nota          text not null default '',
  creado_en     timestamptz not null default now()
);

create index if not exists eventos_pedido_idx on eventos_pedido (pedido_id, creado_en);


-- ---------------------------------------------------------------------
--  Chat interno (sin intercambiar números personales)
-- ---------------------------------------------------------------------
create table if not exists mensajes (
  id          bigserial primary key,
  pedido_id   uuid not null references pedidos(id) on delete cascade,
  emisor_id   uuid not null references profiles(id) on delete cascade,
  cuerpo      text not null check (length(trim(cuerpo)) between 1 and 1000),
  creado_en   timestamptz not null default now()
);

create index if not exists mensajes_pedido_idx on mensajes (pedido_id, creado_en);


-- ---------------------------------------------------------------------
--  Calificación mutua
-- ---------------------------------------------------------------------
create table if not exists calificaciones (
  id            bigserial primary key,
  pedido_id     uuid not null references pedidos(id) on delete cascade,
  califica_id   uuid not null references profiles(id) on delete cascade,
  calificado_id uuid not null references profiles(id) on delete cascade,
  puntaje       int  not null check (puntaje between 1 and 5),
  comentario    text not null default '',
  creado_en     timestamptz not null default now(),
  unique (pedido_id, califica_id)
);

create index if not exists calificaciones_calificado_idx
  on calificaciones (calificado_id);


-- ---------------------------------------------------------------------
--  Disputas
-- ---------------------------------------------------------------------
create table if not exists disputas (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references pedidos(id) on delete cascade,
  abierta_por   uuid not null references profiles(id),
  motivo        text not null check (length(trim(motivo)) >= 10),
  evidencia_path text,
  estado        estado_disputa not null default 'abierta',
  resolucion    text,
  creado_en     timestamptz not null default now(),
  resuelta_en   timestamptz
);

create index if not exists disputas_estado_idx on disputas (estado, creado_en);


-- ---------------------------------------------------------------------
--  Vista de reputación pública
--  Es el motor de reputación: el dato que hace que un cliente elija a un
--  comprador externo que no es el más barato.
-- ---------------------------------------------------------------------
create or replace view v_reputacion as
with entregas as (
  select
    o.comprador_id,
    count(*) filter (where p.estado = 'confirmado')                     as cumplidos,
    count(*) filter (where p.estado in ('confirmado','cancelado','en_disputa')) as cerrados,
    count(*) filter (
      where p.estado = 'confirmado'
        and exists (
          select 1 from eventos_pedido e
          where e.pedido_id = p.id
            and e.estado_nuevo = 'entregado'
            and e.creado_en::date <= o.fecha_entrega
        )
    ) as puntuales
  from ofertas o
  join pedidos p on p.oferta_aceptada_id = o.id
  where o.estado = 'aceptada'
  group by o.comprador_id
),
notas as (
  select calificado_id, avg(puntaje)::numeric(3,2) as promedio, count(*) as total
  from calificaciones
  group by calificado_id
)
select
  pr.id                                                as perfil_id,
  pr.nombre_completo,
  pr.ciudad,
  pr.verificacion,
  coalesce(e.cumplidos, 0)                             as pedidos_cumplidos,
  case when coalesce(e.cerrados, 0) = 0 then null
       else round(100.0 * e.cumplidos / e.cerrados)    end as tasa_cumplimiento,
  case when coalesce(e.cumplidos, 0) = 0 then null
       else round(100.0 * e.puntuales / e.cumplidos)   end as puntualidad,
  n.promedio                                           as calificacion,
  coalesce(n.total, 0)                                 as total_calificaciones,
  (current_date - pr.creado_en::date)                  as antiguedad_dias
from profiles pr
left join entregas e on e.comprador_id = pr.id
left join notas    n on n.calificado_id = pr.id;

comment on view v_reputacion is
  'Métricas públicas de reputación. No expone teléfono, DNI ni correo.';


-- ---------------------------------------------------------------------
--  Almacenamiento
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false),   -- DNI y selfies: NUNCA público
       ('comprobantes', 'comprobantes', false),
       ('productos', 'productos', true)       -- fotos de productos: sí público
on conflict (id) do nothing;
