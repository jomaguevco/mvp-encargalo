-- =====================================================================
--  ENCÁRGALO · MVP · Comisión activa y límites para cuentas nuevas
--
--  ES-03 «Activar la comisión» (desde el 02/11/2026)
--    Todo pedido nuevo cobra la comisión de la tabla config: 10 % al cliente
--    y 3 % al comprador externo. Los clientes del piloto conservan 0 % de
--    comisión en su primer pedido posterior (el comprador externo sí paga su 3 %).
--    «Cliente del piloto» = tuvo un pedido creado antes del 02/11/2026 cuyo
--    pago llegó a retenerse o liberarse.
--
--  ES-17 «Límites para cuentas nuevas» (16/11 al 27/11)
--    - Hasta completar 3 pedidos (confirmados por el cliente), cada pedido
--      puede ser de como máximo S/ 500.
--    - Los pedidos de más de S/ 1,500 exigen una verificación reforzada: una
--      videollamada con un operador, que el operador registra en la consola.
--    Los montos viven en config y se cambian desde el panel /admin.
--
--  Indicadores (ver README, «Indicadores de las tareas»):
--    ES-03 = suma de comision_cliente + tarifa_comprador de pagos liberados.
--    ES-17 = pedidos en disputa ÷ pedidos con pago retenido.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Configuración
-- ---------------------------------------------------------------------

-- Activar la comisión: si durante el piloto se bajó a 0 desde el panel, vuelve
-- a los valores del flujo de caja.
update config set valor = 0.10 where clave = 'comision_cliente';
update config set valor = 0.03 where clave = 'tarifa_comprador';

insert into config (clave, valor, descripcion) values
  ('limite_cuenta_nueva', 500,
   'Monto máximo de un pedido (S/) mientras el cliente no completa sus primeros pedidos'),
  ('pedidos_para_quitar_limite', 3,
   'Pedidos confirmados que necesita un cliente para dejar de tener el límite de cuenta nueva'),
  ('monto_videollamada', 1500,
   'Pedidos de más de este monto (S/) exigen una videollamada de verificación con un operador')
on conflict (clave) do nothing;

-- Fin del piloto sin comisión. Es una fecha del plan, no una tarifa: vive aquí.
create or replace function fin_del_piloto()
returns date language sql immutable as $$ select date '2026-11-02' $$;


-- ---------------------------------------------------------------------
--  2. Beneficio del piloto
-- ---------------------------------------------------------------------

alter table pagos add column if not exists beneficio_piloto boolean not null default false;

comment on column pagos.beneficio_piloto is
  'El cliente no pagó comisión en este pedido por haber participado en el piloto (ES-03).';

/** ¿El cliente participó en el piloto con un pago real? */
create or replace function es_cliente_del_piloto(p_cliente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from pagos g
    join pedidos p on p.id = g.pedido_id
    where p.cliente_id = p_cliente
      and p.creado_en < fin_del_piloto()
      and g.estado in ('retenido', 'liberado')
  );
$$;

/**
 * ¿Le toca 0 % de comisión en este pedido? Solo si es cliente del piloto, el
 * pedido es posterior al piloto y todavía no usó el beneficio en otro pedido
 * vigente (uno cancelado devuelve el beneficio).
 */
