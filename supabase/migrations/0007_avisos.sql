-- =====================================================================
--  ENCÁRGALO · MVP · Avisos
--  El pendiente era «notificaciones push», pero push es solo el
--  transporte: lo que faltaba de verdad era que la plataforma registre
--  los hechos que le importan a cada parte. Eso se resuelve en la base
--  de datos, con triggers sobre los mismos cambios de estado que ya se
--  registran en la bitácora, y sirve igual para la campana de la app hoy
--  y para Expo Notifications cuando haya build nativo: el mismo insert
--  dispara el envío.
--
--  Ningún aviso se escribe desde la app: los crean los triggers. La app
--  solo lee los suyos y los marca leídos por función.
-- =====================================================================

create table if not exists avisos (
  id         bigserial primary key,
  perfil_id  uuid not null references profiles(id) on delete cascade,
  pedido_id  uuid references pedidos(id) on delete cascade,
  tipo       text not null,
  titulo     text not null,
  cuerpo     text not null default '',
  leido      boolean not null default false,
  creado_en  timestamptz not null default now()
);

create index if not exists avisos_bandeja_idx
  on avisos (perfil_id, leido, creado_en desc);

comment on table avisos is
  'Bandeja de avisos por usuario. La llenan los triggers de pedidos, ofertas, '
  'pagos, mensajes, calificaciones y verificación. La app nunca inserta aquí.';


