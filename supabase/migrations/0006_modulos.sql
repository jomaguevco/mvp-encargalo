-- =====================================================================
--  ENCÁRGALO · MVP · Los módulos que cerraban el flujo
--  Lo que faltaba para operar el recorrido completo sin entrar al panel
--  de Supabase:
--    · cancelar un pedido antes de que haya dinero en juego
--    · retirar una oferta que ya no se puede cumplir
--    · reseñas públicas (el comentario, no solo el promedio)
--    · el plazo de `dias_para_confirmar`, que estaba en config desde
--      0004 sin que nada lo leyera
--    · las ofertas enviadas, que no aparecían en ninguna pantalla
--  Además endurece cuatro funciones de 0002 que, cuando la fila no
--  existía, seguían adelante con una variable nula.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Arreglos de null-safety en las funciones de 0002
--  `select ... into` sin fila deja la variable en null, y `null <> 'x'`
--  vale null, no true: el `if` no entraba y la función continuaba.
--  En confirmar_retencion eso dejaba un pedido en «pagado» sin pago.
-- ---------------------------------------------------------------------
create or replace function confirmar_retencion(p_pedido_id uuid)
returns pagos
language plpgsql security definer set search_path = public as $$
declare v_pago pagos;
begin
  if not soy_operador() then
    raise exception 'Solo el equipo de Encárgalo puede confirmar que un pago llegó';
  end if;

  select * into v_pago from pagos where pedido_id = p_pedido_id for update;
  if not found then
    raise exception 'Este pedido todavía no tiene un pago generado';
  end if;
  if v_pago.estado <> 'en_revision' then
    raise exception 'El pago no está en revisión (estado: %)', v_pago.estado;
  end if;

  update pagos set estado = 'retenido', retenido_en = now()
   where id = v_pago.id returning * into v_pago;

  update pedidos set estado = 'pagado' where id = p_pedido_id;
  return v_pago;
end $$;


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


create or replace function calificar(
  p_pedido_id uuid, p_puntaje int, p_comentario text default ''
) returns calificaciones
language plpgsql security definer set search_path = public as $$
declare
  v_pedido     pedidos;
  v_comprador  uuid;
  v_calificado uuid;
  v_fila       calificaciones;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  select comprador_id into v_comprador from pagos where pedido_id = p_pedido_id;

  if v_pedido.estado <> 'confirmado' then
    raise exception 'Solo se puede calificar un pedido confirmado';
  end if;

  if auth.uid() = v_pedido.cliente_id then
    v_calificado := v_comprador;
  elsif auth.uid() = v_comprador then
    v_calificado := v_pedido.cliente_id;
  else
    raise exception 'No participaste en este pedido';
  end if;

  if v_calificado is null then
    raise exception 'Este pedido no tiene una contraparte a quien calificar';
  end if;

  insert into calificaciones (pedido_id, califica_id, calificado_id, puntaje, comentario)
  values (p_pedido_id, auth.uid(), v_calificado, p_puntaje, coalesce(p_comentario, ''))
  on conflict (pedido_id, califica_id)
    do update set puntaje = excluded.puntaje, comentario = excluded.comentario
  returning * into v_fila;

  return v_fila;
end $$;


create or replace function resolver_disputa(
  p_disputa_id uuid, p_a_favor_del_cliente boolean, p_resolucion text
) returns disputas
language plpgsql security definer set search_path = public as $$
declare
  v_disputa disputas;
  v_pago    pagos;
begin
  if not soy_operador() then
    raise exception 'Solo el equipo de Encárgalo puede resolver disputas';
  end if;

  select * into v_disputa from disputas where id = p_disputa_id for update;
  if not found then
    raise exception 'Esa disputa no existe';
  end if;
  if v_disputa.estado in ('resuelta_cliente', 'resuelta_comprador') then
    raise exception 'Esta disputa ya fue resuelta';
  end if;

  select * into v_pago from pagos where pedido_id = v_disputa.pedido_id for update;
  if not found then
    raise exception 'El pedido de esta disputa no tiene un pago asociado';
  end if;
  if v_pago.estado <> 'retenido' then
    raise exception 'El dinero de este pedido no está retenido (estado: %)',
      v_pago.estado;
  end if;

  if p_a_favor_del_cliente then
    update pagos set estado = 'reembolsado' where id = v_pago.id;
    update pedidos set estado = 'cancelado' where id = v_disputa.pedido_id;
  else
    update pagos set estado = 'liberado', liberado_en = now() where id = v_pago.id;
    update pedidos set estado = 'confirmado' where id = v_disputa.pedido_id;
  end if;

  update disputas
     set estado = case when p_a_favor_del_cliente then 'resuelta_cliente'::estado_disputa
                       else 'resuelta_comprador'::estado_disputa end,
         resolucion = p_resolucion,
         resuelta_en = now()
   where id = p_disputa_id
  returning * into v_disputa;

  return v_disputa;
