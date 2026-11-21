-- =====================================================================
--  ENCÁRGALO · MVP · Cierre de huecos de seguridad (revisión del 21/11/2026)
--
--  1. El perfil: el usuario solo cambia lo que le corresponde. La política
--     perfil_editar_propio dejaba escribir cualquier columna de la propia
--     fila, así que alguien verificado podía cambiarse el nombre o el DNI y
--     conservar la insignia, falsear su antigüedad, o volver de en_revision a
--     pendiente para repetir la evaluación biométrica sin límite.
--  2. Las rutas de las fotos quedan atadas a la carpeta de su dueño. Antes se
--     podía apuntar dni_frente_path y selfie_path a las fotos de otra persona,
--     y verificar-identidad (con service_role) las comparaba y las borraba.
--     Lo mismo con el comprobante de pago y la evidencia de una disputa.
--  3. Nadie oferta ni acepta en su propio pedido. La política oferta_retirar
--     dejaba mover una oferta a otro pedido y cambiarle el precio, y
--     aceptar_oferta no comprobaba que cliente y comprador fueran distintos:
--     con eso se fabricaban pedidos de S/ 1 y calificaciones propias.
--  4. fn_avisar y comprador_del_pedido solo los llaman los triggers. Tenían
--     el permiso de ejecución por defecto, así que cualquiera, incluso sin
--     sesión, podía escribir un aviso con apariencia oficial en la bandeja de
--     otra persona.
--  5. La verificación biométrica ya no aprueba sola. Sin prueba de vida, una
--     foto del DNI subida también como selfie se aprobaba (el rostro impreso
--     coincide consigo mismo). verificar-identidad ahora guarda «aprobado»
--     como recomendación y un operador confirma, salvo que el equipo encienda
--     aprobacion_automatica = 1 (cuando haya prueba de vida).
--
--  Las funciones security definer corren como su dueño, no como
--  authenticated, así que nada de esto toca a las funciones del flujo
--  (resolver_verificacion, verificar-identidad con service_role, etc.).
-- =====================================================================


-- ---------------------------------------------------------------------
--  1 y 2. Perfil: columnas protegidas, transición única a revisión y rutas
--  de archivos dentro de la carpeta del usuario
-- ---------------------------------------------------------------------
create or replace function fn_proteger_perfil()
returns trigger language plpgsql as $$
declare
  v_carpeta text := new.id::text || '/';
begin
  -- Solo restringe las escrituras directas desde la app. Las funciones
  -- security definer corren como su dueño y las Edge Functions como
  -- service_role: esas ya validan por su cuenta.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.creado_en is distinct from old.creado_en
     or new.verificado_en is distinct from old.verificado_en
  then
    raise exception 'Ese dato de la cuenta no se puede modificar';
  end if;

  -- El motivo de un rechazo lo escribe el equipo. El usuario solo lo borra
  -- al volver a enviar su verificación.
  if new.motivo_rechazo is distinct from old.motivo_rechazo
     and new.motivo_rechazo is not null then
    raise exception 'El motivo del rechazo lo escribe el equipo de Encárgalo';
  end if;

  -- Única transición propia: enviar (o reenviar) a revisión. Aprobar y
  -- rechazar ya los bloquea tr_bloquear_autoverificacion.
  if new.verificacion is distinct from old.verificacion then
    if not (old.verificacion in ('pendiente', 'rechazado') and new.verificacion = 'en_revision') then
      raise exception 'Ese cambio de estado de verificación no está permitido';
    end if;
    if new.dni is null or new.dni_frente_path is null or new.selfie_path is null then
      raise exception 'Para enviar la verificación faltan el DNI, la foto del documento o la selfie';
    end if;
  end if;

  -- Con la solicitud en revisión o ya verificada, la identidad queda fija.
  if old.verificacion in ('en_revision', 'verificado') and (
       new.dni is distinct from old.dni
       or new.nombre_completo is distinct from old.nombre_completo
       or new.dni_frente_path is distinct from old.dni_frente_path
       or new.selfie_path is distinct from old.selfie_path)
  then
    raise exception 'Tu nombre y tu DNI no se pueden cambiar mientras la verificación está en revisión o aprobada. Escríbenos si hay un error.';
  end if;

  -- Cada archivo, en la carpeta del propio usuario.
  if (new.dni_frente_path is distinct from old.dni_frente_path
        and new.dni_frente_path is not null and left(new.dni_frente_path, length(v_carpeta)) <> v_carpeta)
     or (new.selfie_path is distinct from old.selfie_path
        and new.selfie_path is not null and left(new.selfie_path, length(v_carpeta)) <> v_carpeta)
     or (new.foto_path is distinct from old.foto_path
        and new.foto_path is not null and left(new.foto_path, length(v_carpeta)) <> v_carpeta)
  then
    raise exception 'La foto debe estar en tu propia carpeta';
  end if;

  -- La selfie no puede ser el mismo archivo que la foto del documento.
  if new.dni_frente_path is not null and new.dni_frente_path = new.selfie_path then
    raise exception 'La selfie y la foto del DNI deben ser fotos distintas';
  end if;

  return new;
