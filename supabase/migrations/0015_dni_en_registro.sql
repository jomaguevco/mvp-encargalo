-- =====================================================================
--  ENCÁRGALO · MVP · El DNI del registro se guarda siempre
--
--  El registro pide el DNI (y con él completa el nombre desde RENIEC), pero
--  lo guardaba en el perfil recién DESPUÉS de iniciar sesión. Si el proyecto
--  exige confirmar el correo no hay sesión en ese momento, el DNI se perdía y
--  la verificación lo volvía a pedir y a consultar en RENIEC.
--
--  Ahora viaja en los metadatos del alta (raw_user_meta_data.dni) y este
--  trigger lo copia al perfil al crear la cuenta, haya sesión o no. Solo se
--  copia si tiene 8 dígitos y no lo está usando ya una cuenta en revisión o
--  verificada (en ese caso queda vacío y la verificación lo pide).
-- =====================================================================

create or replace function fn_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dni text := new.raw_user_meta_data->>'dni';
begin
  if v_dni is null
     or v_dni !~ '^[0-9]{8}$'
     or exists (select 1 from profiles
                where dni = v_dni and verificacion in ('en_revision', 'verificado')) then
    v_dni := null;
  end if;

  insert into profiles (id, nombre_completo, telefono, dni)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', ''),
    new.raw_user_meta_data->>'telefono',
    v_dni
  )
  on conflict (id) do nothing;
  return new;
end $$;
