-- =====================================================================
--  ENCÁRGALO · MVP · Reglas de negocio
--  Todo lo que mueve dinero o cambia de estado vive aquí, no en la app.
--  La app solo llama funciones; así un cliente manipulado no puede
--  liberar un pago ni aceptar su propia oferta.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Utilidades
-- ---------------------------------------------------------------------
create or replace function cfg(p_clave text)
returns numeric language sql stable as $$
  select valor from config where clave = p_clave;
$$;

create or replace function soy_operador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from operadores where perfil_id = auth.uid());
$$;

create or replace function esta_verificado(p_perfil uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select verificacion = 'verificado' from profiles where id = p_perfil),
    false);
$$;


-- ---------------------------------------------------------------------
--  Alta automática de perfil al registrarse
-- ---------------------------------------------------------------------
create or replace function fn_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nombre_completo, telefono)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', ''),
    new.raw_user_meta_data->>'telefono'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists tr_nuevo_usuario on auth.users;
create trigger tr_nuevo_usuario
  after insert on auth.users
  for each row execute function fn_nuevo_usuario();


-- ---------------------------------------------------------------------
--  Bitácora automática de cambios de estado
-- ---------------------------------------------------------------------
create or replace function fn_log_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into eventos_pedido (pedido_id, actor_id, estado_nuevo, nota)
    values (new.id, new.cliente_id, new.estado, 'Pedido publicado');
  elsif new.estado is distinct from old.estado then
    insert into eventos_pedido (pedido_id, actor_id, estado_previo, estado_nuevo)
    values (new.id, auth.uid(), old.estado, new.estado);
    new.actualizado_en := now();
  end if;
  return new;
end $$;

drop trigger if exists tr_log_estado_ins on pedidos;
create trigger tr_log_estado_ins
  after insert on pedidos
  for each row execute function fn_log_estado();

drop trigger if exists tr_log_estado_upd on pedidos;
create trigger tr_log_estado_upd
  before update on pedidos
  for each row execute function fn_log_estado();


-- ---------------------------------------------------------------------
--  Enviar una oferta
-- ---------------------------------------------------------------------
create or replace function ofertar(
  p_pedido_id     uuid,
  p_precio_final  numeric,
  p_fecha_entrega date,
  p_nota          text default ''
) returns ofertas
language plpgsql security definer set search_path = public as $$
declare
  v_pedido pedidos;
  v_oferta ofertas;
begin
  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if v_pedido.estado <> 'publicado' then
    raise exception 'Este pedido ya no admite ofertas (estado: %)', v_pedido.estado;
  end if;
  if v_pedido.cliente_id = auth.uid() then
    raise exception 'No puedes ofertar sobre tu propio pedido';
  end if;
  if not esta_verificado(auth.uid()) then
    raise exception 'Debes verificar tu identidad con DNI antes de ofertar';
  end if;
  if not coalesce((select es_comprador from profiles where id = auth.uid()), false) then
    raise exception 'Tu cuenta no está activada como comprador externo';
  end if;
  if p_fecha_entrega > v_pedido.fecha_limite then
    raise exception 'Tu fecha de entrega supera la fecha límite del cliente (%)',
      v_pedido.fecha_limite;
  end if;
  if p_precio_final <= 0 then
    raise exception 'El precio debe ser mayor que cero';
  end if;

  insert into ofertas (pedido_id, comprador_id, precio_final, fecha_entrega, nota)
  values (p_pedido_id, auth.uid(), p_precio_final, p_fecha_entrega, coalesce(p_nota, ''))
  returning * into v_oferta;

  return v_oferta;
end $$;


-- ---------------------------------------------------------------------
--  Aceptar una oferta: genera el pago con el desglose completo
-- ---------------------------------------------------------------------
create or replace function aceptar_oferta(p_oferta_id uuid)
returns pagos
language plpgsql security definer set search_path = public as $$
declare
  v_oferta  ofertas;
  v_pedido  pedidos;
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
        estado = 'pendiente'
  returning * into v_pago;

  return v_pago;
end $$;


