-- =====================================================================
--  ENCÁRGALO · MVP · Libro de reclamaciones virtual (acción ES-15)
--
--  Código de Protección y Defensa del Consumidor (Ley N° 29571, art. 150)
--  y su Reglamento del Libro de Reclamaciones (D.S. N° 011-2011-PCM y
--  modificatorias): el proveedor debe tener un libro virtual con hojas
--  numeradas correlativamente, entregar al consumidor constancia de su
--  reclamo y responderlo en un plazo no mayor de 15 días hábiles.
--
--  · Cualquier persona puede registrar una hoja, con o sin cuenta.
--  · El número correlativo (LR-2026-000001) lo genera la base, nunca la app.
--  · Solo los administradores leen las hojas y registran la respuesta.
--  · Datos personales (Ley N° 29733): solo lo que pide el formato oficial.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Feriados nacionales, para contar días hábiles
--  Los fijos se cargan para 2026-2028; Jueves y Viernes Santo cambian cada
--  año. Hay que agregar los del año siguiente (y los feriados que el
--  Gobierno declare) antes de que empiece.
-- ---------------------------------------------------------------------
create table if not exists feriados (
  fecha  date primary key,
  nombre text not null
);

alter table feriados enable row level security;
drop policy if exists feriados_leer on feriados;
create policy feriados_leer on feriados for select using (true);

insert into feriados (fecha, nombre)
select make_date(a, f.mes, f.dia), f.nombre
from generate_series(2026, 2028) as a,
     (values
       (1, 1,   'Año Nuevo'),
       (5, 1,   'Día del Trabajo'),
       (6, 7,   'Batalla de Arica y Día de la Bandera'),
       (6, 29,  'San Pedro y San Pablo'),
       (7, 23,  'Día de la Fuerza Aérea del Perú'),
       (7, 28,  'Fiestas Patrias'),
       (7, 29,  'Fiestas Patrias'),
       (8, 6,   'Batalla de Junín'),
       (8, 30,  'Santa Rosa de Lima'),
       (10, 8,  'Combate de Angamos'),
       (11, 1,  'Día de Todos los Santos'),
       (12, 8,  'Inmaculada Concepción'),
       (12, 9,  'Batalla de Ayacucho'),
       (12, 25, 'Navidad')
     ) as f(mes, dia, nombre)
on conflict (fecha) do nothing;

insert into feriados (fecha, nombre) values
  ('2026-04-02', 'Jueves Santo'), ('2026-04-03', 'Viernes Santo'),
  ('2027-03-25', 'Jueves Santo'), ('2027-03-26', 'Viernes Santo'),
  ('2028-04-13', 'Jueves Santo'), ('2028-04-14', 'Viernes Santo')
on conflict (fecha) do nothing;

create or replace function es_dia_habil(p_dia date)
returns boolean language sql stable set search_path = public as $$
  select extract(isodow from p_dia) < 6
     and not exists (select 1 from feriados where fecha = p_dia);
$$;

-- p_dias días hábiles después de p_desde (el día de registro no cuenta).
create or replace function sumar_dias_habiles(p_desde date, p_dias int)
returns date language plpgsql stable set search_path = public as $$
declare
  v_dia   date := p_desde;
  v_resto int  := greatest(coalesce(p_dias, 0), 0);
begin
  while v_resto > 0 loop
    v_dia := v_dia + 1;
    if es_dia_habil(v_dia) then
      v_resto := v_resto - 1;
    end if;
  end loop;
  return v_dia;
end $$;

-- Días hábiles de p_desde (excluido) a p_hasta (incluido). Negativo si
-- p_hasta ya pasó: cuántos días hábiles lleva vencido.
create or replace function dias_habiles_entre(p_desde date, p_hasta date)
returns int language sql stable set search_path = public as $$
  select case
    when p_hasta >= p_desde then
      (select count(*)::int from generate_series(p_desde + 1, p_hasta, interval '1 day') d
        where es_dia_habil(d::date))
    else
      -(select count(*)::int from generate_series(p_hasta + 1, p_desde, interval '1 day') d
         where es_dia_habil(d::date))
  end;
$$;

