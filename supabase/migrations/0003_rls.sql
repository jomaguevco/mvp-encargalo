-- =====================================================================
--  ENCÁRGALO · MVP · Seguridad a nivel de fila (RLS)
--  Regla de oro: nadie ve datos de una operación en la que no participa.
--  Por defecto todo está denegado; abajo se abre solo lo estrictamente
--  necesario.
-- =====================================================================

alter table profiles        enable row level security;
alter table pedidos         enable row level security;
alter table ofertas         enable row level security;
alter table pagos           enable row level security;
alter table eventos_pedido  enable row level security;
alter table mensajes        enable row level security;
alter table calificaciones  enable row level security;
alter table disputas        enable row level security;
alter table config          enable row level security;
alter table operadores      enable row level security;


-- ---------------------------------------------------------------------
--  Helpers
-- ---------------------------------------------------------------------
create or replace function participa_en(p_pedido_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pedidos p
    left join pagos g on g.pedido_id = p.id
    where p.id = p_pedido_id
      and auth.uid() in (p.cliente_id, g.comprador_id)
  );
$$;


-- ---------------------------------------------------------------------
--  config: lectura para todos, escritura para nadie desde la app
-- ---------------------------------------------------------------------
drop policy if exists config_leer on config;
create policy config_leer on config for select to authenticated using (true);


-- ---------------------------------------------------------------------
--  profiles
--  Cada quien ve y edita solo su propia fila. Los datos públicos de los
--  demás se consultan por la vista v_reputacion, que no expone DNI,
--  teléfono ni rutas de documentos.
-- ---------------------------------------------------------------------
drop policy if exists perfil_ver_propio on profiles;
create policy perfil_ver_propio on profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists perfil_editar_propio on profiles;
create policy perfil_editar_propio on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- La verificación NO la puede otorgar el propio usuario: se revisa a mano.
create or replace function fn_bloquear_autoverificacion()
returns trigger language plpgsql as $$
begin
  if new.verificacion is distinct from old.verificacion
     and new.verificacion in ('verificado', 'rechazado')
     and coalesce(current_setting('app.verificacion_autorizada', true), '0') <> '1'
     and current_user <> 'service_role'
  then
    raise exception 'La verificación la aprueba el equipo de Encárgalo, no el usuario';
  end if;
  return new;
end $$;

drop trigger if exists tr_bloquear_autoverificacion on profiles;
create trigger tr_bloquear_autoverificacion
  before update on profiles
  for each row execute function fn_bloquear_autoverificacion();


-- ---------------------------------------------------------------------
--  operadores: cada quien solo puede comprobar si él mismo lo es
-- ---------------------------------------------------------------------
drop policy if exists operador_ver_propio on operadores;
create policy operador_ver_propio on operadores
  for select to authenticated using (perfil_id = auth.uid());


-- ---------------------------------------------------------------------
--  pedidos
--  Un comprador externo verificado ve los pedidos abiertos (necesita
--  verlos para ofertar). Los pedidos ya adjudicados solo los ven sus
--  participantes.
-- ---------------------------------------------------------------------
drop policy if exists pedido_ver on pedidos;
create policy pedido_ver on pedidos
  for select to authenticated
  using (
    cliente_id = auth.uid()
    or exists (select 1 from pagos g
                where g.pedido_id = pedidos.id and g.comprador_id = auth.uid())
    or (estado = 'publicado' and esta_verificado(auth.uid()))
  );

drop policy if exists pedido_crear on pedidos;
create policy pedido_crear on pedidos
  for insert to authenticated
  with check (cliente_id = auth.uid() and esta_verificado(auth.uid()));

-- El cliente solo puede editar el contenido mientras nadie se comprometió.
-- Los cambios de estado pasan por las funciones, no por UPDATE directo.
drop policy if exists pedido_editar on pedidos;
create policy pedido_editar on pedidos
  for update to authenticated
  using (cliente_id = auth.uid() and estado = 'publicado')
  with check (cliente_id = auth.uid() and estado in ('publicado', 'cancelado'));


-- ---------------------------------------------------------------------
--  ofertas
--  El cliente ve todas las de su pedido; cada comprador ve solo las suyas.
--  Nadie ve las ofertas de la competencia: eso mantiene la subasta limpia.
-- ---------------------------------------------------------------------
drop policy if exists oferta_ver on ofertas;
create policy oferta_ver on ofertas
  for select to authenticated
  using (
    comprador_id = auth.uid()
    or exists (select 1 from pedidos p
                where p.id = ofertas.pedido_id and p.cliente_id = auth.uid())
  );

-- Las ofertas se crean con la función ofertar(), que valida las reglas.
drop policy if exists oferta_retirar on ofertas;
create policy oferta_retirar on ofertas
  for update to authenticated
  using (comprador_id = auth.uid() and estado = 'enviada')
  with check (comprador_id = auth.uid() and estado in ('enviada', 'retirada'));


-- ---------------------------------------------------------------------
--  pagos: solo lectura para los dos participantes.
--  Ningún UPDATE ni INSERT desde la app: el dinero solo se mueve por
--  funciones. Esto es lo que impide que alguien se libere su propio pago.
-- ---------------------------------------------------------------------
drop policy if exists pago_ver on pagos;
create policy pago_ver on pagos
  for select to authenticated
  using (cliente_id = auth.uid() or comprador_id = auth.uid());


-- ---------------------------------------------------------------------
--  eventos, mensajes, calificaciones, disputas
-- ---------------------------------------------------------------------
drop policy if exists evento_ver on eventos_pedido;
create policy evento_ver on eventos_pedido
  for select to authenticated using (participa_en(pedido_id));

drop policy if exists mensaje_ver on mensajes;
create policy mensaje_ver on mensajes
  for select to authenticated using (participa_en(pedido_id));

drop policy if exists mensaje_enviar on mensajes;
create policy mensaje_enviar on mensajes
  for insert to authenticated
  with check (emisor_id = auth.uid() and participa_en(pedido_id));

drop policy if exists calificacion_ver on calificaciones;
create policy calificacion_ver on calificaciones
  for select to authenticated using (true);  -- la reputación es pública

drop policy if exists disputa_ver on disputas;
create policy disputa_ver on disputas
  for select to authenticated using (participa_en(pedido_id));


-- ---------------------------------------------------------------------
--  Almacenamiento
--  documentos/  → cada usuario solo toca su propia carpeta <uid>/...
--  comprobantes/→ igual
--  productos/   → lectura pública, escritura del dueño
-- ---------------------------------------------------------------------
drop policy if exists doc_propio_leer on storage.objects;
create policy doc_propio_leer on storage.objects
  for select to authenticated
  using (bucket_id in ('documentos','comprobantes')
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists doc_propio_subir on storage.objects;
create policy doc_propio_subir on storage.objects
  for insert to authenticated
  with check (bucket_id in ('documentos','comprobantes')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists producto_leer on storage.objects;
create policy producto_leer on storage.objects
  for select using (bucket_id = 'productos');

drop policy if exists producto_subir on storage.objects;
create policy producto_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos'
              and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------------
--  Permisos sobre la vista pública de reputación
-- ---------------------------------------------------------------------
grant select on v_reputacion to authenticated;