-- ---------------------------------------------------------------------
--  El cliente reporta que ya pagó (sube comprobante de Yape/Plin)
-- ---------------------------------------------------------------------
create or replace function reportar_pago(
  p_pedido_id        uuid,
  p_metodo           metodo_pago,
  p_codigo_operacion text,
  p_comprobante_path text
) returns pagos
language plpgsql security definer set search_path = public as $$
declare v_pago pagos;
begin
  select * into v_pago from pagos where pedido_id = p_pedido_id for update;
  if not found then
    raise exception 'Este pedido todavía no tiene una oferta aceptada';
  end if;
  if v_pago.cliente_id <> auth.uid() then
    raise exception 'Solo el cliente puede reportar el pago';
  end if;
  if v_pago.estado not in ('pendiente', 'en_revision') then
    raise exception 'Este pago ya fue procesado (estado: %)', v_pago.estado;
  end if;
  if coalesce(trim(p_codigo_operacion), '') = '' then
    raise exception 'Falta el código de operación del comprobante';
  end if;

  update pagos
     set metodo = p_metodo,
         codigo_operacion = p_codigo_operacion,
         comprobante_path = p_comprobante_path,
         estado = 'en_revision',
         reportado_en = now()
   where id = v_pago.id
  returning * into v_pago;

  return v_pago;
end $$;


-- ---------------------------------------------------------------------
--  El equipo confirma que el dinero llegó: queda RETENIDO
--  (mientras no haya pasarela, esta es la función que opera el equipo)
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
  if v_pago.estado <> 'en_revision' then
    raise exception 'El pago no está en revisión (estado: %)', v_pago.estado;
  end if;

  update pagos set estado = 'retenido', retenido_en = now()
   where id = v_pago.id returning * into v_pago;

  update pedidos set estado = 'pagado' where id = p_pedido_id;
  return v_pago;
end $$;


-- ---------------------------------------------------------------------
--  Avance de estado por parte del comprador externo
-- ---------------------------------------------------------------------
create or replace function avanzar_pedido(p_pedido_id uuid, p_nuevo estado_pedido)
returns pedidos
language plpgsql security definer set search_path = public as $$
declare
  v_pedido pedidos;
  v_comprador uuid;
begin
  select * into v_pedido from pedidos where id = p_pedido_id for update;
  select comprador_id into v_comprador from pagos where pedido_id = p_pedido_id;

  if v_comprador is distinct from auth.uid() then
    raise exception 'Solo el comprador externo asignado puede avanzar este pedido';
  end if;

  -- Transiciones permitidas, en orden. Nada de saltos.
  if not (
       (v_pedido.estado = 'pagado'   and p_nuevo = 'comprado')
    or (v_pedido.estado = 'comprado' and p_nuevo = 'en_viaje')
    or (v_pedido.estado = 'en_viaje' and p_nuevo = 'entregado')
  ) then
    raise exception 'Transición no permitida: % → %', v_pedido.estado, p_nuevo;
  end if;

  update pedidos set estado = p_nuevo where id = p_pedido_id returning * into v_pedido;
  return v_pedido;
end $$;


-- ---------------------------------------------------------------------
--  El cliente confirma la recepción: se libera el pago
--  Este es el momento que define todo el producto.
-- ---------------------------------------------------------------------
create or replace function confirmar_recepcion(p_pedido_id uuid)
returns pagos
language plpgsql security definer set search_path = public as $$
declare
  v_pedido pedidos;
  v_pago   pagos;
begin
  select * into v_pedido from pedidos where id = p_pedido_id for update;
  if v_pedido.cliente_id <> auth.uid() then
    raise exception 'Solo el cliente puede confirmar la recepción';
  end if;
  if v_pedido.estado <> 'entregado' then
    raise exception 'El comprador externo todavía no marcó la entrega';
  end if;

  select * into v_pago from pagos where pedido_id = p_pedido_id for update;
  if v_pago.estado <> 'retenido' then
    raise exception 'No hay un pago retenido para liberar';
  end if;

  update pagos set estado = 'liberado', liberado_en = now()
   where id = v_pago.id returning * into v_pago;

  update pedidos set estado = 'confirmado' where id = p_pedido_id;
  return v_pago;
