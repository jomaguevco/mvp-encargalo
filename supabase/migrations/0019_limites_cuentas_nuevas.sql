-- =====================================================================
--  ENCÁRGALO · MVP · Límites para cuentas nuevas (acción ES-17)
--
--  1. Un cliente con menos de 3 pedidos completados (confirmados) no puede
--     tener un pedido de más de S/ 500.
--  2. Un pedido de más de S/ 1 500 necesita una «verificación reforzada»:
--     una videollamada con el operador. No se bloquea: el pedido se publica
--     y recibe ofertas, pero el pago queda retenido en espera (no se puede
--     reportar ni confirmar) hasta que un administrador registre en el panel
--     que la videollamada se hizo y aprueba.
--
--  Cómo conviven con el tope del piloto (0018, S/ 150 sobre el total):
--  al aceptar una oferta se comprueban los dos y vale el MENOR. Mientras el
--  tope del piloto esté activo es el que manda; el de cuentas nuevas toma el
--  relevo cuando el tope se quite (tope_pedido = 0).
--
--  Qué monto se compara:
--   · al publicar: el valor referencial que escribe el cliente (es lo único
--     que hay todavía);
--   · al aceptar: el total que paga el cliente (encargo + comisión +
--     procesamiento), igual que el tope del piloto.
--
--  Los tres números viven en `config` (0 = regla desactivada).
-- =====================================================================

insert into config (clave, valor, descripcion) values
  ('limite_cuenta_nueva', 500,
   'Máximo en soles por pedido para cuentas nuevas (menos pedidos completados que pedidos_cuenta_establecida). 0 = sin límite'),
  ('pedidos_cuenta_establecida', 3,
   'Pedidos completados a partir de los cuales una cuenta deja de ser nueva'),
  ('umbral_verificacion_reforzada', 1500,
   'Pedidos por encima de este monto en soles esperan una videollamada con el operador antes del pago. 0 = desactivado')
on conflict (clave) do update
  set valor = excluded.valor, descripcion = excluded.descripcion;


-- ---------------------------------------------------------------------
--  Verificación reforzada: columnas del pedido
--  null        el pedido no la necesita
--  pendiente   espera la videollamada; el pago no avanza
--  aprobada    el operador hizo la videollamada y aprobó (hasta reforzada_monto)
--  rechazada   el operador no aprobó; el cliente puede cancelar el pedido
-- ---------------------------------------------------------------------
alter table pedidos add column if not exists reforzada_estado text;
alter table pedidos add column if not exists reforzada_monto numeric(10,2);
alter table pedidos add column if not exists reforzada_marcada_en timestamptz;
alter table pedidos add column if not exists reforzada_resuelta_en timestamptz;
alter table pedidos add column if not exists reforzada_resuelta_por uuid
  references profiles(id) on delete set null;
alter table pedidos add column if not exists reforzada_nota text;

alter table pedidos drop constraint if exists pedidos_reforzada_estado_check;
alter table pedidos add constraint pedidos_reforzada_estado_check
  check (reforzada_estado is null
         or reforzada_estado in ('pendiente', 'aprobada', 'rechazada'));

create index if not exists pedidos_reforzada_idx
  on pedidos (reforzada_estado, reforzada_marcada_en desc)
  where reforzada_estado is not null;


-- ---------------------------------------------------------------------
--  Límites de un cliente
--  Cada usuario solo puede preguntar por los suyos (la app usa
--  mis_limites_pedido()); el equipo y las funciones de la base, por
--  cualquiera.
-- ---------------------------------------------------------------------
create or replace function fn_limites_cliente(p_cliente uuid)
returns table (
  completados          int,
  pedidos_necesarios   int,
  cuenta_nueva         boolean,
  limite_cuenta_nueva  numeric,   -- null si no aplica a esta cuenta
  tope_piloto          numeric,   -- null si el tope está desactivado
  maximo               numeric,   -- el menor de los dos; null = sin máximo
  umbral_reforzada     numeric    -- null si la regla está desactivada
) language plpgsql stable security definer set search_path = public as $$
declare
  v_hechos    int;
  v_necesarios int := coalesce(cfg('pedidos_cuenta_establecida'), 3)::int;
  v_nueva     boolean;
  v_limite    numeric := nullif(coalesce(cfg('limite_cuenta_nueva'), 0), 0);
  v_tope      numeric := nullif(coalesce(cfg('tope_pedido'), 0), 0);
