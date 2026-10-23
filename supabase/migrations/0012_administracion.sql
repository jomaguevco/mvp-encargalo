-- =====================================================================
--  ENCÁRGALO · MVP · Panel de administración
--  Un rol por encima del operador. El operador atiende las colas
--  (verificaciones, pagos, disputas, plazos vencidos); el administrador
--  puede todo eso y además ve los reportes, suspende cuentas, nombra o
--  quita operadores y cambia la configuración.
--
--  Igual que el resto del proyecto: la app nunca escribe directo. Todo lo
--  que hace el panel pasa por funciones security definer que validan quién
--  llama, y cada acción queda en la bitácora.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Administradores
-- ---------------------------------------------------------------------
create table if not exists administradores (
  perfil_id uuid primary key references profiles(id) on delete cascade,
  creado_en timestamptz not null default now()
);

alter table administradores enable row level security;

drop policy if exists admin_ver_propio on administradores;
create policy admin_ver_propio on administradores
  for select to authenticated
  using (perfil_id = auth.uid());

create or replace function soy_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from administradores where perfil_id = auth.uid());
$$;

-- El administrador también es operador: todas las funciones de las colas y
-- las políticas de los buckets privados siguen preguntando soy_operador().
create or replace function soy_operador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from operadores where perfil_id = auth.uid())
      or exists (select 1 from administradores where perfil_id = auth.uid());
$$;


-- ---------------------------------------------------------------------
--  Suspensión de cuentas
--  Una cuenta suspendida no puede publicar, ofertar ni escribir en el
--  chat. Sí puede abrir una disputa: si tiene dinero retenido, suspenderla
--  no debe dejarla sin forma de reclamarlo.
-- ---------------------------------------------------------------------
alter table profiles add column if not exists suspendido boolean not null default false;
alter table profiles add column if not exists suspendido_motivo text;
alter table profiles add column if not exists suspendido_en timestamptz;

create or replace function fn_proteger_suspension()
returns trigger language plpgsql as $$
begin
  if current_user = 'service_role'
     or coalesce(current_setting('app.admin_autorizado', true), '0') = '1' then
    return new;
  end if;
  new.suspendido        := old.suspendido;
  new.suspendido_motivo := old.suspendido_motivo;
  new.suspendido_en     := old.suspendido_en;
  return new;
end $$;

drop trigger if exists tr_proteger_suspension on profiles;
create trigger tr_proteger_suspension
  before update on profiles
  for each row execute function fn_proteger_suspension();

-- Un solo trigger para las tres tablas: el argumento dice qué columna
-- identifica a quien escribe.
create or replace function fn_bloquear_suspendidos()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_autor uuid;
begin
  v_autor := (to_jsonb(new) ->> tg_argv[0])::uuid;
  if exists (select 1 from profiles where id = v_autor and suspendido) then
    raise exception 'Tu cuenta está suspendida. Escribe al equipo de Encárgalo para revisarla.';
  end if;
  return new;
end $$;

drop trigger if exists tr_suspendido_pedidos on pedidos;
create trigger tr_suspendido_pedidos
  before insert on pedidos
  for each row execute function fn_bloquear_suspendidos('cliente_id');

drop trigger if exists tr_suspendido_ofertas on ofertas;
create trigger tr_suspendido_ofertas
  before insert on ofertas
  for each row execute function fn_bloquear_suspendidos('comprador_id');

drop trigger if exists tr_suspendido_mensajes on mensajes;
create trigger tr_suspendido_mensajes
  before insert on mensajes
  for each row execute function fn_bloquear_suspendidos('emisor_id');


-- ---------------------------------------------------------------------
--  Bitácora del equipo
--  Quién hizo qué y cuándo. La escriben las funciones de abajo y los
--  triggers de verificación, pagos y disputas; nadie la edita.
-- ---------------------------------------------------------------------
create table if not exists bitacora_admin (
  id            bigserial primary key,
  actor_id      uuid references profiles(id) on delete set null,  -- null = sistema
  accion        text not null,
  objetivo_tipo text,          -- 'perfil', 'pedido', 'pago', 'disputa', 'config'
  objetivo_id   text,
  detalle       jsonb not null default '{}'::jsonb,
  creado_en     timestamptz not null default now()
);

