-- =====================================================================
--  ENCÁRGALO · MVP · Verificación biométrica y lectura del DNI
--  La hace la Edge Function `verificar-identidad`:
--    1. Compara la selfie con la foto impresa en el DNI (AWS Rekognition).
--    2. Lee el número y el nombre impresos en el DNI (AWS Textract) y los
--       contrasta con el DNI declarado y con el nombre del perfil, que a su
--       vez ya se contrastó con RENIEC en `validar-dni`.
--  Si todo coincide aprueba sola; si la cara es claramente otra, rechaza; en
--  cualquier otro caso deja la solicitud al operador con el detalle.
--  Aquí solo se guarda el RESULTADO: ni plantillas faciales ni el texto leído
--  (retención mínima, Ley N° 29733). Las imágenes se borran al resolver.
-- =====================================================================

alter table profiles
  add column if not exists ia_resultado text
    check (ia_resultado in ('aprobado', 'revisar', 'rechazado'));

alter table profiles
  add column if not exists ia_similitud numeric(5,2);       -- 0 a 100, null = no se pudo comparar

alter table profiles
  add column if not exists ia_numero_coincide boolean;      -- el número impreso es el declarado

alter table profiles
  add column if not exists ia_nombre_coincide boolean;      -- el nombre impreso es el del perfil

alter table profiles
  add column if not exists ia_detalle text;                 -- por qué quedó en revisión o se rechazó

alter table profiles
  add column if not exists ia_evaluado_en timestamptz;

comment on column profiles.ia_resultado is
  'Decisión de verificar-identidad para la solicitud en curso. Null = sin evaluar. '
  'Solo la escribe la Edge Function (service_role).';


-- ---------------------------------------------------------------------
--  Nadie puede escribirse su propio resultado. Al volver a enviar la
--  verificación (pasa a en_revision) el resultado anterior se borra, porque
--  corresponde a otras fotos.
-- ---------------------------------------------------------------------
create or replace function fn_proteger_resultado_ia()
returns trigger language plpgsql as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.verificacion = 'en_revision' and old.verificacion is distinct from 'en_revision' then
    new.ia_resultado       := null;
    new.ia_similitud       := null;
    new.ia_numero_coincide := null;
    new.ia_nombre_coincide := null;
    new.ia_detalle         := null;
    new.ia_evaluado_en     := null;
  else
    new.ia_resultado       := old.ia_resultado;
    new.ia_similitud       := old.ia_similitud;
    new.ia_numero_coincide := old.ia_numero_coincide;
    new.ia_nombre_coincide := old.ia_nombre_coincide;
    new.ia_detalle         := old.ia_detalle;
    new.ia_evaluado_en     := old.ia_evaluado_en;
  end if;
  return new;
end $$;

drop trigger if exists tr_proteger_resultado_ia on profiles;
create trigger tr_proteger_resultado_ia
  before update on profiles
  for each row execute function fn_proteger_resultado_ia();


-- ---------------------------------------------------------------------
--  Umbrales de similitud facial (0 a 100), sin quemar en el código.
--  Rekognition da 99+ para la misma persona con buena foto; la foto del DNI
--  es pequeña y antigua, por eso se aprueba desde 95 y no desde 99.
-- ---------------------------------------------------------------------
insert into config (clave, valor, descripcion) values
  ('umbral_rostro_aprobar', 95,
   'Similitud mínima entre selfie y foto del DNI para aprobar sin operador'),
  ('umbral_rostro_rechazar', 50,
   'Por debajo de esta similitud se rechaza: es otra persona')
on conflict (clave) do update
  set valor = excluded.valor, descripcion = excluded.descripcion;


-- ---------------------------------------------------------------------
--  La cola del equipo muestra lo que dijo la IA.
--  Cambia el tipo de retorno, por eso se elimina y se vuelve a crear.
-- ---------------------------------------------------------------------
drop function if exists pendientes_verificacion();

create function pendientes_verificacion()
returns table (
  perfil_id          uuid,
  nombre_completo    text,
  dni                text,
  telefono           text,
  dni_frente_path    text,
  selfie_path        text,
  solicitado_en      timestamptz,
  dni_validacion     text,
  ia_resultado       text,
  ia_similitud       numeric,
  ia_numero_coincide boolean,
  ia_nombre_coincide boolean,
  ia_detalle         text
) language plpgsql security definer set search_path = public as $$
begin
  if not soy_operador() then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.nombre_completo, p.dni, p.telefono,
           p.dni_frente_path, p.selfie_path, p.creado_en,
           p.dni_validacion,
           p.ia_resultado, p.ia_similitud, p.ia_numero_coincide,
           p.ia_nombre_coincide, p.ia_detalle
    from profiles p
    where p.verificacion = 'en_revision'
    order by p.creado_en;
end $$;
