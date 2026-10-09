-- =====================================================================
--  ENCÁRGALO · MVP · Correcciones del recorrido completo (9 oct 2026)
--
--  Lo que encontró la revisión de punta a punta:
--    1. Al aceptar una oferta, el comprador ganador no recibía aviso:
--       fn_aviso_pedido buscaba al comprador en `pagos`, y aceptar_oferta
--       cambia el estado del pedido ANTES de crear el pago.
--    2. Un pago reportado que nunca llegó dejaba el pedido trabado para
--       siempre: no se podía cancelar, ni disputar, ni el equipo podía
--       devolverlo. Nueva función rechazar_pago para el equipo.
--    3. El equipo no podía abrir un pedido ni leer su chat (la consola le
--       pide hacerlo antes de resolver una disputa). Políticas de lectura
--       para operadores; escribir sigue pasando solo por las funciones.
--    4. Si la persona corregía su nombre, se conservaba el resultado viejo
--       de RENIEC («no coincide») y la verificación automática nunca podía
--       aprobar. Ahora el resultado se borra también al cambiar el nombre.
--    5. Al rechazar una verificación se conservaban las rutas de las
--       imágenes (Ley N° 29733: se descartan al resolver, en ambos casos).
--  Nada más cambia: mismas firmas, mismos estados.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Aviso al comprador ganador
--  Igual que en 0009, salvo cómo se busca al comprador: si todavía no hay
--  pago, es el dueño de la oferta aceptada.
-- ---------------------------------------------------------------------
create or replace function fn_aviso_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_comprador uuid;
  v_titulo    text;
  v_cuerpo    text;
  v_motivo    text := nullif(current_setting('app.motivo_cancelacion', true), '');
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  v_comprador := coalesce(
    comprador_del_pedido(new.id),
    (select comprador_id from ofertas where id = new.oferta_aceptada_id)
  );

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
      || coalesce(' Motivo del cliente: ' || v_motivo, '')
    else 'Entra al pedido para ver el detalle.'
  end;

  perform fn_avisar(new.cliente_id, new.id, 'pedido', v_titulo, v_cuerpo);
  perform fn_avisar(v_comprador,    new.id, 'pedido', v_titulo, v_cuerpo);
  return new;
end $$;


-- ---------------------------------------------------------------------
--  2. El equipo devuelve un pago reportado que no llegó
--  El pago vuelve a «pendiente»: el cliente puede reportarlo de nuevo con
--  el código correcto o cancelar el pedido. El pedido sigue en «aceptado».
-- ---------------------------------------------------------------------
create or replace function rechazar_pago(p_pedido_id uuid, p_motivo text)
returns pagos
language plpgsql security definer set search_path = public as $$
declare
  v_pago   pagos;
  v_titulo text;
  v_motivo text := coalesce(nullif(trim(p_motivo), ''),
                            'No encontramos el pago en la cuenta de Encárgalo');
begin
  if not soy_operador() then
    raise exception 'Solo el equipo de Encárgalo puede rechazar un pago';
  end if;

  select * into v_pago from pagos where pedido_id = p_pedido_id for update;
  if not found then
    raise exception 'Este pedido todavía no tiene un pago generado';
  end if;
  if v_pago.estado <> 'en_revision' then
    raise exception 'El pago no está en revisión (estado: %)', v_pago.estado;
  end if;

  update pagos
     set estado = 'pendiente',
         reportado_en = null
   where id = v_pago.id
  returning * into v_pago;

  select titulo into v_titulo from pedidos where id = p_pedido_id;
  perform fn_avisar(
    v_pago.cliente_id, p_pedido_id, 'pago',
    'No pudimos confirmar tu pago',
    '«' || v_titulo || '». ' || v_motivo
      || '. Revisa el código de operación y repórtalo de nuevo, o cancela el pedido.');

  return v_pago;
end $$;


-- ---------------------------------------------------------------------
--  3. El equipo puede LEER pedidos, ofertas, pagos, eventos, mensajes y
--  disputas. Las políticas se suman a las de los participantes; escribir
--  sigue pasando solo por las funciones.
-- ---------------------------------------------------------------------
drop policy if exists operador_ver on pedidos;
create policy operador_ver on pedidos
  for select to authenticated using (soy_operador());

drop policy if exists operador_ver on ofertas;
create policy operador_ver on ofertas
  for select to authenticated using (soy_operador());

drop policy if exists operador_ver on pagos;
create policy operador_ver on pagos
  for select to authenticated using (soy_operador());

drop policy if exists operador_ver on eventos_pedido;
create policy operador_ver on eventos_pedido
  for select to authenticated using (soy_operador());

drop policy if exists operador_ver on mensajes;
create policy operador_ver on mensajes
  for select to authenticated using (soy_operador());

drop policy if exists operador_ver on disputas;
create policy operador_ver on disputas
  for select to authenticated using (soy_operador());


-- ---------------------------------------------------------------------
--  4. El resultado de RENIEC se borra si cambia el DNI o el nombre
-- ---------------------------------------------------------------------
create or replace function fn_proteger_validacion_dni()
returns trigger language plpgsql as $$
begin
  if current_user = 'service_role' then
    return new;
  end if;

  if new.dni is distinct from old.dni
     or new.nombre_completo is distinct from old.nombre_completo then
    new.dni_validacion := null;
    new.dni_validado_en := null;
  else
    new.dni_validacion := old.dni_validacion;
    new.dni_validado_en := old.dni_validado_en;
  end if;
  return new;
end $$;


-- ---------------------------------------------------------------------
--  5. Al resolver una verificación, aprobada o rechazada, se descartan las
--  rutas de las imágenes. La consola borra los archivos del bucket.
-- ---------------------------------------------------------------------
create or replace function resolver_verificacion(
  p_perfil uuid, p_aprobar boolean, p_motivo text default null
) returns profiles
language plpgsql security definer set search_path = public as $$
declare v_perfil profiles;
begin
  if not soy_operador() then
    raise exception 'Solo el equipo de Encárgalo puede aprobar verificaciones';
  end if;

  perform set_config('app.verificacion_autorizada', '1', true);

  update profiles
     set verificacion   = case when p_aprobar then 'verificado'::estado_verificacion
                               else 'rechazado'::estado_verificacion end,
         verificado_en  = case when p_aprobar then now() else null end,
         motivo_rechazo = case when p_aprobar then null else p_motivo end,
         dni_frente_path = null,
         selfie_path     = null
   where id = p_perfil
  returning * into v_perfil;

  if not found then
    raise exception 'Ese perfil no existe';
  end if;
  return v_perfil;
end $$;
