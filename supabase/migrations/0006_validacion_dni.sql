-- =====================================================================
--  ENCÁRGALO · MVP · Validación automática del DNI contra RENIEC
--  La hace la Edge Function `validar-dni` (supabase/functions/validar-dni)
--  consultando Decolecta. Aquí solo se guarda el RESULTADO: nunca los datos
--  que devuelve RENIEC (retención mínima, Ley N° 29733).
--  La aprobación sigue siendo humana: resolver_verificacion() no cambia.
-- =====================================================================

alter table profiles
  add column if not exists dni_validacion text
    check (dni_validacion in ('coincide', 'no_coincide', 'no_existe'));

alter table profiles
  add column if not exists dni_validado_en timestamptz;

comment on column profiles.dni_validacion is
  'Resultado de contrastar el DNI y el nombre con RENIEC. Null = sin validar. '
  'Solo lo escribe la Edge Function validar-dni (service_role).';


-- ---------------------------------------------------------------------
--  Nadie puede escribirse su propio resultado: si no es service_role, se
--  conserva el valor anterior. Si cambia el DNI, el resultado se borra,
--  porque ya no corresponde al número nuevo.
-- ---------------------------------------------------------------------
create or replace function fn_proteger_validacion_dni()
returns trigger language plpgsql as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.dni is distinct from old.dni then
    new.dni_validacion := null;
    new.dni_validado_en := null;
  else
    new.dni_validacion := old.dni_validacion;
    new.dni_validado_en := old.dni_validado_en;
  end if;
  return new;
end $$;

drop trigger if exists tr_proteger_validacion_dni on profiles;
create trigger tr_proteger_validacion_dni
  before update on profiles
  for each row execute function fn_proteger_validacion_dni();


-- ---------------------------------------------------------------------
--  La cola del equipo ahora muestra qué dijo RENIEC.
--  Cambia el tipo de retorno, por eso se elimina y se vuelve a crear.
-- ---------------------------------------------------------------------
drop function if exists pendientes_verificacion();

create function pendientes_verificacion()
returns table (
  perfil_id       uuid,
  nombre_completo text,
  dni             text,
  telefono        text,
  dni_frente_path text,
  selfie_path     text,
  solicitado_en   timestamptz,
  dni_validacion  text
) language plpgsql security definer set search_path = public as $$
begin
  if not soy_operador() then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.nombre_completo, p.dni, p.telefono,
           p.dni_frente_path, p.selfie_path, p.creado_en,
           p.dni_validacion
    from profiles p
    where p.verificacion = 'en_revision'
    order by p.creado_en;
end $$;