-- Hoy en el Perú: la base corre en UTC y después de las 19:00 ya sería mañana.
create or replace function hoy_peru()
returns date language sql stable as $$
  select (now() at time zone 'America/Lima')::date;
$$;

-- El plazo de respuesta (15 días hábiles) lo fija la norma, no el negocio:
-- por eso no vive en `config`, donde el panel podría cambiarlo.


-- ---------------------------------------------------------------------
--  Hojas de reclamación
-- ---------------------------------------------------------------------
create table if not exists reclamaciones_contador (
  anio   int primary key,
  ultimo int not null default 0
);
-- Sin políticas: solo lo toca el trigger de numeración.
alter table reclamaciones_contador enable row level security;

create table if not exists reclamaciones (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null unique,            -- LR-2026-000001
  creado_en          timestamptz not null default now(),
  perfil_id          uuid references profiles(id) on delete set null,  -- si tenía sesión

  -- 1. Identificación del consumidor reclamante
  nombre             text not null check (length(trim(nombre)) between 3 and 150),
  tipo_documento     text not null default 'DNI'
                     check (tipo_documento in ('DNI', 'CE', 'Pasaporte')),
  numero_documento   text not null check (numero_documento ~ '^[A-Za-z0-9]{6,15}$'),
  domicilio          text not null check (length(trim(domicilio)) between 5 and 250),
  telefono           text check (telefono is null or telefono ~ '^[0-9 +-]{6,20}$'),
  correo             text not null check (correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  menor_de_edad      boolean not null default false,
  apoderado          text,                            -- padre, madre o tutor si es menor

  -- 2. Identificación del bien contratado
  bien_tipo          text not null check (bien_tipo in ('producto', 'servicio')),
  bien_descripcion   text not null check (length(trim(bien_descripcion)) between 3 and 500),
  monto              numeric(10,2) check (monto is null or monto >= 0),
  codigo_pedido      text check (codigo_pedido is null or length(codigo_pedido) <= 60),

  -- 3. Detalle de la reclamación y pedido del consumidor
  tipo               text not null check (tipo in ('reclamo', 'queja')),
  detalle            text not null check (length(trim(detalle)) between 10 and 3000),
  pedido_consumidor  text not null check (length(trim(pedido_consumidor)) between 5 and 2000),
  acepta_tratamiento boolean not null check (acepta_tratamiento),

  -- 4. Observaciones y acciones adoptadas por el proveedor
  vence_en           date not null,
  estado             text not null default 'pendiente'
                     check (estado in ('pendiente', 'respondido')),
  respuesta          text,
  respondido_en      timestamptz,
  respondido_por     uuid references profiles(id) on delete set null,

  constraint reclamaciones_apoderado_menor
    check (not menor_de_edad or length(trim(coalesce(apoderado, ''))) >= 3)
);

create index if not exists reclamaciones_estado_idx
  on reclamaciones (estado, vence_en);
create index if not exists reclamaciones_documento_idx
  on reclamaciones (numero_documento, creado_en desc);

comment on table reclamaciones is
  'Libro de reclamaciones virtual (Ley N° 29571, D.S. N° 011-2011-PCM). '
  'Cualquiera inserta; solo los administradores leen y responden.';


-- Al registrar: número correlativo, plazo y campos que no elige quien
-- escribe. security definer porque nadie tiene permiso sobre el contador.
create or replace function fn_numerar_reclamacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_hoy  date := hoy_peru();
  v_anio int  := extract(year from v_hoy)::int;
  v_n    int;
begin
  -- Freno contra el abuso del formulario público.
  if (select count(*) from reclamaciones
       where numero_documento = upper(trim(new.numero_documento))
         and creado_en > now() - interval '1 hour') >= 5 then
    raise exception 'Ya registraste varias hojas en la última hora. Si necesitas agregar algo, espera un momento o escríbenos.';
  end if;

  insert into reclamaciones_contador (anio, ultimo) values (v_anio, 1)
  on conflict (anio) do update set ultimo = reclamaciones_contador.ultimo + 1
  returning ultimo into v_n;

  new.id               := gen_random_uuid();
  new.numero           := format('LR-%s-%s', v_anio, lpad(v_n::text, 6, '0'));
  new.creado_en        := now();
  new.perfil_id        := auth.uid();
  new.nombre           := trim(new.nombre);
  new.numero_documento := upper(trim(new.numero_documento));
  new.correo           := lower(trim(new.correo));
  new.apoderado        := case when new.menor_de_edad then trim(new.apoderado) end;
  new.vence_en         := sumar_dias_habiles(v_hoy, 15);
  new.estado           := 'pendiente';
  new.respuesta        := null;
  new.respondido_en    := null;
  new.respondido_por   := null;
  return new;
end $$;

drop trigger if exists tr_numerar_reclamacion on reclamaciones;
create trigger tr_numerar_reclamacion
  before insert on reclamaciones
  for each row execute function fn_numerar_reclamacion();

-- La hoja no se edita: solo se responde, y por admin_responder_reclamacion.
-- Lo que escribió el consumidor queda tal cual aunque un UPDATE lo toque.
create or replace function fn_proteger_reclamacion()
returns trigger language plpgsql set search_path = public as $$
declare
  v_respuesta text        := new.respuesta;
  v_estado    text        := new.estado;
  v_en        timestamptz := new.respondido_en;
  v_por       uuid        := new.respondido_por;
begin
  if coalesce(current_setting('app.admin_autorizado', true), '0') <> '1' then
    raise exception 'Una hoja de reclamación no se modifica; se responde desde el panel';
  end if;
  new := old;
  new.respuesta      := v_respuesta;
  new.estado         := v_estado;
  new.respondido_en  := v_en;
  new.respondido_por := v_por;
  return new;
end $$;

drop trigger if exists tr_proteger_reclamacion on reclamaciones;
create trigger tr_proteger_reclamacion
  before update on reclamaciones
  for each row execute function fn_proteger_reclamacion();


-- ---------------------------------------------------------------------
--  Seguridad a nivel de fila
--  Cualquiera (con o sin sesión) inserta; solo el administrador lee y
--  actualiza. Nadie borra: es un registro legal.
-- ---------------------------------------------------------------------
alter table reclamaciones enable row level security;

drop policy if exists reclamacion_crear on reclamaciones;
create policy reclamacion_crear on reclamaciones
  for insert to anon, authenticated
  with check (true);

drop policy if exists reclamacion_ver_admin on reclamaciones;
create policy reclamacion_ver_admin on reclamaciones
  for select to authenticated
  using (soy_admin());

drop policy if exists reclamacion_responder_admin on reclamaciones;
create policy reclamacion_responder_admin on reclamaciones
  for update to authenticated
  using (soy_admin())
  with check (soy_admin());


-- ---------------------------------------------------------------------
--  Registrar una hoja desde el formulario público
--  Con la política de arriba bastaría un insert, pero quien no es
--  administrador no puede leer la fila de vuelta, y necesita su número.
--  Esta función inserta y devuelve solo la constancia.
-- ---------------------------------------------------------------------
create or replace function presentar_reclamacion(
  p_nombre             text,
  p_tipo_documento     text,
  p_numero_documento   text,
  p_domicilio          text,
  p_telefono           text,
  p_correo             text,
  p_menor_de_edad      boolean,
  p_apoderado          text,
  p_bien_tipo          text,
  p_bien_descripcion   text,
  p_monto              numeric,
  p_codigo_pedido      text,
  p_tipo               text,
  p_detalle            text,
  p_pedido_consumidor  text,
  p_acepta_tratamiento boolean
) returns table (numero text, creado_en timestamptz, vence_en date)
language plpgsql security definer set search_path = public as $$
declare v_fila reclamaciones;
begin
  if not coalesce(p_acepta_tratamiento, false) then
    raise exception 'Para registrar la hoja necesitamos tu autorización para usar estos datos solo para atenderla';
  end if;

  insert into reclamaciones (
    numero, nombre, tipo_documento, numero_documento, domicilio, telefono, correo,
    menor_de_edad, apoderado, bien_tipo, bien_descripcion, monto, codigo_pedido,
    tipo, detalle, pedido_consumidor, acepta_tratamiento, vence_en
  ) values (
    '', p_nombre, coalesce(p_tipo_documento, 'DNI'), p_numero_documento, trim(p_domicilio),
    nullif(trim(coalesce(p_telefono, '')), ''), p_correo,
    coalesce(p_menor_de_edad, false), p_apoderado,
    p_bien_tipo, trim(p_bien_descripcion), p_monto,
    nullif(trim(coalesce(p_codigo_pedido, '')), ''),
    p_tipo, trim(p_detalle), trim(p_pedido_consumidor), true,
    hoy_peru()  -- el trigger lo reemplaza por el plazo real
  )
  returning * into v_fila;

  -- TODO(ES-15): enviar al correo del consumidor la constancia con el número
  -- y la copia de la hoja (lo pide el reglamento). El proyecto todavía no
  -- tiene un mecanismo de envío de correos; mientras tanto la app muestra el
  -- número en pantalla para que lo guarde o lo comparta.

  return query select v_fila.numero, v_fila.creado_en, v_fila.vence_en;
end $$;

revoke execute on function presentar_reclamacion(
  text, text, text, text, text, text, boolean, text, text, text, numeric, text,
  text, text, text, boolean
) from public;
grant execute on function presentar_reclamacion(
  text, text, text, text, text, text, boolean, text, text, text, numeric, text,
  text, text, text, boolean
) to anon, authenticated;


-- ---------------------------------------------------------------------
--  Panel /admin
-- ---------------------------------------------------------------------
create or replace function admin_reclamaciones(p_estado text default null)
returns table (
  id                uuid,
  numero            text,
  creado_en         timestamptz,
  nombre            text,
  tipo_documento    text,
  numero_documento  text,
  domicilio         text,
  telefono          text,
  correo            text,
  menor_de_edad     boolean,
  apoderado         text,
  bien_tipo         text,
  bien_descripcion  text,
  monto             numeric,
  codigo_pedido     text,
  tipo              text,
  detalle           text,
  pedido_consumidor text,
  vence_en          date,
  dias_restantes    int,      -- días hábiles; negativo = vencido
  estado            text,
  respuesta         text,
  respondido_en     timestamptz,
  respondido_por    text
) language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select r.id, r.numero, r.creado_en, r.nombre, r.tipo_documento, r.numero_documento,
           r.domicilio, r.telefono, r.correo, r.menor_de_edad, r.apoderado,
           r.bien_tipo, r.bien_descripcion, r.monto, r.codigo_pedido,
           r.tipo, r.detalle, r.pedido_consumidor, r.vence_en,
           dias_habiles_entre(hoy_peru(), r.vence_en),
           r.estado, r.respuesta, r.respondido_en, a.nombre_completo
    from reclamaciones r
    left join profiles a on a.id = r.respondido_por
    where p_estado is null or p_estado = '' or r.estado = p_estado
    -- Primero lo pendiente que vence antes; lo respondido al final.
    order by (r.estado = 'respondido'), r.vence_en, r.creado_en
    limit 500;
end $$;

create or replace function admin_responder_reclamacion(p_id uuid, p_respuesta text)
returns void language plpgsql security definer set search_path = public as $$
declare v_fila reclamaciones;
begin
  perform exigir_admin();

  if length(trim(coalesce(p_respuesta, ''))) < 20 then
    raise exception 'Escribe la respuesta completa al consumidor (mínimo 20 caracteres)';
  end if;

  select * into v_fila from reclamaciones where id = p_id for update;
  if not found then
    raise exception 'Esa hoja de reclamación no existe';
  end if;

  perform set_config('app.admin_autorizado', '1', true);
  update reclamaciones
     set respuesta      = trim(p_respuesta),
         estado         = 'respondido',
         respondido_en  = now(),
         respondido_por = auth.uid()
   where id = p_id;
  perform set_config('app.admin_autorizado', '0', true);

  perform registrar_bitacora('reclamacion_respondida', 'reclamacion', v_fila.numero,
    jsonb_build_object('tipo', v_fila.tipo, 'reclamacion_id', v_fila.id,
                       'fuera_de_plazo', hoy_peru() > v_fila.vence_en));

  -- TODO(ES-15): enviar la respuesta al correo del consumidor (v_fila.correo)
  -- cuando el proyecto tenga envío de correos. Hasta entonces el
  -- administrador la envía a mano desde el correo de soporte.
end $$;