begin
  if auth.uid() is not null and p_cliente is distinct from auth.uid() and not soy_operador() then
    raise exception 'Solo puedes consultar los límites de tu propia cuenta';
  end if;

  select count(*)::int into v_hechos
    from pedidos where cliente_id = p_cliente and estado = 'confirmado';
  v_nueva := v_hechos < v_necesarios;

  completados         := v_hechos;
  pedidos_necesarios  := v_necesarios;
  cuenta_nueva        := v_nueva;
  limite_cuenta_nueva := case when v_nueva then v_limite end;
  tope_piloto         := v_tope;
  -- least() ignora los null: si no hay ninguna regla activa queda null.
  maximo              := least(case when v_nueva then v_limite end, v_tope);
  umbral_reforzada    := nullif(coalesce(cfg('umbral_verificacion_reforzada'), 0), 0);
  return next;
end $$;

revoke execute on function fn_limites_cliente(uuid) from public, anon;
grant execute on function fn_limites_cliente(uuid) to authenticated;

create or replace function mis_limites_pedido()
returns table (
  completados          int,
  pedidos_necesarios   int,
  cuenta_nueva         boolean,
  limite_cuenta_nueva  numeric,
  tope_piloto          numeric,
  maximo               numeric,
  umbral_reforzada     numeric
) language sql stable security definer set search_path = public as $$
  select * from fn_limites_cliente(auth.uid());
$$;

revoke execute on function mis_limites_pedido() from public, anon;
grant execute on function mis_limites_pedido() to authenticated;


-- ---------------------------------------------------------------------
--  Al publicar o editar un pedido
--  · Las columnas reforzada_* solo las escriben aceptar_oferta y el panel
--    (que encienden app.reforzada_autorizada); el cliente no puede
--    aprobarse a sí mismo con un UPDATE directo.
--  · Cuenta nueva: el valor referencial no puede pasar del límite.
--  · Valor referencial sobre el umbral: queda marcado para revisión.
--  Sin security definer, igual que fn_proteger_suspension (0012): así
--  current_user es quien escribe de verdad.
-- ---------------------------------------------------------------------
create or replace function fn_limites_pedido()
returns trigger language plpgsql set search_path = public as $$
declare
  v_lim record;
begin
  if current_user <> 'service_role'
     and coalesce(current_setting('app.reforzada_autorizada', true), '0') <> '1' then
    if tg_op = 'INSERT' then
      new.reforzada_estado       := null;
      new.reforzada_monto        := null;
      new.reforzada_marcada_en   := null;
      new.reforzada_resuelta_en  := null;
      new.reforzada_resuelta_por := null;
      new.reforzada_nota         := null;
    else
      new.reforzada_estado       := old.reforzada_estado;
      new.reforzada_monto        := old.reforzada_monto;
      new.reforzada_marcada_en   := old.reforzada_marcada_en;
      new.reforzada_resuelta_en  := old.reforzada_resuelta_en;
      new.reforzada_resuelta_por := old.reforzada_resuelta_por;
      new.reforzada_nota         := old.reforzada_nota;
    end if;
  end if;

  if new.valor_referencial is not null
     and new.estado = 'publicado'
     and (tg_op = 'INSERT' or new.valor_referencial is distinct from old.valor_referencial) then

    select * into v_lim from fn_limites_cliente(new.cliente_id);

    if v_lim.limite_cuenta_nueva is not null
       and new.valor_referencial > v_lim.limite_cuenta_nueva then
      raise exception
        'Mientras tengas menos de % pedidos completados, cada pedido puede ser de hasta S/ % (este es de S/ %). Cuando completes % más, el límite se levanta.',
        v_lim.pedidos_necesarios,
        to_char(v_lim.limite_cuenta_nueva, 'FM999990.00'),
        to_char(new.valor_referencial, 'FM999990.00'),
        v_lim.pedidos_necesarios - v_lim.completados;
    end if;

    if v_lim.umbral_reforzada is not null
       and new.valor_referencial > v_lim.umbral_reforzada
       and new.reforzada_estado is null then
      new.reforzada_estado     := 'pendiente';
      new.reforzada_monto      := new.valor_referencial;
      new.reforzada_marcada_en := now();
    end if;
  end if;

  return new;