create index if not exists bitacora_admin_fecha_idx on bitacora_admin (creado_en desc);
create index if not exists bitacora_admin_objetivo_idx on bitacora_admin (objetivo_tipo, objetivo_id);

alter table bitacora_admin enable row level security;

drop policy if exists bitacora_ver_admin on bitacora_admin;
create policy bitacora_ver_admin on bitacora_admin
  for select to authenticated
  using (soy_admin());

create or replace function registrar_bitacora(
  p_accion text, p_tipo text, p_objetivo text, p_detalle jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = public as $$
  insert into bitacora_admin (actor_id, accion, objetivo_tipo, objetivo_id, detalle)
  values (auth.uid(), p_accion, p_tipo, p_objetivo, coalesce(p_detalle, '{}'::jsonb));
$$;

-- Solo la usan las funciones de este archivo, nunca la app.
revoke execute on function registrar_bitacora(text, text, text, jsonb) from public, anon, authenticated;

-- Verificaciones: la decisión de la IA (service_role) y la del equipo.
create or replace function fn_bitacora_verificacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verificacion is distinct from old.verificacion
     and new.verificacion in ('verificado', 'rechazado') then
    perform registrar_bitacora(
      case when auth.uid() is null
           then 'verificacion_automatica_' || new.verificacion::text
           else 'verificacion_' || new.verificacion::text end,
      'perfil', new.id::text,
      jsonb_build_object(
        'nombre', new.nombre_completo,
        'ia_resultado', new.ia_resultado,
        'ia_similitud', new.ia_similitud,
        'motivo', new.motivo_rechazo));
  end if;
  return new;
end $$;

drop trigger if exists tr_bitacora_verificacion on profiles;
create trigger tr_bitacora_verificacion
  after update on profiles
  for each row execute function fn_bitacora_verificacion();

-- Pagos: lo que mueve el equipo (retener, devolver, liberar, reembolsar).
-- El reporte del cliente (pendiente → en_revision) no entra: no es del equipo.
create or replace function fn_bitacora_pago()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado
     and new.estado in ('retenido', 'liberado', 'reembolsado', 'pendiente')
     and (auth.uid() is null or soy_operador()) then
    perform registrar_bitacora(
      'pago_' || new.estado::text, 'pago', new.pedido_id::text,
      jsonb_build_object('de', old.estado, 'total', new.total_cobrado,
                         'liberado', new.monto_liberado));
  end if;
  return new;
end $$;

drop trigger if exists tr_bitacora_pago on pagos;
create trigger tr_bitacora_pago
  after update on pagos
  for each row execute function fn_bitacora_pago();

create or replace function fn_bitacora_disputa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado
     and new.estado in ('resuelta_cliente', 'resuelta_comprador') then
    perform registrar_bitacora(
      'disputa_' || new.estado::text, 'disputa', new.id::text,
      jsonb_build_object('pedido_id', new.pedido_id, 'resolucion', new.resolucion));
  end if;
  return new;
end $$;

drop trigger if exists tr_bitacora_disputa on disputas;
create trigger tr_bitacora_disputa
  after update on disputas
  for each row execute function fn_bitacora_disputa();


-- ---------------------------------------------------------------------
--  Utilidad: corta la ejecución si quien llama no es administrador.
-- ---------------------------------------------------------------------
create or replace function exigir_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not soy_admin() then
    raise exception 'Solo un administrador de Encárgalo puede hacer esto';
  end if;
end $$;


-- ---------------------------------------------------------------------
--  Reporte general del período
--  Un solo viaje a la base: el panel arma todas sus tarjetas con esto.
--  El dinero retenido «ahora» no depende del período; lo demás sí.
-- ---------------------------------------------------------------------
create or replace function admin_resumen(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_desde timestamptz := p_desde::timestamptz;
  v_hasta timestamptz := (p_hasta + 1)::timestamptz;
  r jsonb;
begin
  perform exigir_admin();

  select jsonb_build_object(
    'cuentas', (
      select jsonb_build_object(
        'total',        count(*),
        'nuevas',       count(*) filter (where creado_en >= v_desde and creado_en < v_hasta),
        'verificadas',  count(*) filter (where verificacion = 'verificado'),
        'en_revision',  count(*) filter (where verificacion = 'en_revision'),
        'pendientes',   count(*) filter (where verificacion = 'pendiente'),
        'rechazadas',   count(*) filter (where verificacion = 'rechazado'),
        'suspendidas',  count(*) filter (where suspendido),
        'compradores',  count(*) filter (where es_comprador),
        'operadores',   (select count(*) from operadores),
        'administradores', (select count(*) from administradores))
      from profiles),

    'biometria', (
      select jsonb_build_object(
        'evaluadas',  count(*),
        'aprobadas',  count(*) filter (where ia_resultado = 'aprobado'),
        'revisar',    count(*) filter (where ia_resultado = 'revisar'),
        'rechazadas', count(*) filter (where ia_resultado = 'rechazado'),
        'similitud_promedio', round(avg(ia_similitud), 1),
        'reniec_coincide',    count(*) filter (where dni_validacion = 'coincide'),
        'reniec_no_coincide', count(*) filter (where dni_validacion in ('no_coincide', 'no_existe')))
      from profiles
      where ia_evaluado_en >= v_desde and ia_evaluado_en < v_hasta),

    'pedidos', (
      select jsonb_build_object(
        'publicados', count(*),
        'por_estado', coalesce(
          (select jsonb_object_agg(estado, n) from (
             select estado::text as estado, count(*) as n
             from pedidos
             where creado_en >= v_desde and creado_en < v_hasta
             group by estado) x), '{}'::jsonb),
        'valor_referencial', coalesce(sum(valor_referencial), 0))
      from pedidos
      where creado_en >= v_desde and creado_en < v_hasta),

    'ofertas', (
      select jsonb_build_object(
        'enviadas',  count(*),
        'aceptadas', count(*) filter (where estado = 'aceptada'),
        'retiradas', count(*) filter (where estado = 'retirada'))
      from ofertas
      where creado_en >= v_desde and creado_en < v_hasta),

    'dinero', (
      select jsonb_build_object(
        'valor_transado', coalesce(sum(monto_encargo)
                            filter (where estado in ('retenido', 'liberado')), 0),
        'cobrado',        coalesce(sum(total_cobrado)
                            filter (where estado in ('retenido', 'liberado', 'reembolsado')), 0),
        'comisiones',     coalesce(sum(comision_cliente + tarifa_comprador)
                            filter (where estado = 'liberado'), 0),
        'liberado',       coalesce(sum(monto_liberado) filter (where estado = 'liberado'), 0),
        'reembolsado',    coalesce(sum(total_cobrado) filter (where estado = 'reembolsado'), 0),
        'pagos_liberados', count(*) filter (where estado = 'liberado'),
        'ticket_promedio', round(avg(monto_encargo)
                            filter (where estado in ('retenido', 'liberado')), 2))
      from pagos
      where creado_en >= v_desde and creado_en < v_hasta),

    'ahora', (
      select jsonb_build_object(
        'retenido',        coalesce((select sum(total_cobrado) from pagos where estado = 'retenido'), 0),
        'pagos_retenidos', (select count(*) from pagos where estado = 'retenido'),
        'pagos_por_confirmar', (select count(*) from pagos where estado = 'en_revision'),
        'verificaciones_por_revisar', (select count(*) from profiles where verificacion = 'en_revision'),
        'disputas_abiertas', (select count(*) from disputas where estado in ('abierta', 'en_revision')))),

    'disputas', (
      select jsonb_build_object(
        'abiertas',          count(*),
        'a_favor_cliente',   count(*) filter (where estado = 'resuelta_cliente'),
        'a_favor_comprador', count(*) filter (where estado = 'resuelta_comprador'))
      from disputas
      where creado_en >= v_desde and creado_en < v_hasta),

    'calificaciones', (
      select jsonb_build_object('promedio', round(avg(puntaje), 2), 'total', count(*))
      from calificaciones
      where creado_en >= v_desde and creado_en < v_hasta),

    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', d::date,
               'registros', (select count(*) from profiles
                              where creado_en >= d and creado_en < d + interval '1 day'),
               'pedidos',   (select count(*) from pedidos
                              where creado_en >= d and creado_en < d + interval '1 day'),
               'pagos',     (select count(*) from pagos
                              where retenido_en >= d and retenido_en < d + interval '1 day'))
             order by d)
      from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
    ), '[]'::jsonb)
  ) into r;

  return r;
