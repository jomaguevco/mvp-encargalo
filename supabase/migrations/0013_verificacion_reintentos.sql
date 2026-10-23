-- =====================================================================
--  ENCÁRGALO · MVP · Reintentos de verificación y decisiones únicas
--
--  1. Un rechazo ya no «reserva» el DNI. Antes el índice único abarcaba a
--     cualquier perfil con DNI, así que si a alguien le rechazaban la
--     verificación y se registraba de nuevo, su DNI quedaba tomado por la
--     cuenta rechazada y nunca podía verificarse. El DNI le pertenece a quien
--     lo está verificando o ya lo verificó.
--  2. Una verificación se resuelve una sola vez: solo si sigue en revisión.
--     Evita que dos operadores decidan sobre la misma solicitud, o que se
--     «apruebe» a alguien que nunca envió documentos.
--  3. El panel señala cuentas posiblemente duplicadas (mismo DNI o mismo
--     nombre), que es lo que pasa cuando alguien se vuelve a registrar.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. DNI único solo entre solicitudes vivas y cuentas verificadas
--  Se conserva el nombre del índice: la app traduce el error por ese nombre.
-- ---------------------------------------------------------------------
drop index if exists profiles_dni_unico;
create unique index profiles_dni_unico
  on profiles (dni)
  where dni is not null and verificacion in ('en_revision', 'verificado');

-- La app pregunta antes de subir las fotos, para no subir documentos que
-- luego no se pueden usar. Solo responde sí o no: no dice de quién es.
create or replace function dni_disponible(p_dni text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles
    where dni = p_dni
      and id <> auth.uid()
      and verificacion in ('en_revision', 'verificado'));
$$;

revoke execute on function dni_disponible(text) from anon;


-- ---------------------------------------------------------------------
--  2. Resolver una verificación exige que siga en revisión
-- ---------------------------------------------------------------------
create or replace function resolver_verificacion(
  p_perfil uuid, p_aprobar boolean, p_motivo text default null
) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_perfil profiles;
  v_estado estado_verificacion;
begin
  if not soy_operador() then
    raise exception 'Solo el equipo de Encárgalo puede aprobar verificaciones';
  end if;

  select verificacion into v_estado from profiles where id = p_perfil for update;
  if not found then
    raise exception 'Ese perfil no existe';
  end if;
  if v_estado <> 'en_revision' then
    raise exception 'Esta solicitud ya no está en revisión (estado actual: %). Actualiza la cola.', v_estado;
  end if;
  if not p_aprobar and length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'Indica el motivo del rechazo: la persona lo ve para saber qué corregir';
  end if;

  perform set_config('app.verificacion_autorizada', '1', true);

  update profiles
     set verificacion   = case when p_aprobar then 'verificado'::estado_verificacion
                               else 'rechazado'::estado_verificacion end,
         verificado_en  = case when p_aprobar then now() else null end,
         motivo_rechazo = case when p_aprobar then null else trim(p_motivo) end,
         dni_frente_path = null,
         selfie_path     = null
   where id = p_perfil
  returning * into v_perfil;

  return v_perfil;
end $$;


-- ---------------------------------------------------------------------
--  3. Cuentas posiblemente duplicadas
-- ---------------------------------------------------------------------
create or replace function cuentas_parecidas(p_perfil uuid)
returns table (perfil_id uuid, nombre_completo text, correo text, verificacion text,
               dni text, creado_en timestamptz, motivo text)
language sql stable security definer set search_path = public as $$
  select o.id, o.nombre_completo, u.email::text, o.verificacion::text, o.dni, o.creado_en,
         case when o.dni is not null and o.dni = p.dni then 'Mismo DNI' else 'Mismo nombre' end
  from profiles p
  join profiles o on o.id <> p.id
  left join auth.users u on u.id = o.id
  where p.id = p_perfil
    and ((p.dni is not null and o.dni = p.dni)
         or (length(trim(p.nombre_completo)) > 5
             and lower(trim(o.nombre_completo)) = lower(trim(p.nombre_completo))))
  order by o.creado_en;
$$;

revoke execute on function cuentas_parecidas(uuid) from public, anon, authenticated;

-- La lista de cuentas suma la columna «parecidas». Cambia el tipo de
-- retorno, por eso se elimina y se vuelve a crear.
drop function if exists admin_cuentas(text, text, int, int);

create function admin_cuentas(
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
  parecidas       bigint,
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
           (select count(*) from profiles x
             where x.id <> p.id
               and ((p.dni is not null and x.dni = p.dni)
                    or (length(trim(p.nombre_completo)) > 5
                        and lower(trim(x.nombre_completo)) = lower(trim(p.nombre_completo))))),
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

-- La ficha suma la lista de cuentas parecidas.
create or replace function admin_cuentas_parecidas(p_perfil uuid)
returns table (perfil_id uuid, nombre_completo text, correo text, verificacion text,
               dni text, creado_en timestamptz, motivo text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query select * from cuentas_parecidas(p_perfil);
end $$;