end $$;

drop trigger if exists tr_limites_pedido on pedidos;
create trigger tr_limites_pedido
  before insert or update on pedidos
  for each row execute function fn_limites_pedido();


-- ---------------------------------------------------------------------
--  aceptar_oferta: la misma de 0016 más las dos reglas nuevas
-- ---------------------------------------------------------------------
create or replace function aceptar_oferta(p_oferta_id uuid)
returns pagos
language plpgsql security definer set search_path = public as $$
declare
  v_oferta    ofertas;
  v_pedido    pedidos;
  v_comision  numeric(10,2);
  v_proc      numeric(10,2);
  v_total     numeric(10,2);
  v_tarifa    numeric(10,2);
  v_tope      numeric;
  v_lim       record;
  v_reforzada text;
  v_ref_monto numeric(10,2);
  v_ref_desde timestamptz;
  v_pago      pagos;
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
  if v_pedido.reforzada_estado = 'rechazada' then
    raise exception
      'El equipo no aprobó la verificación reforzada de este pedido. Puedes cancelarlo o escribirnos para revisarlo.';
  end if;

  -- Desglose de precio. El cliente lo ve completo ANTES de pagar.
  v_comision := round(v_oferta.precio_final * cfg('comision_cliente'), 2);
  v_total    := round((v_oferta.precio_final + v_comision)
                      * (1 + cfg('cargo_procesamiento')), 2);
  v_proc     := v_total - v_oferta.precio_final - v_comision;
  v_tarifa   := round(v_oferta.precio_final * cfg('tarifa_comprador'), 2);

  -- Tope del piloto (0018): mientras esté activo es el más estricto.
  v_tope := coalesce(cfg('tope_pedido'), 0);
  if v_tope > 0 and v_total > v_tope then
    raise exception
      'En el piloto el total de un pedido no puede superar S/ % (este suma S/ %). Pide una oferta menor.',
      to_char(v_tope, 'FM999990.00'), to_char(v_total, 'FM999990.00');
  end if;

  -- Límite de cuentas nuevas (ES-17).
  select * into v_lim from fn_limites_cliente(v_pedido.cliente_id);
  if v_lim.limite_cuenta_nueva is not null and v_total > v_lim.limite_cuenta_nueva then
    raise exception
      'Mientras tengas menos de % pedidos completados, el total de un pedido no puede superar S/ % (este suma S/ %). Pide una oferta menor.',
      v_lim.pedidos_necesarios,
      to_char(v_lim.limite_cuenta_nueva, 'FM999990.00'), to_char(v_total, 'FM999990.00');
  end if;

  -- Verificación reforzada (ES-17): no bloquea la aceptación, deja el pago
  -- en espera hasta la videollamada (ver tr_reforzada_pago).
  v_reforzada := v_pedido.reforzada_estado;
  v_ref_monto := v_pedido.reforzada_monto;
  v_ref_desde := v_pedido.reforzada_marcada_en;
  if v_lim.umbral_reforzada is not null and v_total > v_lim.umbral_reforzada then
    -- Una aprobación vale hasta el monto que se revisó.
    if v_reforzada is distinct from 'aprobada' or v_total > coalesce(v_ref_monto, 0) then
      v_reforzada := 'pendiente';
      v_ref_monto := v_total;
      v_ref_desde := now();
    end if;
  elsif v_reforzada = 'pendiente' then
    -- Se marcó por el valor referencial, pero el total real no llega al
    -- umbral: no hace falta la videollamada.
    v_reforzada := null;
    v_ref_monto := null;
    v_ref_desde := null;
  end if;

  update ofertas set estado = 'aceptada'  where id = p_oferta_id;
  update ofertas set estado = 'rechazada'
   where pedido_id = v_oferta.pedido_id and id <> p_oferta_id and estado = 'enviada';

  perform set_config('app.reforzada_autorizada', '1', true);
  update pedidos
     set estado = 'aceptado', oferta_aceptada_id = p_oferta_id,
         reforzada_estado     = v_reforzada,
         reforzada_monto      = v_ref_monto,
         reforzada_marcada_en = v_ref_desde
   where id = v_pedido.id;
  perform set_config('app.reforzada_autorizada', '0', true);

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