end $$;

drop trigger if exists tr_proteger_perfil on profiles;
create trigger tr_proteger_perfil
  before update on profiles
  for each row execute function fn_proteger_perfil();


-- Comprobante de pago y evidencia de disputa: en la carpeta de quien los sube.
-- Estas filas las escriben reportar_pago y abrir_disputa (security definer),
-- que reciben la ruta tal cual llega de la app: por eso se valida siempre,
-- sin importar el rol.
create or replace function fn_ruta_comprobante()
returns trigger language plpgsql as $$
begin
  if new.comprobante_path is not null
     and (tg_op = 'INSERT' or new.comprobante_path is distinct from old.comprobante_path)
     and left(new.comprobante_path, length(new.cliente_id::text) + 1) <> new.cliente_id::text || '/'
  then
    raise exception 'El comprobante debe estar en la carpeta de quien pagó';
  end if;
  return new;
end $$;

drop trigger if exists tr_ruta_comprobante on pagos;
create trigger tr_ruta_comprobante
  before insert or update on pagos
  for each row execute function fn_ruta_comprobante();

create or replace function fn_ruta_evidencia()
returns trigger language plpgsql as $$
begin
  if new.evidencia_path is not null
     and (tg_op = 'INSERT' or new.evidencia_path is distinct from old.evidencia_path)
     and left(new.evidencia_path, length(new.abierta_por::text) + 1) <> new.abierta_por::text || '/'
  then
    raise exception 'La evidencia debe estar en la carpeta de quien abre la disputa';
  end if;
  return new;
end $$;

drop trigger if exists tr_ruta_evidencia on disputas;
create trigger tr_ruta_evidencia
  before insert or update on disputas
  for each row execute function fn_ruta_evidencia();


-- ---------------------------------------------------------------------
--  3. Ofertas: sin escrituras directas y nunca sobre el propio pedido
-- ---------------------------------------------------------------------
-- Retirar una oferta ya pasa por retirar_oferta() (0006). La política dejaba
-- además cambiar pedido_id, precio_final y fecha_entrega a mano.
drop policy if exists oferta_retirar on ofertas;

create or replace function fn_oferta_ajena()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.pedido_id is distinct from old.pedido_id then
    raise exception 'Una oferta no se puede mover a otro pedido';
  end if;
  -- Al crearla y al aceptarla. Las demás actualizaciones (rechazar o retirar
  -- las que quedan) no se bloquean, para no trabar pedidos con datos viejos.
  if (tg_op = 'INSERT' or (new.estado = 'aceptada' and old.estado is distinct from 'aceptada'))
     and exists (select 1 from pedidos p
                  where p.id = new.pedido_id and p.cliente_id = new.comprador_id) then
    raise exception 'No puedes ofertar ni aceptar una oferta en tu propio pedido';
  end if;
  return new;
end $$;

drop trigger if exists tr_oferta_ajena on ofertas;
create trigger tr_oferta_ajena
  before insert or update on ofertas
  for each row execute function fn_oferta_ajena();


-- ---------------------------------------------------------------------
--  4. Ayudantes de avisos: solo para los triggers
-- ---------------------------------------------------------------------
-- Los triggers que los usan son security definer y corren como su dueño,
-- así que siguen funcionando sin este permiso.
revoke execute on function fn_avisar(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function comprador_del_pedido(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
--  5. Aprobación automática de la verificación: apagada
-- ---------------------------------------------------------------------
insert into config (clave, valor, descripcion) values
  ('aprobacion_automatica', 0,
   '1 = verificar-identidad aprueba sola cuando todo coincide. 0 = queda como '
   'recomendación para un operador. Encender solo con prueba de vida.')
on conflict (clave) do nothing;