-- ---------------------------------------------------------------------
--  Ayudantes
-- ---------------------------------------------------------------------
create or replace function fn_avisar(
  p_perfil uuid, p_pedido uuid, p_tipo text, p_titulo text, p_cuerpo text default ''
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- Nadie recibe aviso de lo que acaba de hacer él mismo.
  if p_perfil is null or p_perfil = auth.uid() then
    return;
  end if;
  insert into avisos (perfil_id, pedido_id, tipo, titulo, cuerpo)
  values (p_perfil, p_pedido, p_tipo, p_titulo, coalesce(p_cuerpo, ''));
end $$;

create or replace function comprador_del_pedido(p_pedido_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select comprador_id from pagos where pedido_id = p_pedido_id;
$$;


-- ---------------------------------------------------------------------
--  Una oferta nueva: el cliente tiene que saberlo, es su decisión
-- ---------------------------------------------------------------------
create or replace function fn_aviso_oferta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cliente uuid;
  v_titulo  text;
begin
  select cliente_id, titulo into v_cliente, v_titulo
  from pedidos where id = new.pedido_id;

  perform fn_avisar(
    v_cliente, new.pedido_id, 'oferta',
    'Tienes una oferta nueva',
    'Recibiste una oferta de S/ ' || to_char(new.precio_final, 'FM999999990.00')
      || ' para «' || v_titulo || '», con entrega el '
      || to_char(new.fecha_entrega, 'DD/MM/YYYY') || '.');
  return new;
end $$;

drop trigger if exists tr_aviso_oferta on ofertas;
create trigger tr_aviso_oferta
  after insert on ofertas
  for each row execute function fn_aviso_oferta();


-- ---------------------------------------------------------------------
--  Cambio de estado del pedido: las dos partes, menos quien lo provocó
-- ---------------------------------------------------------------------
create or replace function fn_aviso_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_comprador uuid;
  v_titulo    text;
  v_cuerpo    text;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  v_comprador := comprador_del_pedido(new.id);

  v_titulo := case new.estado
    when 'aceptado'   then 'Te aceptaron la oferta'
    when 'pagado'     then 'El pago quedó retenido'
    when 'comprado'   then 'Tu producto ya fue comprado'
    when 'en_viaje'   then 'Tu producto está en viaje'
    when 'entregado'  then 'Confirma que recibiste tu pedido'
    when 'confirmado' then 'Pedido confirmado'
    when 'en_disputa' then 'Se abrió una disputa'
    when 'cancelado'  then 'El pedido fue cancelado'
    else 'Tu pedido cambió de estado'
  end;

  v_cuerpo := '«' || new.titulo || '». ' || case new.estado
    when 'aceptado'   then 'El cliente eligió una oferta. Falta que pague para que puedas comprar.'
    when 'pagado'     then 'Encárgalo ya retiene el dinero. El comprador externo puede comprar el producto.'
    when 'comprado'   then 'El comprador externo ya adquirió el producto.'
    when 'en_viaje'   then 'El producto está en camino al Perú.'
    when 'entregado'  then 'Revisa que sea lo que pediste y confirma: al confirmar se libera el pago.'
    when 'confirmado' then 'El pago fue liberado al comprador externo. Ya pueden calificarse.'
    when 'en_disputa' then 'El dinero sigue retenido mientras el equipo revisa el caso.'
    when 'cancelado'  then 'Este pedido ya no está activo.'
    else 'Entra al pedido para ver el detalle.'
  end;

  perform fn_avisar(new.cliente_id, new.id, 'pedido', v_titulo, v_cuerpo);
  perform fn_avisar(v_comprador,    new.id, 'pedido', v_titulo, v_cuerpo);
  return new;
end $$;

drop trigger if exists tr_aviso_pedido on pedidos;
create trigger tr_aviso_pedido
  after update on pedidos
  for each row execute function fn_aviso_pedido();


-- ---------------------------------------------------------------------
--  Movimientos del dinero. Son los que más importan, y van aparte
--  porque «pago retenido» y «pago liberado» no siempre coinciden con un
--  cambio de estado del pedido (un reembolso por disputa, por ejemplo).
-- ---------------------------------------------------------------------
create or replace function fn_aviso_pago()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_titulo text;
  v_cuerpo text;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if new.estado = 'retenido' then
    v_titulo := 'Tu dinero está protegido';
    v_cuerpo := 'Encárgalo retiene S/ '
      || to_char(new.total_cobrado, 'FM999999990.00')
      || '. No se transfiere a nadie hasta que el cliente confirme la recepción.';
  elsif new.estado = 'liberado' then
    v_titulo := 'Pago liberado';
    v_cuerpo := 'Se liberaron S/ ' || to_char(new.monto_liberado, 'FM999999990.00')
      || ' al comprador externo.';
  elsif new.estado = 'reembolsado' then
    v_titulo := 'Reembolso aprobado';
    v_cuerpo := 'El equipo resolvió la disputa a favor del cliente y devolvió S/ '
      || to_char(new.total_cobrado, 'FM999999990.00') || '.';
  else
    return new;
  end if;

  perform fn_avisar(new.cliente_id,   new.pedido_id, 'pago', v_titulo, v_cuerpo);
  perform fn_avisar(new.comprador_id, new.pedido_id, 'pago', v_titulo, v_cuerpo);
  return new;
end $$;

drop trigger if exists tr_aviso_pago on pagos;
create trigger tr_aviso_pago
  after update on pagos
  for each row execute function fn_aviso_pago();


-- ---------------------------------------------------------------------
--  Mensaje del chat interno
-- ---------------------------------------------------------------------
create or replace function fn_aviso_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cliente   uuid;
  v_comprador uuid;
  v_destino   uuid;
  v_titulo    text;
begin
  select cliente_id, titulo into v_cliente, v_titulo
  from pedidos where id = new.pedido_id;
  v_comprador := comprador_del_pedido(new.pedido_id);

  v_destino := case when new.emisor_id = v_cliente then v_comprador else v_cliente end;

  perform fn_avisar(
    v_destino, new.pedido_id, 'mensaje',
    'Mensaje nuevo',
    'Sobre «' || v_titulo || '»: ' || left(new.cuerpo, 120)
      || case when length(new.cuerpo) > 120 then '…' else '' end);
  return new;
end $$;

drop trigger if exists tr_aviso_mensaje on mensajes;
create trigger tr_aviso_mensaje
  after insert on mensajes
  for each row execute function fn_aviso_mensaje();


-- ---------------------------------------------------------------------
--  Calificación recibida: es lo que mueve la reputación
-- ---------------------------------------------------------------------
create or replace function fn_aviso_calificacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_avisar(
    new.calificado_id, new.pedido_id, 'calificacion',
    'Te calificaron con ' || new.puntaje || ' de 5',
    case when coalesce(trim(new.comentario), '') = ''
         then 'Ya forma parte de tu reputación pública.'
         else '«' || new.comentario || '»' end);
  return new;
end $$;

drop trigger if exists tr_aviso_calificacion on calificaciones;
create trigger tr_aviso_calificacion
  after insert on calificaciones
  for each row execute function fn_aviso_calificacion();


-- ---------------------------------------------------------------------
--  Resultado de la verificación de identidad
--  Aquí el aviso sí va al propio usuario, así que no pasa por fn_avisar
--  (que descarta al autor de la acción): lo aprueba un operador, y el
--  destinatario es otro.
-- ---------------------------------------------------------------------
create or replace function fn_aviso_verificacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verificacion is not distinct from old.verificacion then
    return new;
  end if;

  if new.verificacion = 'verificado' then
    insert into avisos (perfil_id, tipo, titulo, cuerpo)
    values (new.id, 'verificacion', 'Tu identidad quedó verificada',
            'Ya puedes publicar pedidos y enviar ofertas. Tu perfil muestra el sello '
            'de DNI verificado.');
  elsif new.verificacion = 'rechazado' then
    insert into avisos (perfil_id, tipo, titulo, cuerpo)
    values (new.id, 'verificacion', 'No pudimos verificar tu identidad',
            coalesce(new.motivo_rechazo,
                     'Vuelve a enviar tus documentos con buena luz y sin reflejos.'));
  end if;
  return new;
end $$;

drop trigger if exists tr_aviso_verificacion on profiles;
create trigger tr_aviso_verificacion
  after update on profiles
  for each row execute function fn_aviso_verificacion();


-- ---------------------------------------------------------------------
--  Seguridad: cada quien ve solo su bandeja y no puede escribir en ella
-- ---------------------------------------------------------------------
alter table avisos enable row level security;

drop policy if exists aviso_ver_propio on avisos;
create policy aviso_ver_propio on avisos
  for select to authenticated using (perfil_id = auth.uid());

-- Sin políticas de insert, update ni delete: los avisos los crean los
-- triggers y se marcan leídos por función. Si alguien manipulara la app
-- no podría inventarse un aviso ni borrar el de otro.

create or replace function marcar_avisos_leidos(p_ids bigint[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_filas int;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión activa';
  end if;

  update avisos set leido = true
   where perfil_id = auth.uid()
     and leido = false
     and (p_ids is null or id = any(p_ids));

  get diagnostics v_filas = row_count;
  return v_filas;
end $$;

create or replace function avisos_no_leidos()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from avisos where perfil_id = auth.uid() and leido = false;
$$;
