-- =====================================================================
--  ENCÁRGALO · MVP · Libro de reclamaciones virtual (ES-15)
--
--  Código de Protección y Defensa del Consumidor (Ley N° 29571) y su
--  reglamento del Libro de Reclamaciones (D.S. N° 011-2011-PCM y
--  modificatorias):
--    - Formulario público, sin necesidad de cuenta.
--    - Cada hoja tiene un número correlativo sin saltos (REC-2026-000001).
--    - El consumidor recibe una copia en su correo (Edge Function
--      libro-reclamaciones) y la ve en pantalla al enviarla.
--    - Se responde en un plazo máximo de 15 días hábiles: plazo_vence se
--      calcula al registrar, sin sábados, domingos ni feriados.
--
--  Datos personales (Ley N° 29733): el reglamento obliga a pedir nombre,
--  documento, domicilio y contacto, y a conservar la hoja al menos dos años.
--  Solo se usan para atender el reclamo. Ver borrar_reclamaciones_vencidas().
--
--  Indicador ES-15 = reclamaciones respondidas en plazo ÷ recibidas.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Días hábiles
-- ---------------------------------------------------------------------

-- Feriados nacionales. Se agregan los de cada año desde el SQL Editor.
create table if not exists feriados (
  dia     date primary key,
  nombre  text not null
);

alter table feriados enable row level security;
drop policy if exists feriados_ver on feriados;
create policy feriados_ver on feriados for select using (true);