create or replace function beneficio_piloto_disponible(p_cliente uuid, p_pedido uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select es_cliente_del_piloto(p_cliente)
     and exists (
       select 1 from pedidos
       where id = p_pedido and creado_en >= fin_del_piloto()
     )
     and not exists (
       select 1
       from pagos g
       join pedidos p on p.id = g.pedido_id
       where p.cliente_id = p_cliente
         and g.beneficio_piloto
         and g.pedido_id <> p_pedido
         and p.estado <> 'cancelado'
     );
$$;


-- ---------------------------------------------------------------------
--  3. Límites para cuentas nuevas y videollamada
-- ---------------------------------------------------------------------

/** Pedidos que el cliente ya recibió y confirmó. */
create or replace function pedidos_completados(p_cliente uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from pedidos where cliente_id = p_cliente and estado = 'confirmado';
$$;

-- Videollamadas de verificación reforzada. Tabla aparte (no columnas en
-- profiles) para que nadie pueda marcarse a sí mismo: solo la escribe
-- registrar_videollamada(), que exige ser operador.
create table if not exists videollamadas (
  perfil_id      uuid primary key references profiles (id) on delete cascade,
  verificado_en  timestamptz not null default now(),
  operador_id    uuid references profiles (id),
  nota           text
);

alter table videollamadas enable row level security;

drop policy if exists videollamada_ver_propia on videollamadas;
create policy videollamada_ver_propia on videollamadas
  for select using (perfil_id = auth.uid() or soy_operador());

create or replace function registrar_videollamada(p_perfil uuid, p_nota text default null)
returns videollamadas
language plpgsql security definer set search_path = public as $$
declare
  v_fila videollamadas;
begin
  if not soy_operador() then
    raise exception 'Solo el equipo de Encárgalo puede registrar una videollamada';
  end if;
  if p_perfil = auth.uid() then
    raise exception 'No puedes registrar tu propia videollamada';
  end if;
  if not exists (select 1 from profiles where id = p_perfil and verificacion = 'verificado') then
    raise exception 'La cuenta debe tener la identidad verificada antes de la videollamada';
  end if;

  insert into videollamadas (perfil_id, operador_id, nota)
  values (p_perfil, auth.uid(), nullif(trim(coalesce(p_nota, '')), ''))
  on conflict (perfil_id) do update
    set verificado_en = now(), operador_id = auth.uid(), nota = excluded.nota
  returning * into v_fila;

  perform registrar_bitacora('videollamada_verificada', 'perfil', p_perfil::text,
    jsonb_build_object('nota', v_fila.nota));
  return v_fila;
end $$;

revoke execute on function registrar_videollamada(uuid, text) from public, anon;
grant execute on function registrar_videollamada(uuid, text) to authenticated;

/**
 * Lo que la app necesita para avisar antes de que choque con un límite: el
 * tope vigente (null = sin tope), cuántos pedidos lleva, si tiene la
 * videollamada y si su próximo pedido no paga comisión.
 */
create or replace function mis_limites()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid         uuid := auth.uid();
  v_completados int;
  v_requeridos  int := coalesce(cfg('pedidos_para_quitar_limite'), 3)::int;
  v_usado       boolean;
begin
  if v_uid is null then
    raise exception 'Inicia sesión';
  end if;
  v_completados := pedidos_completados(v_uid);
  select exists (
    select 1 from pagos g join pedidos p on p.id = g.pedido_id
    where p.cliente_id = v_uid and g.beneficio_piloto and p.estado <> 'cancelado'
  ) into v_usado;

  return jsonb_build_object(
    'limite', case when v_completados < v_requeridos then cfg('limite_cuenta_nueva') end,
    'completados', v_completados,
    'requeridos', v_requeridos,
    'monto_videollamada', cfg('monto_videollamada'),
    'videollamada', exists (select 1 from videollamadas where perfil_id = v_uid),
    'beneficio_piloto', es_cliente_del_piloto(v_uid) and not v_usado
  );
end $$;

revoke execute on function mis_limites() from public, anon;
grant execute on function mis_limites() to authenticated;

/** Mensaje si el monto supera el límite del cliente; null si está permitido. */
create or replace function problema_de_limite(p_cliente uuid, p_monto numeric)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_completados int := pedidos_completados(p_cliente);
  v_requeridos  int := coalesce(cfg('pedidos_para_quitar_limite'), 3)::int;
  v_limite      numeric := cfg('limite_cuenta_nueva');
  v_video       numeric := cfg('monto_videollamada');
begin
  if p_monto is null then
    return null;
  end if;
  if v_completados < v_requeridos and v_limite is not null and p_monto > v_limite then
    return format(
      'Mientras completas tus primeros %s pedidos, cada pedido puede ser de hasta S/ %s. Llevas %s.',
      v_requeridos, to_char(v_limite, 'FM999G999'), v_completados);
  end if;
  if v_video is not null and p_monto > v_video
     and not exists (select 1 from videollamadas where perfil_id = p_cliente) then
    return format(
      'Los pedidos de más de S/ %s necesitan una videollamada corta de verificación con el '
      'equipo de Encárgalo. Escríbenos para coordinarla y luego podrás aceptar la oferta.',
      to_char(v_video, 'FM999G999'));
  end if;
  return null;
end $$;

revoke execute on function problema_de_limite(uuid, numeric) from public, anon, authenticated;

-- Al publicar: el valor referencial no puede pasar el límite de cuenta nueva.
-- (La videollamada se exige al aceptar, que es cuando se compromete el dinero.)
create or replace function fn_limite_al_publicar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_completados int;
begin
  -- Sin sesión (SQL Editor, service_role, semillas) no se aplica el límite.
  if new.valor_referencial is null or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.valor_referencial is not distinct from old.valor_referencial then
    return new;
  end if;
  v_completados := pedidos_completados(new.cliente_id);
  if v_completados < coalesce(cfg('pedidos_para_quitar_limite'), 3)
     and new.valor_referencial > cfg('limite_cuenta_nueva') then
    raise exception 'Mientras completas tus primeros % pedidos, cada pedido puede ser de hasta S/ %. Llevas %.',
      coalesce(cfg('pedidos_para_quitar_limite'), 3)::int,
      to_char(cfg('limite_cuenta_nueva'), 'FM999G999'), v_completados;
  end if;
  return new;
end $$;

drop trigger if exists tr_limite_al_publicar on pedidos;
create trigger tr_limite_al_publicar
  before insert or update of valor_referencial on pedidos
  for each row execute function fn_limite_al_publicar();


-- ---------------------------------------------------------------------
--  4. aceptar_oferta con comisión, beneficio y límites
--     Misma función que 0006_modulos.sql, más: cuenta suspendida, límites
--     de monto y comisión 0 % para el beneficio del piloto.
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
  v_beneficio boolean;
  v_problema  text;
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
  if exists (select 1 from profiles where id = v_pedido.cliente_id and suspendido) then
    raise exception 'Tu cuenta está suspendida. Escríbenos para revisarla';
  end if;

  v_problema := problema_de_limite(v_pedido.cliente_id, v_oferta.precio_final);
  if v_problema is not null then
    raise exception '%', v_problema;
  end if;

  -- Desglose de precio. El cliente lo ve completo ANTES de pagar.
  v_beneficio := beneficio_piloto_disponible(v_pedido.cliente_id, v_pedido.id);
  v_comision := case when v_beneficio then 0
                     else round(v_oferta.precio_final * cfg('comision_cliente'), 2) end;
  v_total    := round((v_oferta.precio_final + v_comision)
                      * (1 + cfg('cargo_procesamiento')), 2);
  v_proc     := v_total - v_oferta.precio_final - v_comision;
  v_tarifa   := round(v_oferta.precio_final * cfg('tarifa_comprador'), 2);

  update ofertas set estado = 'aceptada'  where id = p_oferta_id;
  update ofertas set estado = 'rechazada'
   where pedido_id = v_oferta.pedido_id and id <> p_oferta_id and estado = 'enviada';

  update pedidos
     set estado = 'aceptado', oferta_aceptada_id = p_oferta_id
   where id = v_pedido.id;

  insert into pagos (
    pedido_id, oferta_id, cliente_id, comprador_id,
    monto_encargo, comision_cliente, cargo_procesamiento, total_cobrado,
    tarifa_comprador, monto_liberado, beneficio_piloto
  ) values (
    v_pedido.id, p_oferta_id, v_pedido.cliente_id, v_oferta.comprador_id,
    v_oferta.precio_final, v_comision, v_proc, v_total,
    v_tarifa, v_oferta.precio_final - v_tarifa, v_beneficio
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
        beneficio_piloto = excluded.beneficio_piloto,
        estado = 'pendiente',
        -- Si el pedido se reabrió, el comprobante anterior ya no vale
        metodo = null,
        codigo_operacion = null,
        comprobante_path = null,
        reportado_en = null
  returning * into v_pago;

  return v_pago;
end $$;

-- Funciones internas: solo las usan las de este archivo.
revoke execute on function es_cliente_del_piloto(uuid) from public, anon, authenticated;
revoke execute on function beneficio_piloto_disponible(uuid, uuid) from public, anon, authenticated;
revoke execute on function pedidos_completados(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
--  5. Panel de configuración: los montos nuevos se editan con sus rangos
-- ---------------------------------------------------------------------
create or replace function admin_actualizar_config(p_clave text, p_valor numeric)
returns config language plpgsql security definer set search_path = public as $$
declare
  v_viejo numeric;
  v_fila  config;
  v_min   numeric;
  v_max   numeric;
begin
  perform exigir_admin();

  select valor into v_viejo from config where clave = p_clave;
  if not found then
    raise exception 'No existe la clave de configuración «%»', p_clave;
  end if;

  select lim.mn, lim.mx into v_min, v_max
  from (values
    ('comision_cliente',           0::numeric, 0.30::numeric),
    ('tarifa_comprador',           0,          0.30),
    ('cargo_procesamiento',        0,          0.10),
    ('dias_para_confirmar',        1,          60),
    ('umbral_rostro_aprobar',      50,         100),
    ('umbral_rostro_rechazar',     0,          95),
    ('aprobacion_automatica',      0,          1),
    ('limite_cuenta_nueva',        50,         10000),
    ('pedidos_para_quitar_limite', 0,          20),
    ('monto_videollamada',         100,        50000)
  ) as lim(clave, mn, mx)
  where lim.clave = p_clave;

  if v_min is not null and (p_valor < v_min or p_valor > v_max) then
    raise exception 'El valor de «%» debe estar entre % y %', p_clave, v_min, v_max;
  end if;

  if p_clave = 'umbral_rostro_aprobar' and p_valor <= coalesce(cfg('umbral_rostro_rechazar'), 0) then
    raise exception 'El umbral para aprobar debe ser mayor que el de rechazo';
  end if;
  if p_clave = 'umbral_rostro_rechazar' and p_valor >= coalesce(cfg('umbral_rostro_aprobar'), 100) then
    raise exception 'El umbral de rechazo debe ser menor que el de aprobación';
  end if;
  if p_clave = 'aprobacion_automatica' and p_valor not in (0, 1) then
    raise exception 'La aprobación automática solo puede ser 0 (apagada) o 1 (encendida)';
  end if;

  update config set valor = p_valor where clave = p_clave returning * into v_fila;

  perform registrar_bitacora('config_actualizada', 'config', p_clave,
    jsonb_build_object('antes', v_viejo, 'despues', p_valor));
  return v_fila;
end $$;
