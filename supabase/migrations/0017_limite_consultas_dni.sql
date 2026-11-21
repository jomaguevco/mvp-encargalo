-- =====================================================================
--  ENCÁRGALO · MVP · Límites persistentes para consultar-dni
--
--  consultar-dni se llama sin sesión desde el registro. Su límite vivía en la
--  memoria de la función: se reiniciaba en cada arranque en frío y en cada
--  instancia, así que un script podía recorrer números de DNI, juntar nombres
--  (datos personales, Ley N° 29733) y agotar el cupo de Decolecta.
--
--  Ahora cada consulta se anota aquí y la función pregunta antes de llamar a
--  RENIEC. Solo se guarda quién consultó (IP o usuario) y cuándo: nunca el DNI
--  ni la respuesta. Las filas de más de dos días se borran solas.
-- =====================================================================

create table if not exists consultas_dni (
  id         bigint generated always as identity primary key,
  clave      text        not null,  -- 'ip:<dirección>' o 'usuario:<uuid>'
  modo       text        not null check (modo in ('anonimo', 'usuario')),
  creado_en  timestamptz not null default now()
);

create index if not exists consultas_dni_clave_idx on consultas_dni (clave, creado_en desc);
create index if not exists consultas_dni_modo_idx  on consultas_dni (modo, creado_en desc);

comment on table consultas_dni is
  'Bitácora mínima de consultar-dni para limitar abusos. Sin DNI ni nombres. '
  'Solo la escribe la Edge Function (service_role).';

-- Sin políticas: nadie la lee ni la escribe desde la app.
alter table consultas_dni enable row level security;
revoke all on consultas_dni from anon, authenticated;

/**
 * ¿Puede consultar? Si puede, anota la consulta y devuelve true. Revisa dos
 * topes: el de quien consulta (por ventana) y el global del modo (por día).
 */
create or replace function registrar_consulta_dni(
  p_clave       text,
  p_modo        text,
  p_limite      int,
  p_ventana     interval,
  p_global_dia  int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_propias int;
  v_globales int;
begin
  -- Un solo cálculo a la vez por clave, para que dos llamadas en paralelo no
  -- pasen las dos con la última consulta disponible.
  perform pg_advisory_xact_lock(hashtext('consultas_dni:' || p_clave));

  delete from consultas_dni where creado_en < now() - interval '2 days';

  select count(*) into v_propias
    from consultas_dni
   where clave = p_clave and creado_en > now() - p_ventana;
  if v_propias >= p_limite then
    return false;
  end if;

  select count(*) into v_globales
    from consultas_dni
   where modo = p_modo and creado_en > now() - interval '1 day';
  if v_globales >= p_global_dia then
    return false;
  end if;

  insert into consultas_dni (clave, modo) values (p_clave, p_modo);
  return true;
end $$;

revoke execute on function registrar_consulta_dni(text, text, int, interval, int)
  from public, anon, authenticated;
grant execute on function registrar_consulta_dni(text, text, int, interval, int)
  to service_role;
