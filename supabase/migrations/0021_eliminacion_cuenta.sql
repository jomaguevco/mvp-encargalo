-- =====================================================================
--  ENCÁRGALO · MVP · Eliminación de la cuenta a pedido del titular
--
--  Lo exige Google Play (política de datos de usuario: la app debe ofrecer
--  eliminar la cuenta desde dentro y desde una página web) y es el derecho
--  de cancelación de la Ley N° 29733.
--
--  No se borra al instante: cada pedido entra a una cola que el
--  administrador revisa en /admin/eliminaciones. Así no se pierde dinero
--  retenido ni una disputa abierta, y lo que la ley obliga a conservar se
--  conserva:
--
--  · Se borra o anonimiza: nombre, celular, DNI, foto de perfil, rutas de
--    documentos y la posibilidad de entrar (la cuenta queda suspendida; el
--    usuario de Supabase Auth se borra a mano, ver más abajo).
--  · Se conserva, ligado a «Cuenta eliminada»: pedidos, pagos, ofertas,
--    mensajes, calificaciones y disputas ya cerrados (respaldo contable y
--    tributario, y reputación de la otra parte), la bitácora del equipo y
--    las hojas del libro de reclamaciones.
--  · No se elimina mientras haya pedidos en curso, pagos por confirmar o
--    retenidos, o disputas abiertas: la solicitud queda «en espera».
-- =====================================================================

create table if not exists solicitudes_eliminacion (
  id            uuid primary key default gen_random_uuid(),
  creado_en     timestamptz not null default now(),
  origen        text not null check (origen in ('app', 'web')),
  perfil_id     uuid references profiles(id) on delete set null,   -- desde la app
  correo        text not null check (correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  dni           text check (dni is null or dni ~ '^[0-9]{8}$'),
  motivo        text check (motivo is null or length(motivo) <= 1000),
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'en_espera', 'completada', 'rechazada')),
  nota          text,
  resuelta_en   timestamptz,
  resuelta_por  uuid references profiles(id) on delete set null
);

create index if not exists solicitudes_eliminacion_estado_idx
  on solicitudes_eliminacion (estado, creado_en);

-- Una sola solicitud abierta por cuenta.
create unique index if not exists solicitudes_eliminacion_una_abierta
  on solicitudes_eliminacion (perfil_id)
  where perfil_id is not null and estado in ('pendiente', 'en_espera');

comment on table solicitudes_eliminacion is
  'Cola de solicitudes de eliminación de cuenta (Google Play, Ley N° 29733). '
  'La crean las funciones solicitar_*; la resuelve el administrador.';

alter table solicitudes_eliminacion enable row level security;

-- El titular ve las suyas (la app muestra «solicitud en curso»).
drop policy if exists eliminacion_ver_propia on solicitudes_eliminacion;
create policy eliminacion_ver_propia on solicitudes_eliminacion
  for select to authenticated
  using (perfil_id = auth.uid() or soy_admin());
-- Sin políticas de insert ni de update: todo pasa por las funciones.


-- Freno contra el abuso del formulario público.
create or replace function fn_freno_eliminacion(p_correo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from solicitudes_eliminacion
       where correo = lower(trim(p_correo))
         and creado_en > now() - interval '1 day') >= 3 then
    raise exception 'Ya recibimos varias solicitudes con ese correo hoy. Las estamos revisando.';
  end if;
end $$;

