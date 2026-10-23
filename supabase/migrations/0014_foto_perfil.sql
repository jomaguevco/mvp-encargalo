-- =====================================================================
--  ENCÁRGALO · MVP · Foto de perfil
--  Opcional y pública: la elige cada persona y aparece donde ya aparecía su
--  avatar con iniciales (ofertas, contraparte del pedido, reputación).
--  Refuerza la reputación: ver la cara de quien te trae el pedido genera
--  confianza. No reemplaza la selfie de verificación, que sigue siendo
--  privada y se borra al resolver.
-- =====================================================================

alter table profiles add column if not exists foto_path text;

comment on column profiles.foto_path is
  'Ruta en el bucket público avatares (<uid>/avatar-<marca>.jpg). Null = iniciales.';

-- ---------------------------------------------------------------------
--  Bucket público, escritura solo en la carpeta propia
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

drop policy if exists avatar_leer on storage.objects;
create policy avatar_leer on storage.objects
  for select using (bucket_id = 'avatares');

drop policy if exists avatar_subir on storage.objects;
create policy avatar_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares'
              and (storage.foldername(name))[1] = auth.uid()::text);

-- Para borrar la foto anterior al cambiarla.
drop policy if exists avatar_borrar on storage.objects;
create policy avatar_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares'
         and ((storage.foldername(name))[1] = auth.uid()::text or soy_admin()));

-- ---------------------------------------------------------------------
--  La vista pública de reputación suma la foto (columna nueva al final;
--  las demás quedan igual).
-- ---------------------------------------------------------------------
create or replace view v_reputacion as
with entregas as (
  select
    o.comprador_id,
    count(*) filter (where p.estado = 'confirmado')                     as cumplidos,
    count(*) filter (where p.estado in ('confirmado','cancelado','en_disputa')) as cerrados,
    count(*) filter (
      where p.estado = 'confirmado'
        and exists (
          select 1 from eventos_pedido e
          where e.pedido_id = p.id
            and e.estado_nuevo = 'entregado'
            and e.creado_en::date <= o.fecha_entrega
        )
    ) as puntuales
  from ofertas o
  join pedidos p on p.oferta_aceptada_id = o.id
  where o.estado = 'aceptada'
  group by o.comprador_id
),
notas as (
  select calificado_id, avg(puntaje)::numeric(3,2) as promedio, count(*) as total
  from calificaciones
  group by calificado_id
)
select
  pr.id                                                as perfil_id,
  pr.nombre_completo,
  pr.ciudad,
  pr.verificacion,
  coalesce(e.cumplidos, 0)                             as pedidos_cumplidos,
  case when coalesce(e.cerrados, 0) = 0 then null
       else round(100.0 * e.cumplidos / e.cerrados)    end as tasa_cumplimiento,
  case when coalesce(e.cumplidos, 0) = 0 then null
       else round(100.0 * e.puntuales / e.cumplidos)   end as puntualidad,
  n.promedio                                           as calificacion,
  coalesce(n.total, 0)                                 as total_calificaciones,
  (current_date - pr.creado_en::date)                  as antiguedad_dias,
  pr.foto_path
from profiles pr
left join entregas e on e.comprador_id = pr.id
left join notas    n on n.calificado_id = pr.id;

-- ---------------------------------------------------------------------
--  Moderación: un administrador puede quitar una foto inapropiada.
-- ---------------------------------------------------------------------
create or replace function admin_quitar_foto(p_perfil uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_ruta text;
begin
  perform exigir_admin();
  select foto_path into v_ruta from profiles where id = p_perfil;
  if not found then
    raise exception 'Esa cuenta no existe';
  end if;
  update profiles set foto_path = null where id = p_perfil;
  perform registrar_bitacora('foto_quitada', 'perfil', p_perfil::text,
    jsonb_build_object('ruta', v_ruta));
  return v_ruta;   -- la app borra el archivo del bucket
end $$;
