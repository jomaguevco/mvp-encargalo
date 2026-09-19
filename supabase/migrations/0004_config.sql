-- =====================================================================
--  ENCÁRGALO · MVP · Configuración del negocio
--  Estas tarifas son las mismas del flujo de caja proyectado
--  (Entregables_Unidad2/Encargalo_Flujo_de_Caja_y_OKR.xlsx, hoja 1).
--  Si cambian ahí, cambian aquí. Un solo lugar de verdad.
-- =====================================================================

insert into config (clave, valor, descripcion) values
  ('comision_cliente',    0.10,
   'Comisión de servicio al cliente sobre el valor del encargo'),
  ('tarifa_comprador',    0.03,
   'Tarifa al comprador externo sobre el valor del encargo'),
  ('cargo_procesamiento', 0.029,
   'Cargo de procesamiento trasladado al cliente sobre el monto cobrado'),
  ('dias_para_confirmar', 7,
   'Días que tiene el cliente para confirmar la recepción antes de que el '
   'equipo revise el caso')
on conflict (clave) do update
  set valor = excluded.valor, descripcion = excluded.descripcion;


-- =====================================================================
--  Comprobación rápida del desglose de precio
--  Con un encargo de S/ 491.40 debe dar:
--    comisión 49.14 · procesamiento 15.68 · total 556.22
--    tarifa comprador 14.74 · recibe 476.66
-- =====================================================================
-- select * from desglose_precio(491.40);


-- =====================================================================
--  Operadores del piloto
--  Reemplaza el UUID por el de cada miembro del equipo. Lo encuentras en
--  Supabase → Authentication → Users, columna UID, después de que cada
--  uno haya creado su cuenta en la app.
-- =====================================================================
-- insert into operadores (perfil_id, nombre) values
--   ('00000000-0000-0000-0000-000000000000', 'Guevara, Mariano'),
--   ('00000000-0000-0000-0000-000000000000', 'Mejía, Jhordan')
-- on conflict (perfil_id) do nothing;