end $$;


-- ---------------------------------------------------------------------
--  Cuentas: lista con búsqueda y filtro
-- ---------------------------------------------------------------------
create or replace function admin_cuentas(
  p_busqueda text default null,
  p_filtro   text default 'todas',
  p_limite   int  default 50,
  p_desde    int  default 0
) returns table (
  perfil_id       uuid,
  nombre_completo text,
  correo          text,
  telefono        text,
  dni             text,
  ciudad          text,
  es_comprador    boolean,
  verificacion    text,
  ia_resultado    text,
  dni_validacion  text,
  suspendido      boolean,
  es_operador     boolean,
  es_admin        boolean,
  pedidos         bigint,
  ofertas         bigint,
  calificacion    numeric,
  creado_en       timestamptz,
  ultimo_ingreso  timestamptz,
  total           bigint
) language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(trim(coalesce(p_busqueda, '')), '');
begin
  perform exigir_admin();
  return query
    select p.id, p.nombre_completo, u.email::text, p.telefono, p.dni, p.ciudad,
           p.es_comprador, p.verificacion::text, p.ia_resultado, p.dni_validacion,
           p.suspendido,
           exists (select 1 from operadores o where o.perfil_id = p.id),
           exists (select 1 from administradores a where a.perfil_id = p.id),
           (select count(*) from pedidos pe where pe.cliente_id = p.id),
           (select count(*) from ofertas o where o.comprador_id = p.id),
           (select round(avg(c.puntaje), 2) from calificaciones c where c.calificado_id = p.id),
           p.creado_en, u.last_sign_in_at,
           count(*) over ()
    from profiles p
    left join auth.users u on u.id = p.id
    where (v_q is null
           or p.nombre_completo ilike '%' || v_q || '%'
           or u.email ilike '%' || v_q || '%'
           or p.dni like v_q || '%'
           or p.telefono like '%' || v_q || '%')
      and case coalesce(p_filtro, 'todas')
            when 'verificadas' then p.verificacion = 'verificado'
            when 'en_revision' then p.verificacion = 'en_revision'
            when 'pendientes'  then p.verificacion = 'pendiente'
            when 'rechazadas'  then p.verificacion = 'rechazado'
            when 'suspendidas' then p.suspendido
            when 'compradores' then p.es_comprador
            when 'equipo'      then exists (select 1 from operadores o where o.perfil_id = p.id)
                                 or exists (select 1 from administradores a where a.perfil_id = p.id)
            else true
          end
    order by p.creado_en desc
    limit greatest(1, least(coalesce(p_limite, 50), 500))
    offset greatest(0, coalesce(p_desde, 0));