insert into feriados (dia, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-06-07', 'Batalla de Arica y Día de la Bandera'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-23', 'Día de la Fuerza Aérea del Perú'),
  ('2026-07-28', 'Fiestas Patrias'),
  ('2026-07-29', 'Fiestas Patrias'),
  ('2026-08-06', 'Batalla de Junín'),
  ('2026-08-30', 'Santa Rosa de Lima'),
  ('2026-10-08', 'Combate de Angamos'),
  ('2026-11-01', 'Todos los Santos'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-09', 'Batalla de Ayacucho'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-03-25', 'Jueves Santo'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-06-07', 'Batalla de Arica y Día de la Bandera'),
  ('2027-06-29', 'San Pedro y San Pablo'),
  ('2027-07-23', 'Día de la Fuerza Aérea del Perú'),
  ('2027-07-28', 'Fiestas Patrias'),
  ('2027-07-29', 'Fiestas Patrias'),
  ('2027-08-06', 'Batalla de Junín'),
  ('2027-08-30', 'Santa Rosa de Lima'),
  ('2027-10-08', 'Combate de Angamos'),
  ('2027-11-01', 'Todos los Santos'),
  ('2027-12-08', 'Inmaculada Concepción'),
  ('2027-12-09', 'Batalla de Ayacucho'),
  ('2027-12-25', 'Navidad')
on conflict (dia) do nothing;

create or replace function es_dia_habil(p_dia date)
returns boolean language sql stable set search_path = public as $$
  select extract(isodow from p_dia) < 6
     and not exists (select 1 from feriados where dia = p_dia);
$$;

/** El día hábil número p_dias contado desde el siguiente a p_desde. */
create or replace function sumar_dias_habiles(p_desde date, p_dias int)
returns date language plpgsql stable set search_path = public as $$
declare
  v_dia   date := p_desde;
  v_quedan int := p_dias;
begin
  while v_quedan > 0 loop
    v_dia := v_dia + 1;
    if es_dia_habil(v_dia) then
      v_quedan := v_quedan - 1;
    end if;
  end loop;
  return v_dia;
end $$;

/** Hoy en Perú (Supabase corre en UTC: después de las 19:00 ya sería mañana). */
create or replace function hoy_lima()
returns date language sql stable as $$ select (now() at time zone 'America/Lima')::date $$;

/** Días hábiles que faltan hasta p_hasta (negativo si ya venció). */
create or replace function dias_habiles_hasta(p_hasta date)
returns int language sql stable set search_path = public as $$
  select case
    when p_hasta >= hoy_lima() then
      (select count(*)::int from generate_series(hoy_lima() + 1, p_hasta, interval '1 day') d
        where es_dia_habil(d::date))
    else
      -(select count(*)::int from generate_series(p_hasta + 1, hoy_lima(), interval '1 day') d
        where es_dia_habil(d::date))
  end;
$$;


-- ---------------------------------------------------------------------
--  2. Hojas de reclamación
-- ---------------------------------------------------------------------

-- Contador sin saltos (una secuencia deja huecos si una transacción falla,
-- y el reglamento pide numeración correlativa).
create table if not exists contador_reclamaciones (
  anio    int primary key,
  ultimo  int not null default 0
);
alter table contador_reclamaciones enable row level security;
revoke all on contador_reclamaciones from anon, authenticated;

create table if not exists reclamaciones (
  id                 uuid primary key default gen_random_uuid(),
  correlativo        text not null unique,
  creado_en          timestamptz not null default now(),
  plazo_vence        date not null,

  -- 1. Consumidor reclamante
  nombre             text not null check (length(trim(nombre)) between 3 and 120),
  documento_tipo     text not null check (documento_tipo in ('DNI', 'CE', 'Pasaporte')),
  documento_numero   text not null check (documento_numero ~ '^[A-Za-z0-9]{6,15}$'),
  domicilio          text not null check (length(trim(domicilio)) between 5 and 200),
  telefono           text check (telefono is null or telefono ~ '^[0-9 +]{6,20}$'),
  correo             text not null check (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  menor_de_edad      boolean not null default false,
  apoderado          text,   -- padre, madre o tutor si es menor de edad

  -- 2. Bien contratado
  bien_tipo          text not null check (bien_tipo in ('producto', 'servicio')),
  monto              numeric(10,2) check (monto is null or monto >= 0),
  bien_descripcion   text not null check (length(trim(bien_descripcion)) between 3 and 500),
  pedido_id          uuid references pedidos (id) on delete set null,

  -- 3. Detalle
  tipo               text not null check (tipo in ('reclamo', 'queja')),
  detalle            text not null check (length(trim(detalle)) between 10 and 3000),
  pedido_consumidor  text not null check (length(trim(pedido_consumidor)) between 3 and 1500),

  -- 4. Atención del proveedor
  estado             text not null default 'recibido'
                     check (estado in ('recibido', 'respondido')),
  respuesta          text,
  respondido_en      timestamptz,
  respondido_por     uuid references profiles (id),

  -- Quién la envió (si tenía sesión) y la copia por correo
  perfil_id          uuid references profiles (id) on delete set null,
  token_copia        uuid not null default gen_random_uuid(),
  copia_enviada_en   timestamptz,
  respuesta_enviada_en timestamptz,

  constraint apoderado_si_menor check (not menor_de_edad or length(trim(coalesce(apoderado, ''))) >= 3)
);

create index if not exists reclamaciones_estado_idx on reclamaciones (estado, plazo_vence);
create index if not exists reclamaciones_correo_idx on reclamaciones (lower(correo), creado_en desc);

comment on table reclamaciones is
  'Libro de reclamaciones virtual (Ley N° 29571). Se conserva al menos 2 años. '
  'Solo la escriben registrar_reclamacion() y admin_responder_reclamacion().';

-- Sin políticas de insert ni de update: se escribe solo por funciones.
alter table reclamaciones enable row level security;
drop policy if exists reclamacion_ver on reclamaciones;
create policy reclamacion_ver on reclamaciones
  for select using (perfil_id = auth.uid() or soy_admin());
-- El token de la copia no se expone ni al propio reclamante desde la app:
-- permiso por columnas (quitar una sola columna no basta en Postgres).
revoke all on reclamaciones from anon, authenticated;
grant select (
  id, correlativo, creado_en, plazo_vence, nombre, documento_tipo, documento_numero,
  domicilio, telefono, correo, menor_de_edad, apoderado, bien_tipo, monto,
  bien_descripcion, pedido_id, tipo, detalle, pedido_consumidor, estado, respuesta,
  respondido_en, perfil_id, copia_enviada_en, respuesta_enviada_en
) on reclamaciones to authenticated;


-- ---------------------------------------------------------------------
--  3. Registrar (formulario público)
-- ---------------------------------------------------------------------
create or replace function registrar_reclamacion(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_anio   int := extract(year from now() at time zone 'America/Lima')::int;
  v_numero int;
  v_correo text := lower(trim(coalesce(p->>'correo', '')));
  v_pedido uuid;
  v_fila   reclamaciones;
begin
  -- Freno contra envíos automáticos: 5 por correo al día y 300 en total.
  if (select count(*) from reclamaciones
       where lower(correo) = v_correo and creado_en > now() - interval '1 day') >= 5 then
    raise exception 'Ya registraste varias hojas hoy con este correo. Si necesitas agregar algo, escríbenos.';
  end if;
  if (select count(*) from reclamaciones where creado_en > now() - interval '1 day') >= 300 then
    raise exception 'El libro de reclamaciones recibió demasiadas hojas hoy. Inténtalo mañana o escríbenos por correo.';
  end if;

  -- El pedido solo se vincula si es del propio reclamante (o si participó).
  if nullif(p->>'pedido_id', '') is not null and auth.uid() is not null then
    select pe.id into v_pedido
    from pedidos pe
    where pe.id = (p->>'pedido_id')::uuid
      and (pe.cliente_id = auth.uid()
           or exists (select 1 from ofertas o where o.id = pe.oferta_aceptada_id
                       and o.comprador_id = auth.uid()));
  end if;

  insert into contador_reclamaciones (anio, ultimo) values (v_anio, 1)
  on conflict (anio) do update set ultimo = contador_reclamaciones.ultimo + 1
  returning ultimo into v_numero;

  insert into reclamaciones (
    correlativo, plazo_vence,
    nombre, documento_tipo, documento_numero, domicilio, telefono, correo,
    menor_de_edad, apoderado,
    bien_tipo, monto, bien_descripcion, pedido_id,
    tipo, detalle, pedido_consumidor, perfil_id
  ) values (
    format('REC-%s-%s', v_anio, lpad(v_numero::text, 6, '0')),
    sumar_dias_habiles(hoy_lima(), 15),
    trim(p->>'nombre'),
    coalesce(nullif(p->>'documento_tipo', ''), 'DNI'),
    upper(trim(coalesce(p->>'documento_numero', ''))),
    trim(p->>'domicilio'),
    nullif(trim(coalesce(p->>'telefono', '')), ''),
    v_correo,
    coalesce((p->>'menor_de_edad')::boolean, false),
    nullif(trim(coalesce(p->>'apoderado', '')), ''),
    coalesce(nullif(p->>'bien_tipo', ''), 'servicio'),
    nullif(p->>'monto', '')::numeric,
    trim(p->>'bien_descripcion'),
    v_pedido,
    p->>'tipo',
    trim(p->>'detalle'),
    trim(p->>'pedido_consumidor'),
    auth.uid()
  )
  returning * into v_fila;

  return jsonb_build_object(
    'id', v_fila.id,
    'correlativo', v_fila.correlativo,
    'creado_en', v_fila.creado_en,
    'plazo_vence', v_fila.plazo_vence,
    'token', v_fila.token_copia
  );
exception
  when check_violation then
    raise exception 'Revisa los datos de la hoja: falta un campo obligatorio o tiene un formato no válido';
  when invalid_text_representation then
    raise exception 'Revisa los datos de la hoja: el monto o el pedido no tienen un formato válido';
end $$;

revoke execute on function registrar_reclamacion(jsonb) from public;
grant execute on function registrar_reclamacion(jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
--  4. Panel /admin
-- ---------------------------------------------------------------------
create or replace function admin_reclamaciones(p_estado text default null)
returns table (
  id uuid, correlativo text, creado_en timestamptz, plazo_vence date,
  dias_restantes int, tipo text, estado text,
  nombre text, documento_tipo text, documento_numero text, domicilio text,
  telefono text, correo text, menor_de_edad boolean, apoderado text,
  bien_tipo text, monto numeric, bien_descripcion text, pedido_id uuid,
  detalle text, pedido_consumidor text,
  respuesta text, respondido_en timestamptz, respondido_por_nombre text,
  copia_enviada_en timestamptz, respuesta_enviada_en timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select r.id, r.correlativo, r.creado_en, r.plazo_vence,
           case when r.estado = 'recibido' then dias_habiles_hasta(r.plazo_vence) end,
           r.tipo, r.estado,
           r.nombre, r.documento_tipo, r.documento_numero, r.domicilio,
           r.telefono, r.correo, r.menor_de_edad, r.apoderado,
           r.bien_tipo, r.monto, r.bien_descripcion, r.pedido_id,
           r.detalle, r.pedido_consumidor,
           r.respuesta, r.respondido_en, pr.nombre_completo,
           r.copia_enviada_en, r.respuesta_enviada_en
    from reclamaciones r
    left join profiles pr on pr.id = r.respondido_por
    where p_estado is null or r.estado = p_estado
    order by (r.estado = 'respondido'), r.plazo_vence, r.creado_en;
end $$;

create or replace function admin_responder_reclamacion(p_id uuid, p_respuesta text)
returns reclamaciones
language plpgsql security definer set search_path = public as $$
declare
  v_fila reclamaciones;
begin
  perform exigir_admin();
  if length(trim(coalesce(p_respuesta, ''))) < 20 then
    raise exception 'Escribe una respuesta completa (al menos 20 caracteres)';
  end if;

  update reclamaciones
     set estado = 'respondido',
         respuesta = trim(p_respuesta),
         respondido_en = now(),
         respondido_por = auth.uid(),
         respuesta_enviada_en = null
   where id = p_id and estado = 'recibido'
  returning * into v_fila;
  if not found then
    raise exception 'La hoja no existe o ya fue respondida';
  end if;

  perform registrar_bitacora('reclamacion_respondida', 'reclamacion', v_fila.correlativo,
    jsonb_build_object(
      'en_plazo', (v_fila.respondido_en at time zone 'America/Lima')::date <= v_fila.plazo_vence,
      'tipo', v_fila.tipo));
  return v_fila;
end $$;

/** Indicador ES-15 para el panel. */
create or replace function admin_indicador_reclamaciones()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  perform exigir_admin();
  select jsonb_build_object(
    'recibidas', count(*),
    'respondidas', count(*) filter (where estado = 'respondido'),
    'en_plazo', count(*) filter (where estado = 'respondido'
                  and (respondido_en at time zone 'America/Lima')::date <= plazo_vence),
    'pendientes', count(*) filter (where estado = 'recibido'),
    'vencidas', count(*) filter (where estado = 'recibido' and plazo_vence < hoy_lima())
  ) into v from reclamaciones;
  return v;
end $$;

revoke execute on function admin_reclamaciones(text) from public, anon;
revoke execute on function admin_responder_reclamacion(uuid, text) from public, anon;
revoke execute on function admin_indicador_reclamaciones() from public, anon;
grant execute on function admin_reclamaciones(text) to authenticated;
grant execute on function admin_responder_reclamacion(uuid, text) to authenticated;
grant execute on function admin_indicador_reclamaciones() to authenticated;


-- ---------------------------------------------------------------------
--  5. Retención: a los dos años se borran los datos del reclamante
-- ---------------------------------------------------------------------
create or replace function borrar_reclamaciones_vencidas()
returns int language sql security definer set search_path = public as $$
  with borradas as (
    delete from reclamaciones
    where estado = 'respondido' and respondido_en < now() - interval '2 years'
    returning 1
  )
  select count(*)::int from borradas;
$$;

revoke execute on function borrar_reclamaciones_vencidas() from public, anon, authenticated;
