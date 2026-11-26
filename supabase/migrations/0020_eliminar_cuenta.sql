-- =====================================================================
--  ENCÁRGALO · MVP · Eliminar la cuenta
--
--  Requisito de Google Play para publicar (ES-09): toda app que deja crear
--  una cuenta debe dejar pedir su eliminación desde la app y desde un enlace
--  web. Aquí: /perfil → Eliminar mi cuenta, y encargalo.vercel.app/app/eliminar-cuenta.
--
--  Cómo se elimina sin romper la historia de los demás:
--    - Los pedidos, pagos y calificaciones quedan (otros usuarios y SUNAT los
--      necesitan), pero la cuenta se anonimiza: «Cuenta eliminada», sin DNI,
--      teléfono, fotos ni correo.
--    - El correo de inicio de sesión se reemplaza y el acceso queda bloqueado.
--    - Las imágenes de los buckets las borra la app con las rutas que devuelve
--      admin_eliminar_cuenta() (desde SQL no se borran archivos del Storage).
--    - No se puede eliminar con un pedido en curso o dinero retenido: primero
--      se cierra el pedido.
--
--  Plazo comprometido en la ficha de Play: 7 días desde la solicitud.
-- =====================================================================

create table if not exists solicitudes_eliminacion (
  perfil_id      uuid primary key references profiles (id) on delete cascade,
  motivo         text,
  creado_en      timestamptz not null default now(),
  resuelta_en    timestamptz,
  resuelta_por   uuid references profiles (id)
);

alter table solicitudes_eliminacion enable row level security;
revoke all on solicitudes_eliminacion from anon, authenticated;
grant select on solicitudes_eliminacion to authenticated;
drop policy if exists eliminacion_ver on solicitudes_eliminacion;
create policy eliminacion_ver on solicitudes_eliminacion
  for select using (perfil_id = auth.uid() or soy_admin());

/** Pedidos de la cuenta que todavía mueven dinero o productos. */
create or replace function pedidos_en_curso(p_perfil uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from pedidos p
  left join ofertas o on o.id = p.oferta_aceptada_id
  where (p.cliente_id = p_perfil or o.comprador_id = p_perfil)
    and p.estado in ('aceptado', 'pagado', 'comprado', 'en_viaje', 'entregado', 'en_disputa');
$$;

revoke execute on function pedidos_en_curso(uuid) from public, anon, authenticated;

create or replace function solicitar_eliminacion_cuenta(p_motivo text default null)
returns solicitudes_eliminacion
language plpgsql security definer set search_path = public as $$
declare
  v_fila solicitudes_eliminacion;
  v_curso int;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para eliminar tu cuenta';
  end if;
  v_curso := pedidos_en_curso(auth.uid());
  if v_curso > 0 then
    raise exception 'Tienes % pedido(s) en curso. Cuando terminen (o se cancelen) podrás eliminar tu cuenta.', v_curso;
  end if;

  insert into solicitudes_eliminacion (perfil_id, motivo)
  values (auth.uid(), nullif(trim(coalesce(p_motivo, '')), ''))
  on conflict (perfil_id) do update
    set motivo = excluded.motivo, creado_en = now(), resuelta_en = null, resuelta_por = null
  returning * into v_fila;

  perform registrar_bitacora('eliminacion_solicitada', 'perfil', auth.uid()::text,
    jsonb_build_object('motivo', v_fila.motivo));
  return v_fila;
end $$;

revoke execute on function solicitar_eliminacion_cuenta(text) from public, anon;
grant execute on function solicitar_eliminacion_cuenta(text) to authenticated;

/** Solicitudes pendientes para el panel, con lo que impide resolverlas. */
create or replace function admin_solicitudes_eliminacion()
returns table (perfil_id uuid, nombre text, motivo text, creado_en timestamptz, pedidos_en_curso int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_admin();
  return query
    select s.perfil_id, pr.nombre_completo, s.motivo, s.creado_en, pedidos_en_curso(s.perfil_id)
    from solicitudes_eliminacion s
    join profiles pr on pr.id = s.perfil_id
    where s.resuelta_en is null
    order by s.creado_en;
end $$;

/**
 * Anonimiza la cuenta. Devuelve las rutas de las imágenes que la app debe
 * borrar del Storage: { documentos: [...], avatares: [...] }.
 */
create or replace function admin_eliminar_cuenta(p_perfil uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_perfil profiles;
  v_curso  int;
  v_auth   boolean := true;
begin
  perform exigir_admin();
  if p_perfil = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta desde el panel';
  end if;
  select * into v_perfil from profiles where id = p_perfil for update;
  if not found then
    raise exception 'Esa cuenta no existe';
  end if;
  v_curso := pedidos_en_curso(p_perfil);
  if v_curso > 0 then
    raise exception 'La cuenta tiene % pedido(s) en curso: ciérralos antes de eliminarla', v_curso;
  end if;

  -- Lo abierto se cierra: pedidos sin oferta aceptada y ofertas vigentes.
  update pedidos set estado = 'cancelado' where cliente_id = p_perfil and estado = 'publicado';
  update ofertas set estado = 'retirada' where comprador_id = p_perfil and estado = 'enviada';

  perform set_config('app.admin_autorizado', '1', true);
  update profiles set
    nombre_completo   = 'Cuenta eliminada',
    telefono          = null,
    dni               = null,
    dni_frente_path   = null,
    selfie_path       = null,
    foto_path         = null,
    motivo_rechazo    = null,
    dni_validacion    = null,
    ia_detalle        = null,
    suspendido        = true,
    suspendido_motivo = 'Cuenta eliminada a pedido de su titular',
    suspendido_en     = now()
  where id = p_perfil;
  perform set_config('app.admin_autorizado', '0', true);

  delete from operadores where perfil_id = p_perfil;
  delete from videollamadas where perfil_id = p_perfil;

  -- Acceso: se cambia el correo y se bloquea el inicio de sesión. Se guardan
  -- solo el origen y el código de referido (sin datos personales) para las
  -- métricas de canales.
  begin
    update auth.users set
      email = p_perfil::text || '@eliminada.invalid',
      phone = null,
      encrypted_password = '',
      banned_until = 'infinity',
      raw_user_meta_data = jsonb_strip_nulls(jsonb_build_object(
        'origen', raw_user_meta_data->>'origen',
        'codigo_referido', raw_user_meta_data->>'codigo_referido'))
    where id = p_perfil;
    delete from auth.identities where user_id = p_perfil;
  exception when others then
    -- Si el proyecto no deja tocar auth desde SQL, el administrador borra el
    -- correo desde Authentication → Users. Queda anotado en la bitácora.
    v_auth := false;
  end;

  update solicitudes_eliminacion
     set resuelta_en = now(), resuelta_por = auth.uid()
   where perfil_id = p_perfil;

  perform registrar_bitacora('cuenta_eliminada', 'perfil', p_perfil::text,
    jsonb_build_object('acceso_bloqueado', v_auth));

  return jsonb_build_object(
    'documentos', to_jsonb(array_remove(array[v_perfil.dni_frente_path, v_perfil.selfie_path], null)),
    'avatares', to_jsonb(array_remove(array[v_perfil.foto_path], null)),
    'acceso_bloqueado', v_auth
  );
end $$;

revoke execute on function admin_solicitudes_eliminacion() from public, anon;
revoke execute on function admin_eliminar_cuenta(uuid) from public, anon;
grant execute on function admin_solicitudes_eliminacion() to authenticated;
grant execute on function admin_eliminar_cuenta(uuid) to authenticated;
