-- =====================================================================
--  ENCÁRGALO · MVP · Consola del equipo
--  Mientras el escrow se opera a mano, el equipo necesita ver dos colas:
--  verificaciones por revisar y pagos por confirmar. Estas funciones son
--  la única puerta a esos datos, y solo la abren los operadores.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Cola de verificaciones pendientes
-- ---------------------------------------------------------------------
create or replace function pendientes_verificacion()
returns table (
  perfil_id       uuid,
  nombre_completo text,
  dni             text,
  telefono        text,
  dni_frente_path text,
  selfie_path     text,
  solicitado_en   timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not soy_operador() then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.nombre_completo, p.dni, p.telefono,
           p.dni_frente_path, p.selfie_path, p.creado_en
    from profiles p
    where p.verificacion = 'en_revision'
    order by p.creado_en;
end $$;


-- ---------------------------------------------------------------------
--  Cola de pagos por confirmar
-- ---------------------------------------------------------------------
create or replace function pendientes_pago()
returns table (
  pedido_id        uuid,
  titulo           text,
  cliente          text,
  total_cobrado    numeric,
  metodo           metodo_pago,
  codigo_operacion text,
  comprobante_path text,
  reportado_en     timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not soy_operador() then
    raise exception 'No autorizado';
  end if;
  return query
    select g.pedido_id, pe.titulo, cl.nombre_completo,
           g.total_cobrado, g.metodo, g.codigo_operacion,
           g.comprobante_path, g.reportado_en
    from pagos g
    join pedidos  pe on pe.id = g.pedido_id
    join profiles cl on cl.id = g.cliente_id
    where g.estado = 'en_revision'
    order by g.reportado_en;
end $$;


-- ---------------------------------------------------------------------
--  Cola de disputas abiertas
-- ---------------------------------------------------------------------
create or replace function disputas_abiertas()
returns table (
  disputa_id  uuid,
  pedido_id   uuid,
  titulo      text,
  abierta_por text,
  motivo      text,
  monto       numeric,
  creado_en   timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not soy_operador() then
    raise exception 'No autorizado';
  end if;
  return query
    select d.id, d.pedido_id, pe.titulo, pr.nombre_completo, d.motivo,
           g.total_cobrado, d.creado_en
    from disputas d
    join pedidos  pe on pe.id = d.pedido_id
    join profiles pr on pr.id = d.abierta_por
    left join pagos g on g.pedido_id = d.pedido_id
    where d.estado in ('abierta', 'en_revision')
    order by d.creado_en;
end $$;


-- ---------------------------------------------------------------------
--  Los operadores necesitan abrir las imágenes de DNI y de comprobantes
--  para poder validarlas. Es el único caso en que alguien lee un archivo
--  de otra persona, y queda restringido a la lista de operadores.
-- ---------------------------------------------------------------------
drop policy if exists operador_leer_documentos on storage.objects;
create policy operador_leer_documentos on storage.objects
  for select to authenticated
  using (bucket_id in ('documentos', 'comprobantes') and soy_operador());

-- Y borrarlas cuando la verificación ya fue resuelta (retención mínima).
drop policy if exists operador_borrar_documentos on storage.objects;
create policy operador_borrar_documentos on storage.objects
  for delete to authenticated
  using (bucket_id in ('documentos', 'comprobantes') and soy_operador());