end $$;


-- ---------------------------------------------------------------------
--  Cancelar un pedido
--  Solo el cliente, y solo mientras no haya dinero en tránsito: si ya
--  reportó el pago, el caso lo cierra el equipo por disputa. Cancelar
--  cambia el estado del pedido, así que vive aquí y no en un UPDATE.
-- ---------------------------------------------------------------------
create or replace function cancelar_pedido(p_pedido_id uuid, p_motivo text default '')
returns pedidos
language plpgsql security definer set search_path = public as $$
declare
  v_pedido pedidos;
  v_pago   pagos;
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

  update ofertas set estado = 'rechazada'
   where pedido_id = p_pedido_id and estado in ('enviada', 'aceptada');

  update pedidos set estado = 'cancelado', oferta_aceptada_id = null
   where id = p_pedido_id
  returning * into v_pedido;

  -- El trigger de 0002 ya registró el cambio de estado sin nota. En vez de
  -- duplicar la fila, se le escribe el motivo encima.
  update eventos_pedido
     set nota = coalesce(nullif(trim(p_motivo), ''), 'El cliente canceló el pedido')
   where id = (select max(id) from eventos_pedido where pedido_id = p_pedido_id);

  return v_pedido;
end $$;


-- ---------------------------------------------------------------------
--  Retirar una oferta
--  El comprador externo que ya no puede viajar tiene que poder salirse
--  antes de que se la acepten. Una oferta aceptada ya no se retira: eso
--  es un incumplimiento y se resuelve por disputa.
-- ---------------------------------------------------------------------
create or replace function retirar_oferta(p_oferta_id uuid)
returns ofertas
language plpgsql security definer set search_path = public as $$
declare v_oferta ofertas;
begin
  select * into v_oferta from ofertas where id = p_oferta_id for update;
  if not found then
    raise exception 'La oferta no existe';
  end if;
  if v_oferta.comprador_id <> auth.uid() then
    raise exception 'Solo puedes retirar tus propias ofertas';
  end if;
  if v_oferta.estado <> 'enviada' then
    raise exception 'Esta oferta ya no está vigente (estado: %)', v_oferta.estado;
  end if;

  update ofertas set estado = 'retirada' where id = p_oferta_id
  returning * into v_oferta;
  return v_oferta;
end $$;


-- ---------------------------------------------------------------------
--  Reseñas públicas de un perfil
--  El promedio ya estaba en v_reputacion, pero el comentario es lo que
--  un cliente lee antes de elegir. Es función y no vista porque necesita
--  el nombre de quien calificó, y profiles solo se ve a sí mismo.
-- ---------------------------------------------------------------------
create or replace function resenas_de(p_perfil uuid, p_limite int default 20)
returns table (
  id         bigint,
  puntaje    int,
  comentario text,
  autor      text,
  pedido     text,
  creado_en  timestamptz
) language sql stable security definer set search_path = public as $$
  select c.id, c.puntaje, c.comentario, a.nombre_completo, pe.titulo, c.creado_en
  from calificaciones c
  join profiles a  on a.id  = c.califica_id
  join pedidos  pe on pe.id = c.pedido_id
  where c.calificado_id = p_perfil
  order by c.creado_en desc
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
$$;


