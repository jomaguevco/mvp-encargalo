-- =====================================================================
--  ENCÁRGALO · MVP · Avisar de una cancelación a quienes ofertaron
--
--  Error que encontró la prueba de punta a punta (3 oct 2026): al cancelar
--  un pedido publicado, las ofertas pasaban a «rechazada» pero nadie que
--  había ofertado recibía aviso. fn_aviso_pedido solo avisa al cliente y al
--  comprador con pago, y un pedido publicado todavía no tiene pago. Además
--  el motivo que escribe el cliente no viajaba en ningún aviso, aunque la
--  app le dice que «quien te ofertó recibe este motivo».
--
--  Qué cambia:
--    - cancelar_pedido deja el motivo en una variable de la transacción y
--      avisa a cada comprador externo con una oferta viva.
--    - fn_aviso_pedido incluye ese motivo en el aviso de «cancelado».
--  Nada más cambia: mismas firmas, mismas reglas, mismos estados.
-- =====================================================================

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
      || coalesce(' Motivo del cliente: ' || v_motivo, '')
    else 'Entra al pedido para ver el detalle.'
  end;

  perform fn_avisar(new.cliente_id, new.id, 'pedido', v_titulo, v_cuerpo);
  perform fn_avisar(v_comprador,    new.id, 'pedido', v_titulo, v_cuerpo);
  return new;
end $$;


create or replace function cancelar_pedido(p_pedido_id uuid, p_motivo text default '')
returns pedidos
language plpgsql security definer set search_path = public as $$
declare
  v_pedido      pedidos;
  v_pago        pagos;
  v_motivo      text := coalesce(nullif(trim(p_motivo), ''), 'El cliente canceló el pedido');
  v_ofertantes  uuid[];
  v_comprador   uuid;
  v_uno         uuid;
begin
  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if v_pedido.cliente_id <> auth.uid() then
    raise exception 'Solo el dueño del pedido puede cancelarlo';
  end if;
  if v_pedido.estado not in ('publicado', 'aceptado') then
    raise exception 'Un pedido en «%» ya no se cancela desde la app', v_pedido.estado;
  end if;

  select * into v_pago from pagos where pedido_id = p_pedido_id for update;
  if found and v_pago.estado <> 'pendiente' then
    raise exception 'Ya reportaste el pago. Abre una disputa para que el equipo revise el caso';
  end if;

  -- Quienes tenían una oferta viva, antes de rechazarlas
  select array_agg(distinct comprador_id) into v_ofertantes
    from ofertas
   where pedido_id = p_pedido_id and estado in ('enviada', 'aceptada');
  v_comprador := comprador_del_pedido(p_pedido_id);

  update ofertas set estado = 'rechazada'
   where pedido_id = p_pedido_id and estado in ('enviada', 'aceptada');

  -- fn_aviso_pedido lo lee para el aviso al comprador con pago
  perform set_config('app.motivo_cancelacion', v_motivo, true);

  update pedidos set estado = 'cancelado', oferta_aceptada_id = null
   where id = p_pedido_id
  returning * into v_pedido;

  -- El trigger de 0002 ya registró el cambio de estado sin nota. En vez de
  -- duplicar la fila, se le escribe el motivo encima.
  update eventos_pedido
     set nota = v_motivo
   where id = (select max(id) from eventos_pedido where pedido_id = p_pedido_id);

  -- El resto de quienes ofertaron: el comprador con pago ya recibió el suyo
  foreach v_uno in array coalesce(v_ofertantes, '{}') loop
    if v_uno is distinct from v_comprador then
      perform fn_avisar(
        v_uno, p_pedido_id, 'oferta',
        'El cliente canceló el pedido',
        '«' || v_pedido.titulo || '». Tu oferta ya no está activa. Motivo del cliente: '
          || v_motivo);
    end if;
  end loop;

  perform set_config('app.motivo_cancelacion', '', true);
  return v_pedido;
end $$;
