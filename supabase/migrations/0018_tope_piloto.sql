-- =====================================================================
--  ENCÁRGALO · MVP · Tope por pedido del piloto (protocolo de pago retenido)
--  El plan estratégico fija un tope de S/ 150 por pedido mientras el dinero
--  se custodia en la cuenta Yape del piloto. El tope se aplica sobre el total
--  que paga el cliente (encargo + comisión + procesamiento), que es lo que
--  realmente entra a la cuenta. Vive en `config` para poder subirlo o
--  quitarlo (poner 0 = sin tope) sin tocar el código.
-- =====================================================================

insert into config (clave, valor, descripcion) values
  ('tope_pedido', 150,
   'Tope en soles del total cobrado por pedido durante el piloto. 0 = sin tope')
on conflict (clave) do update
  set valor = excluded.valor, descripcion = excluded.descripcion;


create or replace function aceptar_oferta(p_oferta_id uuid)
returns pagos
language plpgsql security definer set search_path = public as $$
declare
  v_oferta   ofertas;
  v_pedido   pedidos;
  v_comision numeric(10,2);
  v_proc     numeric(10,2);
  v_total    numeric(10,2);
  v_tarifa   numeric(10,2);
  v_tope     numeric;
  v_pago     pagos;
begin
  select * into v_oferta from ofertas where id = p_oferta_id for update;
  if not found then
    raise exception 'La oferta no existe';
  end if;

  select * into v_pedido from pedidos where id = v_oferta.pedido_id for update;
  if not found then
    raise exception 'El pedido de esa oferta no existe';
  end if;
  if v_pedido.cliente_id <> auth.uid() then
    raise exception 'Solo el dueño del pedido puede aceptar una oferta';
  end if;
  if v_pedido.estado <> 'publicado' then
    raise exception 'El pedido ya no está abierto (estado: %)', v_pedido.estado;
  end if;
  if v_oferta.estado <> 'enviada' then
    raise exception 'Esa oferta ya no está vigente';
  end if;

  -- Desglose de precio. El cliente lo ve completo ANTES de pagar.
  v_comision := round(v_oferta.precio_final * cfg('comision_cliente'), 2);
  v_total    := round((v_oferta.precio_final + v_comision)
                      * (1 + cfg('cargo_procesamiento')), 2);
  v_proc     := v_total - v_oferta.precio_final - v_comision;
  v_tarifa   := round(v_oferta.precio_final * cfg('tarifa_comprador'), 2);

  -- Tope del piloto: si el total supera el tope, la oferta no se puede aceptar.
  v_tope := coalesce(cfg('tope_pedido'), 0);
  if v_tope > 0 and v_total > v_tope then
    raise exception
      'En el piloto el total de un pedido no puede superar S/ % (este suma S/ %). Pide una oferta menor.',
      to_char(v_tope, 'FM999990.00'), to_char(v_total, 'FM999990.00');
  end if;

  update ofertas set estado = 'aceptada'  where id = p_oferta_id;
  update ofertas set estado = 'rechazada'
   where pedido_id = v_oferta.pedido_id and id <> p_oferta_id and estado = 'enviada';

  update pedidos
     set estado = 'aceptado', oferta_aceptada_id = p_oferta_id
   where id = v_pedido.id;

  insert into pagos (
    pedido_id, oferta_id, cliente_id, comprador_id,
    monto_encargo, comision_cliente, cargo_procesamiento, total_cobrado,
    tarifa_comprador, monto_liberado
  ) values (
    v_pedido.id, p_oferta_id, v_pedido.cliente_id, v_oferta.comprador_id,
    v_oferta.precio_final, v_comision, v_proc, v_total,
    v_tarifa, v_oferta.precio_final - v_tarifa
  )
  on conflict (pedido_id) do update
    set oferta_id = excluded.oferta_id,
        comprador_id = excluded.comprador_id,
        monto_encargo = excluded.monto_encargo,
        comision_cliente = excluded.comision_cliente,
        cargo_procesamiento = excluded.cargo_procesamiento,
        total_cobrado = excluded.total_cobrado,
        tarifa_comprador = excluded.tarifa_comprador,
        monto_liberado = excluded.monto_liberado,
        estado = 'pendiente',
        -- Si el pedido se reabrió, el comprobante anterior ya no vale
        metodo = null,
        codigo_operacion = null,
        comprobante_path = null,
        reportado_en = null
  returning * into v_pago;

  return v_pago;
end $$;