-- ---------------------------------------------------------------------
--  El plazo de confirmación
--  `dias_para_confirmar` estaba en config sin que nada la leyera. Con
--  esto el cliente ve hasta cuándo tiene para confirmar y el equipo ve
--  los pedidos entregados cuyo plazo ya venció, que es el caso que hoy
--  dejaba el dinero retenido para siempre.
-- ---------------------------------------------------------------------
create or replace function fecha_limite_confirmacion(p_pedido_id uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(e.creado_en) + (cfg('dias_para_confirmar') || ' days')::interval
  from eventos_pedido e
  where e.pedido_id = p_pedido_id and e.estado_nuevo = 'entregado';
$$;

create or replace function confirmaciones_vencidas()
returns table (
  pedido_id    uuid,
  titulo       text,
  cliente      text,
  comprador    text,
  monto        numeric,
  entregado_en timestamptz,
  vence_en     timestamptz,
  dias_vencido int
) language plpgsql security definer set search_path = public as $$
begin
  if not soy_operador() then
    raise exception 'No autorizado';
  end if;
  return query
    select pe.id, pe.titulo, cl.nombre_completo, co.nombre_completo,
           g.total_cobrado, ent.entregado_en, ent.vence,
           (current_date - ent.vence::date)
    from pedidos pe
    join pagos    g  on g.pedido_id = pe.id
    join profiles cl on cl.id = g.cliente_id
    join profiles co on co.id = g.comprador_id
    join lateral (
      select max(e.creado_en) as entregado_en,
             max(e.creado_en) + (cfg('dias_para_confirmar') || ' days')::interval
               as vence
      from eventos_pedido e
      where e.pedido_id = pe.id and e.estado_nuevo = 'entregado'
    ) ent on true
    where pe.estado = 'entregado'
      and g.estado = 'retenido'
      and ent.vence < now()
    order by ent.vence;
end $$;

-- Liberación por vencimiento del plazo. No la decide el reloj: la
-- ejecuta un operador después de mirar el caso, y queda en la bitácora
-- con una nota distinta de la confirmación del cliente.
create or replace function liberar_por_vencimiento(p_pedido_id uuid)
returns pagos
language plpgsql security definer set search_path = public as $$
declare
  v_pedido pedidos;
  v_pago   pagos;
  v_vence  timestamptz;
begin
  if not soy_operador() then
    raise exception 'Solo el equipo de Encárgalo puede liberar por vencimiento';
  end if;

  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if v_pedido.estado <> 'entregado' then
    raise exception 'Solo se libera por vencimiento un pedido entregado (estado: %)',
      v_pedido.estado;
  end if;

  v_vence := fecha_limite_confirmacion(p_pedido_id);
  if v_vence is null or v_vence > now() then
    raise exception 'El plazo del cliente todavía no vence';
  end if;

  select * into v_pago from pagos where pedido_id = p_pedido_id for update;
  if not found or v_pago.estado <> 'retenido' then
    raise exception 'No hay un pago retenido para liberar';
  end if;

  update pagos set estado = 'liberado', liberado_en = now()
   where id = v_pago.id returning * into v_pago;

  update pedidos set estado = 'confirmado' where id = p_pedido_id;

  update eventos_pedido
     set nota = 'Liberado por el equipo: venció el plazo de confirmación del cliente'
   where id = (select max(id) from eventos_pedido where pedido_id = p_pedido_id);

  return v_pago;
end $$;


-- ---------------------------------------------------------------------
--  Mis ofertas enviadas
--  «Mis entregas» se listaba por la tabla pagos, así que una oferta
--  todavía sin respuesta no aparecía en ninguna pantalla: el comprador
--  externo no tenía forma de saber qué había ofertado.
-- ---------------------------------------------------------------------
create or replace function mis_ofertas_enviadas()
returns table (
  oferta_id     uuid,
  pedido_id     uuid,
  titulo        text,
  categoria     text,
  precio_final  numeric,
  fecha_entrega date,
  estado_oferta estado_oferta,
  estado_pedido estado_pedido,
  creado_en     timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, pe.id, pe.titulo, pe.categoria, o.precio_final, o.fecha_entrega,
         o.estado, pe.estado, o.creado_en
  from ofertas o
  join pedidos pe on pe.id = o.pedido_id
  where o.comprador_id = auth.uid()
    and o.estado in ('enviada', 'aceptada')
  order by o.creado_en desc;
$$;


-- ---------------------------------------------------------------------
--  La cola de disputas necesita la evidencia
--  `abrir_disputa` siempre aceptó una imagen, pero la cola del equipo no
--  la devolvía, así que el operador resolvía sin verla. Cambia el tipo de
--  retorno, por eso hay que soltar la función antes de recrearla.
-- ---------------------------------------------------------------------
drop function if exists disputas_abiertas();

create or replace function disputas_abiertas()
returns table (
  disputa_id     uuid,
  pedido_id      uuid,
  titulo         text,
  abierta_por    text,
  abierta_por_id uuid,
  motivo         text,
  evidencia_path text,
  monto          numeric,
  estado_pedido  estado_pedido,
  creado_en      timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not soy_operador() then
    raise exception 'No autorizado';
  end if;
  return query
    select d.id, d.pedido_id, pe.titulo, pr.nombre_completo, d.abierta_por,
           d.motivo, d.evidencia_path, g.total_cobrado, pe.estado, d.creado_en
    from disputas d
    join pedidos  pe on pe.id = d.pedido_id
    join profiles pr on pr.id = d.abierta_por
    left join pagos g on g.pedido_id = d.pedido_id
    where d.estado in ('abierta', 'en_revision')
    order by d.creado_en;
end $$;