-- ---------------------------------------------------------------------
--  El pago espera a la videollamada
--  Mientras la verificación reforzada no esté aprobada, el cliente no
--  puede reportar el pago ni el equipo confirmarlo. Va como trigger para
--  cubrir reportar_pago y confirmar_retencion sin reescribirlas.
-- ---------------------------------------------------------------------
create or replace function fn_reforzada_pago()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  if new.estado in ('en_revision', 'retenido')
     and new.estado is distinct from old.estado then
    select reforzada_estado into v_estado from pedidos where id = new.pedido_id;
    if v_estado = 'pendiente' then
      raise exception
        'Este pedido necesita una verificación reforzada: una videollamada corta con el equipo de Encárgalo. Te escribiremos por el chat del pedido para coordinarla y, cuando quede aprobada, podrás pagar.';
    elsif v_estado = 'rechazada' then
      raise exception
        'El equipo no aprobó la verificación reforzada de este pedido, así que no se puede pagar.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_reforzada_pago on pagos;
create trigger tr_reforzada_pago
  before update on pagos
  for each row execute function fn_reforzada_pago();


-- ---------------------------------------------------------------------
--  Panel /admin: cola de verificación reforzada
-- ---------------------------------------------------------------------
create or replace function admin_verificaciones_reforzadas(p_estado text default 'pendiente')
returns table (
  pedido_id      uuid,
  titulo         text,
  estado_pedido  text,
  cliente_id     uuid,
  cliente        text,
  telefono       text,
  completados    bigint,
  monto          numeric,
  total_cobrado  numeric,
  reforzada      text,
  marcada_en     timestamptz,
  resuelta_en    timestamptz,
  resuelta_por   text,
  nota           text
) language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select pe.id, pe.titulo, pe.estado::text, pe.cliente_id,
           cl.nombre_completo, cl.telefono,
           (select count(*) from pedidos x
             where x.cliente_id = pe.cliente_id and x.estado = 'confirmado'),
           pe.reforzada_monto, g.total_cobrado, pe.reforzada_estado,
           pe.reforzada_marcada_en, pe.reforzada_resuelta_en,
           op.nombre_completo, pe.reforzada_nota
    from pedidos pe
    join profiles cl on cl.id = pe.cliente_id
    left join pagos g on g.pedido_id = pe.id
    left join profiles op on op.id = pe.reforzada_resuelta_por
    where pe.reforzada_estado is not null
      and (p_estado is null or p_estado = '' or pe.reforzada_estado = p_estado)
    order by pe.reforzada_marcada_en desc nulls last
    limit 500;
end $$;

create or replace function admin_resolver_reforzada(
  p_pedido uuid, p_aprobar boolean, p_nota text
) returns void language plpgsql security definer set search_path = public as $$
declare v_pedido pedidos;
begin
  perform exigir_admin();

  if length(trim(coalesce(p_nota, ''))) < 5 then
    raise exception 'Anota cómo fue la videollamada (mínimo 5 caracteres): fecha, hora y qué se comprobó';
  end if;

  select * into v_pedido from pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Ese pedido no existe';
  end if;
  if v_pedido.reforzada_estado is distinct from 'pendiente' then
    raise exception 'Este pedido no tiene una verificación reforzada pendiente';
  end if;

  perform set_config('app.reforzada_autorizada', '1', true);
  update pedidos
     set reforzada_estado       = case when p_aprobar then 'aprobada' else 'rechazada' end,
         reforzada_resuelta_en  = now(),
         reforzada_resuelta_por = auth.uid(),
         reforzada_nota         = trim(p_nota)
   where id = p_pedido;
  perform set_config('app.reforzada_autorizada', '0', true);

  perform registrar_bitacora(
    case when p_aprobar then 'reforzada_aprobada' else 'reforzada_rechazada' end,
    'pedido', p_pedido::text,
    jsonb_build_object('monto', v_pedido.reforzada_monto, 'nota', trim(p_nota)));

  perform fn_avisar(
    v_pedido.cliente_id, p_pedido, 'reforzada',
    case when p_aprobar then 'Verificación reforzada aprobada'
         else 'Verificación reforzada no aprobada' end,
    case when p_aprobar then 'Ya puedes pagar tu pedido «' || v_pedido.titulo || '».'
         else 'No pudimos aprobar tu pedido «' || v_pedido.titulo
              || '». Puedes cancelarlo o escribirnos para revisarlo.' end);
end $$;