end $$;


-- ---------------------------------------------------------------------
--  Calificación mutua
-- ---------------------------------------------------------------------
create or replace function calificar(
  p_pedido_id uuid, p_puntaje int, p_comentario text default ''
) returns calificaciones
language plpgsql security definer set search_path = public as $$
declare
  v_pedido pedidos;
  v_comprador uuid;
  v_calificado uuid;
  v_fila calificaciones;
begin
  select * into v_pedido from pedidos where id = p_pedido_id;
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

  insert into calificaciones (pedido_id, califica_id, calificado_id, puntaje, comentario)
  values (p_pedido_id, auth.uid(), v_calificado, p_puntaje, coalesce(p_comentario, ''))
  on conflict (pedido_id, califica_id)
    do update set puntaje = excluded.puntaje, comentario = excluded.comentario
  returning * into v_fila;

  return v_fila;
end $$;


-- ---------------------------------------------------------------------
--  Abrir una disputa: congela el pedido, el dinero sigue retenido
-- ---------------------------------------------------------------------
create or replace function abrir_disputa(
  p_pedido_id uuid, p_motivo text, p_evidencia_path text default null
) returns disputas
language plpgsql security definer set search_path = public as $$
declare
  v_pedido pedidos;
  v_comprador uuid;
  v_disputa disputas;
begin
  select * into v_pedido from pedidos where id = p_pedido_id for update;
  select comprador_id into v_comprador from pagos where pedido_id = p_pedido_id;

  if auth.uid() not in (v_pedido.cliente_id, v_comprador) then
    raise exception 'No participaste en este pedido';
  end if;
  if v_pedido.estado not in ('pagado', 'comprado', 'en_viaje', 'entregado') then
    raise exception 'No hay una operación en curso para disputar';
  end if;

  insert into disputas (pedido_id, abierta_por, motivo, evidencia_path)
  values (p_pedido_id, auth.uid(), p_motivo, p_evidencia_path)
  returning * into v_disputa;

  update pedidos set estado = 'en_disputa' where id = p_pedido_id;
  return v_disputa;
end $$;


-- ---------------------------------------------------------------------
--  Calculadora de precio: la app la usa para mostrar el desglose
--  antes de que el cliente acepte. Nunca se calcula en el teléfono.
-- ---------------------------------------------------------------------
create or replace function desglose_precio(p_precio_final numeric)
returns table (
  monto_encargo numeric, comision numeric, procesamiento numeric,
  total numeric, tarifa_comprador numeric, recibe_comprador numeric
) language sql stable as $$
  with c as (
    select p_precio_final as encargo,
           round(p_precio_final * cfg('comision_cliente'), 2) as comi
  ), t as (
    select encargo, comi,
           round((encargo + comi) * (1 + cfg('cargo_procesamiento')), 2) as tot
    from c
  )
  select encargo, comi, tot - encargo - comi, tot,
         round(encargo * cfg('tarifa_comprador'), 2),
         encargo - round(encargo * cfg('tarifa_comprador'), 2)
  from t;
$$;


-- ---------------------------------------------------------------------
--  Aprobar o rechazar una verificación de identidad (solo operadores)
--  El trigger de profiles bloquea que alguien se autoverifique; esta
--  función levanta la bandera que lo permite, y solo para el equipo.
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
         -- Retención mínima: al validar, se descartan las rutas de las imágenes
         -- y el equipo borra los archivos del bucket (Ley N° 29733).
         dni_frente_path = case when p_aprobar then null else dni_frente_path end,
         selfie_path     = case when p_aprobar then null else selfie_path end
   where id = p_perfil
  returning * into v_perfil;

  if not found then
    raise exception 'Ese perfil no existe';
  end if;
  return v_perfil;
end $$;


-- ---------------------------------------------------------------------
--  Reembolsar tras resolver una disputa a favor del cliente
-- ---------------------------------------------------------------------
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
  if v_disputa.estado in ('resuelta_cliente', 'resuelta_comprador') then
    raise exception 'Esta disputa ya fue resuelta';
  end if;

  select * into v_pago from pagos where pedido_id = v_disputa.pedido_id for update;

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