end $$;


-- ---------------------------------------------------------------------
--  Ficha completa de una cuenta
--  No devuelve las rutas de las imágenes del DNI: para mirarlas está la
--  cola de verificaciones, que las borra al resolver.
-- ---------------------------------------------------------------------
create or replace function admin_ficha_cuenta(p_perfil uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform exigir_admin();

  if not exists (select 1 from profiles where id = p_perfil) then
    raise exception 'Esa cuenta no existe';
  end if;

  select jsonb_build_object(
    'perfil', (
      select to_jsonb(p) - 'dni_frente_path' - 'selfie_path'
             || jsonb_build_object(
                  'correo', u.email,
                  'ultimo_ingreso', u.last_sign_in_at,
                  'correo_confirmado', u.email_confirmed_at is not null,
                  'origen', u.raw_user_meta_data->>'origen',
                  'codigo_referido', u.raw_user_meta_data->>'codigo_referido',
                  'terminos_aceptados_en', u.raw_user_meta_data->>'terminos_aceptados_en',
                  'es_operador', exists (select 1 from operadores o where o.perfil_id = p.id),
                  'es_admin', exists (select 1 from administradores a where a.perfil_id = p.id))
      from profiles p left join auth.users u on u.id = p.id
      where p.id = p_perfil),

    'reputacion', (select to_jsonb(v) from v_reputacion v where v.perfil_id = p_perfil),

    'pedidos', coalesce((
      select jsonb_agg(x order by x.creado_en desc) from (
        select pe.id, pe.titulo, pe.estado, pe.valor_referencial, pe.creado_en,
               g.total_cobrado, g.estado as pago_estado
        from pedidos pe left join pagos g on g.pedido_id = pe.id
        where pe.cliente_id = p_perfil
        order by pe.creado_en desc limit 30) x), '[]'::jsonb),

    'entregas', coalesce((
      select jsonb_agg(x order by x.creado_en desc) from (
        select pe.id, pe.titulo, pe.estado, o.precio_final, o.estado as oferta_estado,
               o.creado_en
        from ofertas o join pedidos pe on pe.id = o.pedido_id
        where o.comprador_id = p_perfil
        order by o.creado_en desc limit 30) x), '[]'::jsonb),

    'dinero', (
      select jsonb_build_object(
        'pagado_como_cliente', coalesce(sum(total_cobrado) filter (
            where cliente_id = p_perfil and estado in ('retenido', 'liberado')), 0),
        'cobrado_como_comprador', coalesce(sum(monto_liberado) filter (
            where comprador_id = p_perfil and estado = 'liberado'), 0),
        'retenido_ahora', coalesce(sum(total_cobrado) filter (
            where (cliente_id = p_perfil or comprador_id = p_perfil) and estado = 'retenido'), 0),
        'reembolsado', coalesce(sum(total_cobrado) filter (
            where cliente_id = p_perfil and estado = 'reembolsado'), 0))
      from pagos where cliente_id = p_perfil or comprador_id = p_perfil),

    'disputas', coalesce((
      select jsonb_agg(x order by x.creado_en desc) from (
        select d.id, d.pedido_id, pe.titulo, d.motivo, d.estado, d.resolucion,
               d.creado_en, d.abierta_por = p_perfil as la_abrio
        from disputas d join pedidos pe on pe.id = d.pedido_id
        left join pagos g on g.pedido_id = d.pedido_id
        where d.abierta_por = p_perfil or g.cliente_id = p_perfil or g.comprador_id = p_perfil
        order by d.creado_en desc limit 20) x), '[]'::jsonb),

    'resenas', coalesce((
      select jsonb_agg(x order by x.creado_en desc) from (
        select c.puntaje, c.comentario, c.creado_en, pr.nombre_completo as autor
        from calificaciones c join profiles pr on pr.id = c.califica_id
        where c.calificado_id = p_perfil
        order by c.creado_en desc limit 20) x), '[]'::jsonb),

    'bitacora', coalesce((
      select jsonb_agg(x order by x.creado_en desc) from (
        select b.accion, b.detalle, b.creado_en, a.nombre_completo as actor
        from bitacora_admin b left join profiles a on a.id = b.actor_id
        where b.objetivo_tipo = 'perfil' and b.objetivo_id = p_perfil::text
        order by b.creado_en desc limit 30) x), '[]'::jsonb)
  ) into r;

  return r;
end $$;


-- ---------------------------------------------------------------------
--  Suspender o reactivar una cuenta
-- ---------------------------------------------------------------------
create or replace function admin_suspender_cuenta(
  p_perfil uuid, p_suspender boolean, p_motivo text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin();

  if p_perfil = auth.uid() then
    raise exception 'No puedes suspender tu propia cuenta';
  end if;
  if p_suspender and length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe el motivo de la suspensión (mínimo 5 caracteres)';
  end if;

  perform set_config('app.admin_autorizado', '1', true);

  update profiles
     set suspendido        = p_suspender,
         suspendido_motivo = case when p_suspender then trim(p_motivo) else null end,
         suspendido_en     = case when p_suspender then now() else null end
   where id = p_perfil;

  if not found then
    raise exception 'Esa cuenta no existe';
  end if;

  perform registrar_bitacora(
    case when p_suspender then 'cuenta_suspendida' else 'cuenta_reactivada' end,
    'perfil', p_perfil::text, jsonb_build_object('motivo', p_motivo));
end $$;


-- ---------------------------------------------------------------------
--  Dar o quitar un rol del equipo
--  Nunca queda el sistema sin administrador, y nadie se quita a sí mismo
--  el rol de administrador (lo haría otro).
-- ---------------------------------------------------------------------
create or replace function admin_asignar_rol(
  p_perfil uuid, p_rol text, p_activo boolean
) returns void language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  perform exigir_admin();

  select nombre_completo into v_nombre from profiles where id = p_perfil;
  if not found then
    raise exception 'Esa cuenta no existe';
  end if;

  if p_rol = 'operador' then
    if p_activo then
      insert into operadores (perfil_id, nombre) values (p_perfil, coalesce(v_nombre, ''))
      on conflict (perfil_id) do nothing;
    else
      if exists (select 1 from administradores where perfil_id = p_perfil) then
        raise exception 'Un administrador siempre es operador. Quítale primero el rol de administrador.';
      end if;
      delete from operadores where perfil_id = p_perfil;
    end if;

  elsif p_rol = 'admin' then
    if p_activo then
      if not exists (select 1 from profiles where id = p_perfil and verificacion = 'verificado')
         and not exists (select 1 from operadores where perfil_id = p_perfil) then
        raise exception 'Solo se nombra administrador a alguien verificado o que ya sea operador';
      end if;
      insert into administradores (perfil_id) values (p_perfil) on conflict do nothing;
      insert into operadores (perfil_id, nombre) values (p_perfil, coalesce(v_nombre, ''))
      on conflict (perfil_id) do nothing;
    else
      if p_perfil = auth.uid() then
        raise exception 'No puedes quitarte a ti mismo el rol de administrador';
      end if;
      if (select count(*) from administradores) <= 1 then
        raise exception 'Debe quedar al menos un administrador';
      end if;
      delete from administradores where perfil_id = p_perfil;
    end if;

  else
    raise exception 'Rol desconocido: %', p_rol;
  end if;

  perform registrar_bitacora(
    case when p_activo then 'rol_otorgado' else 'rol_retirado' end,
    'perfil', p_perfil::text, jsonb_build_object('rol', p_rol, 'nombre', v_nombre));
end $$;


-- ---------------------------------------------------------------------
--  Historial de verificaciones (lo que decidió la IA y lo que decidió el
--  equipo), para auditar el filtro biométrico.
-- ---------------------------------------------------------------------
create or replace function admin_verificaciones(
  p_filtro text default 'todas', p_limite int default 100
) returns table (
  perfil_id          uuid,
  nombre_completo    text,
  dni                text,
  verificacion       text,
  ia_resultado       text,
  ia_similitud       numeric,
  ia_numero_coincide boolean,
  ia_nombre_coincide boolean,
  ia_detalle         text,
  dni_validacion     text,
  motivo_rechazo     text,
  ia_evaluado_en     timestamptz,
  verificado_en      timestamptz,
  decidio            text,
  decidido_en        timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select p.id, p.nombre_completo, p.dni, p.verificacion::text,
           p.ia_resultado, p.ia_similitud, p.ia_numero_coincide, p.ia_nombre_coincide,
           p.ia_detalle, p.dni_validacion, p.motivo_rechazo, p.ia_evaluado_en,
           p.verificado_en,
           case when b.id is null then null
                when b.actor_id is null then 'Sistema (biometría)'
                else coalesce(a.nombre_completo, 'Equipo') end,
           b.creado_en
    from profiles p
    left join lateral (
      select * from bitacora_admin x
      where x.objetivo_tipo = 'perfil' and x.objetivo_id = p.id::text
        and x.accion like 'verificacion_%'
      order by x.creado_en desc limit 1) b on true
    left join profiles a on a.id = b.actor_id
    where (p.ia_evaluado_en is not null or p.verificacion in ('verificado', 'rechazado', 'en_revision'))
      and case coalesce(p_filtro, 'todas')
            when 'por_revisar'     then p.verificacion = 'en_revision'
            when 'auto_aprobadas'  then p.verificacion = 'verificado' and p.ia_resultado = 'aprobado'
            when 'auto_rechazadas' then p.verificacion = 'rechazado' and p.ia_resultado = 'rechazado'
            when 'equipo'          then b.actor_id is not null
            when 'rechazadas'      then p.verificacion = 'rechazado'
            else true
          end
    order by coalesce(b.creado_en, p.ia_evaluado_en, p.creado_en) desc
    limit greatest(1, least(coalesce(p_limite, 100), 500));
end $$;


-- ---------------------------------------------------------------------
--  Todos los pedidos y todos los pagos
-- ---------------------------------------------------------------------
create or replace function admin_pedidos(
  p_estado text default null, p_busqueda text default null,
  p_limite int default 50, p_desde int default 0
) returns table (
  pedido_id     uuid,
  titulo        text,
  categoria     text,
  estado        text,
  cliente_id    uuid,
  cliente       text,
  comprador_id  uuid,
  comprador     text,
  ofertas       bigint,
  precio_final  numeric,
  pago_estado   text,
  total_cobrado numeric,
  creado_en     timestamptz,
  total         bigint
) language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(trim(coalesce(p_busqueda, '')), '');
begin
  perform exigir_admin();
  return query
    select pe.id, pe.titulo, pe.categoria, pe.estado::text,
           pe.cliente_id, cl.nombre_completo,
           o.comprador_id, co.nombre_completo,
           (select count(*) from ofertas x where x.pedido_id = pe.id),
           o.precio_final, g.estado::text, g.total_cobrado, pe.creado_en,
           count(*) over ()
    from pedidos pe
    join profiles cl on cl.id = pe.cliente_id
    left join ofertas o on o.id = pe.oferta_aceptada_id
    left join profiles co on co.id = o.comprador_id
    left join pagos g on g.pedido_id = pe.id
    where (p_estado is null or p_estado = '' or pe.estado::text = p_estado)
      and (v_q is null or pe.titulo ilike '%' || v_q || '%'
           or cl.nombre_completo ilike '%' || v_q || '%'
           or co.nombre_completo ilike '%' || v_q || '%')
    order by pe.creado_en desc
    limit greatest(1, least(coalesce(p_limite, 50), 500))
    offset greatest(0, coalesce(p_desde, 0));
end $$;

create or replace function admin_pagos(
  p_estado text default null, p_limite int default 100
) returns table (
  pedido_id        uuid,
  titulo           text,
  cliente          text,
  comprador        text,
  metodo           text,
  codigo_operacion text,
  monto_encargo    numeric,
  comision         numeric,
  total_cobrado    numeric,
  monto_liberado   numeric,
  estado           text,
  reportado_en     timestamptz,
  retenido_en      timestamptz,
  liberado_en      timestamptz,
  creado_en        timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select g.pedido_id, pe.titulo, cl.nombre_completo, co.nombre_completo,
           g.metodo::text, g.codigo_operacion, g.monto_encargo,
           g.comision_cliente + g.tarifa_comprador, g.total_cobrado, g.monto_liberado,
           g.estado::text, g.reportado_en, g.retenido_en, g.liberado_en, g.creado_en
    from pagos g
    join pedidos pe on pe.id = g.pedido_id
    join profiles cl on cl.id = g.cliente_id
    join profiles co on co.id = g.comprador_id
    where p_estado is null or p_estado = '' or g.estado::text = p_estado
    order by g.creado_en desc
    limit greatest(1, least(coalesce(p_limite, 100), 500));
end $$;


-- ---------------------------------------------------------------------
--  Configuración
--  Cada clave tiene un rango válido: un error de tipeo en una tarifa
--  recalcularía mal todos los pagos nuevos.
-- ---------------------------------------------------------------------
create or replace function admin_actualizar_config(p_clave text, p_valor numeric)
returns config language plpgsql security definer set search_path = public as $$
declare
  v_viejo numeric;
  v_fila  config;
  v_min   numeric;
  v_max   numeric;
begin
  perform exigir_admin();

  select valor into v_viejo from config where clave = p_clave;
  if not found then
    raise exception 'No existe la clave de configuración «%»', p_clave;
  end if;

  select lim.mn, lim.mx into v_min, v_max
  from (values
    ('comision_cliente',       0::numeric, 0.30::numeric),
    ('tarifa_comprador',       0,          0.30),
    ('cargo_procesamiento',    0,          0.10),
    ('dias_para_confirmar',    1,          60),
    ('umbral_rostro_aprobar',  50,         100),
    ('umbral_rostro_rechazar', 0,          95)
  ) as lim(clave, mn, mx)
  where lim.clave = p_clave;

  if v_min is not null and (p_valor < v_min or p_valor > v_max) then
    raise exception 'El valor de «%» debe estar entre % y %', p_clave, v_min, v_max;
  end if;

  if p_clave = 'umbral_rostro_aprobar' and p_valor <= coalesce(cfg('umbral_rostro_rechazar'), 0) then
    raise exception 'El umbral para aprobar debe ser mayor que el de rechazo';
  end if;
  if p_clave = 'umbral_rostro_rechazar' and p_valor >= coalesce(cfg('umbral_rostro_aprobar'), 100) then
    raise exception 'El umbral de rechazo debe ser menor que el de aprobación';
  end if;

  update config set valor = p_valor where clave = p_clave returning * into v_fila;

  perform registrar_bitacora('config_actualizada', 'config', p_clave,
    jsonb_build_object('antes', v_viejo, 'despues', p_valor));
  return v_fila;
end $$;


-- ---------------------------------------------------------------------
--  Bitácora para el panel
-- ---------------------------------------------------------------------
create or replace function admin_bitacora(p_limite int default 200, p_tipo text default null)
returns table (
  id            bigint,
  accion        text,
  objetivo_tipo text,
  objetivo_id   text,
  detalle       jsonb,
  actor         text,
  creado_en     timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select b.id, b.accion, b.objetivo_tipo, b.objetivo_id, b.detalle,
           case when b.actor_id is null then 'Sistema'
                else coalesce(a.nombre_completo, 'Equipo') end,
           b.creado_en
    from bitacora_admin b
    left join profiles a on a.id = b.actor_id
    where p_tipo is null or p_tipo = '' or b.objetivo_tipo = p_tipo
    order by b.creado_en desc
    limit greatest(1, least(coalesce(p_limite, 200), 1000));
end $$;
