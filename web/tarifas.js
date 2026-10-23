/*
 * Tarifas que muestra la web.
 *
 * DEBEN COINCIDIR con la tabla `config` de Supabase (comision_cliente,
 * cargo_procesamiento, tarifa_comprador) y con la hoja «Supuestos» del Excel
 * del flujo de caja. La web no puede leer `config` directamente: la tabla no
 * es pública. Si cambia una tarifa allí, se cambia también aquí.
 *
 * El cálculo replica `desglose_precio` (0002_funciones.sql), redondeando en
 * los mismos pasos, para que el ejemplo dé lo mismo que la aplicación.
 */
window.TARIFAS = {
  comision_cliente: 0.10,
  cargo_procesamiento: 0.029,
  tarifa_comprador: 0.03,
};

window.desglosePrecio = function (precio) {
  var t = window.TARIFAS;
  var r = function (n) { return Math.round(n * 100) / 100; };
  var comision = r(precio * t.comision_cliente);
  var total = r((precio + comision) * (1 + t.cargo_procesamiento));
  var tarifa = r(precio * t.tarifa_comprador);
  return {
    encargo: precio,
    comision: comision,
    procesamiento: r(total - precio - comision),
    total: total,
    tarifa_comprador: tarifa,
    recibe_comprador: r(precio - tarifa),
  };
};