revoke execute on function fn_freno_eliminacion(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
--  Desde la app: la cuenta con sesión
-- ---------------------------------------------------------------------
create or replace function solicitar_eliminacion_cuenta(p_motivo text default null)
returns solicitudes_eliminacion
language plpgsql security definer set search_path = public as $$
declare
  v_correo text;
  v_dni    text;
  v_fila   solicitudes_eliminacion;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para pedir la eliminación de tu cuenta, o usa el formulario web';
  end if;

  select * into v_fila from solicitudes_eliminacion
   where perfil_id = auth.uid() and estado in ('pendiente', 'en_espera');
  if found then
    return v_fila;   -- ya hay una en curso: no se duplica
  end if;

  select email into v_correo from auth.users where id = auth.uid();
  select dni into v_dni from profiles where id = auth.uid();

  insert into solicitudes_eliminacion (origen, perfil_id, correo, dni, motivo)
  values ('app', auth.uid(), lower(coalesce(v_correo, 'sin-correo@encargalo.invalid')), v_dni,
          nullif(trim(coalesce(p_motivo, '')), ''))
  returning * into v_fila;
  return v_fila;
end $$;

revoke execute on function solicitar_eliminacion_cuenta(text) from public, anon;
grant execute on function solicitar_eliminacion_cuenta(text) to authenticated;


-- ---------------------------------------------------------------------
--  Desde la web, sin sesión: correo de la cuenta + DNI
--  No se vincula a ninguna cuenta aquí (si no, cualquiera podría pedir
--  borrar la de otro). El administrador comprueba que el correo y el DNI
--  son de la misma cuenta antes de actuar.
-- ---------------------------------------------------------------------
create or replace function solicitar_eliminacion_publica(
  p_correo text, p_dni text, p_motivo text default null
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_en timestamptz;
begin
  perform fn_freno_eliminacion(p_correo);
  insert into solicitudes_eliminacion (origen, correo, dni, motivo)
  values ('web', lower(trim(p_correo)), nullif(trim(coalesce(p_dni, '')), ''),
          nullif(trim(coalesce(p_motivo, '')), ''))
  returning creado_en into v_en;
  -- No dice si la cuenta existe: así el formulario no sirve para averiguar
  -- quién está registrado.
  return v_en;
end $$;

revoke execute on function solicitar_eliminacion_publica(text, text, text) from public;
grant execute on function solicitar_eliminacion_publica(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
--  Panel /admin
-- ---------------------------------------------------------------------
-- La cuenta a la que corresponde una solicitud: la que la pidió desde la
-- app, o la que tiene a la vez ese correo y ese DNI.
create or replace function fn_cuenta_de_solicitud(p_solicitud solicitudes_eliminacion)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    p_solicitud.perfil_id,
    (select p.id from profiles p join auth.users u on u.id = p.id
      where lower(u.email) = p_solicitud.correo
        and p_solicitud.dni is not null and p.dni = p_solicitud.dni
      limit 1));
$$;

revoke execute on function fn_cuenta_de_solicitud(solicitudes_eliminacion) from public, anon, authenticated;

create or replace function admin_solicitudes_eliminacion(p_estado text default null)
returns table (
  id                uuid,
  creado_en         timestamptz,
  origen            text,
  correo            text,
  dni               text,
  motivo            text,
  estado            text,
  nota              text,
  resuelta_en       timestamptz,
  resuelta_por      text,
  cuenta_id         uuid,
  cuenta_nombre     text,
  pedidos_en_curso  bigint,
  pagos_en_curso    bigint,
  disputas_abiertas bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    with base as (
      select s.*, fn_cuenta_de_solicitud(s) as cuenta
      from solicitudes_eliminacion s
      where p_estado is null or p_estado = '' or s.estado = p_estado
    )
    select b.id, b.creado_en, b.origen, b.correo, b.dni, b.motivo, b.estado, b.nota,
           b.resuelta_en, a.nombre_completo, b.cuenta, c.nombre_completo,
           (select count(*) from pedidos pe
             where (pe.cliente_id = b.cuenta or exists (
                     select 1 from pagos g where g.pedido_id = pe.id and g.comprador_id = b.cuenta))
               and pe.estado not in ('publicado', 'confirmado', 'cancelado')),
           (select count(*) from pagos g
             where (g.cliente_id = b.cuenta or g.comprador_id = b.cuenta)
               and g.estado in ('en_revision', 'retenido')),
           (select count(*) from disputas d join pedidos pe on pe.id = d.pedido_id
             left join pagos g on g.pedido_id = pe.id
             where (pe.cliente_id = b.cuenta or g.comprador_id = b.cuenta)
               and d.estado in ('abierta', 'en_revision'))
    from base b
    left join profiles a on a.id = b.resuelta_por
    left join profiles c on c.id = b.cuenta
    order by (b.estado in ('completada', 'rechazada')), b.creado_en
    limit 500;
end $$;

-- p_estado: 'en_espera' (tiene operaciones pendientes), 'rechazada' (los
-- datos no corresponden a ninguna cuenta, por ejemplo) o 'completada'
-- (anonimiza la cuenta). Devuelve la ruta de la foto para que la app borre
-- el archivo del bucket, como admin_quitar_foto.
create or replace function admin_resolver_eliminacion(
  p_id uuid, p_estado text, p_nota text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_sol    solicitudes_eliminacion;
  v_cuenta uuid;
  v_foto   text;
  v_activos bigint;
begin
  perform exigir_admin();

  if p_estado not in ('en_espera', 'completada', 'rechazada') then
    raise exception 'Estado no válido: %', p_estado;
  end if;
  if length(trim(coalesce(p_nota, ''))) < 5 then
    raise exception 'Anota qué se hizo y por qué (mínimo 5 caracteres)';
  end if;

  select * into v_sol from solicitudes_eliminacion where id = p_id for update;
  if not found then
    raise exception 'Esa solicitud no existe';
  end if;
  if v_sol.estado in ('completada', 'rechazada') then
    raise exception 'Esta solicitud ya se cerró';
  end if;

  if p_estado = 'completada' then
    v_cuenta := fn_cuenta_de_solicitud(v_sol);
    if v_cuenta is null then
      raise exception 'El correo y el DNI no corresponden a una misma cuenta. Confírmalo con el titular o rechaza la solicitud.';
    end if;
    if exists (select 1 from administradores where perfil_id = v_cuenta)
       or exists (select 1 from operadores where perfil_id = v_cuenta) then
      raise exception 'Es una cuenta del equipo: quítale el rol antes de eliminarla';
    end if;

    select count(*) into v_activos from (
      select 1 from pedidos pe
       where (pe.cliente_id = v_cuenta or exists (
               select 1 from pagos g where g.pedido_id = pe.id and g.comprador_id = v_cuenta))
         and pe.estado not in ('publicado', 'confirmado', 'cancelado')
      union all
      select 1 from pagos g
       where (g.cliente_id = v_cuenta or g.comprador_id = v_cuenta)
         and g.estado in ('en_revision', 'retenido')
    ) x;
    if v_activos > 0 then
      raise exception 'La cuenta tiene pedidos o pagos en curso. Déjala «en espera» hasta que se cierren.';
    end if;

    select foto_path into v_foto from profiles where id = v_cuenta;

    -- Lo que todavía no tiene comprador se cierra; lo cerrado se conserva.
    update pedidos set estado = 'cancelado'
     where cliente_id = v_cuenta and estado = 'publicado';
    update ofertas set estado = 'retirada'
     where comprador_id = v_cuenta and estado = 'enviada';

    perform set_config('app.admin_autorizado', '1', true);
    update profiles
       set nombre_completo   = 'Cuenta eliminada',
           telefono          = null,
           dni               = null,
           foto_path         = null,
           dni_frente_path   = null,
           selfie_path       = null,
           motivo_rechazo    = null,
           es_comprador      = false,
           suspendido        = true,
           suspendido_motivo = 'Eliminada a pedido del titular',
           suspendido_en     = now()
     where id = v_cuenta;
    delete from avisos where perfil_id = v_cuenta;
    perform set_config('app.admin_autorizado', '0', true);

    -- TODO(eliminación): borrar el usuario de Supabase Auth (correo y
    -- contraseña) necesita la clave service_role, que la app no tiene. Hasta
    -- que haya una Edge Function para eso, el administrador lo borra a mano
    -- en Supabase → Authentication → Users. El perfil ya quedó anonimizado y
    -- suspendido, así que esa cuenta no puede operar.
  end if;

  update solicitudes_eliminacion
     set estado       = p_estado,
         nota         = trim(p_nota),
         perfil_id    = coalesce(perfil_id, v_cuenta),
         resuelta_en  = case when p_estado = 'en_espera' then null else now() end,
         resuelta_por = auth.uid()
   where id = p_id;

  perform registrar_bitacora('eliminacion_' || p_estado, 'perfil',
    coalesce(v_cuenta, v_sol.perfil_id)::text,
    jsonb_build_object('solicitud', p_id, 'origen', v_sol.origen, 'nota', trim(p_nota)));

  return v_foto;
end $$;
