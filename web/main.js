/*
 * Comportamiento de la página: menú móvil, banda de promociones y calculadora.
 */

/*
 * Promociones de la banda superior.
 *
 * Solo van aquí cosas que son verdad hoy. Un descuento o un código es una
 * decisión del equipo que toca el flujo de caja: se agrega cuando esté
 * aprobado y la aplicación lo aplique, no antes.
 */
var PROMOCIONES = [
  { etiqueta: 'Siempre', texto: 'Crear tu cuenta y publicar un encargo es gratis' },
  { etiqueta: 'Viajeros', texto: 'Ofertar no cuesta nada: solo pagas una tarifa si el encargo se completa' },
  { etiqueta: 'Lanzamiento', texto: 'Piloto en Chiclayo: el equipo fundador acompaña cada pedido de punta a punta' },
];

(function () {
  var soles = function (n) {
    return 'S/ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  var pct = function (n) {
    return (Math.round(n * 1000) / 10).toString().replace('.', ',') + ' %';
  };

  // Banda de promociones
  var banda = document.getElementById('banda');
  PROMOCIONES.forEach(function (p) {
    var el = document.createElement('div');
    el.className = 'promo';
    var e = document.createElement('span');
    e.className = 'promo-etiqueta';
    e.textContent = p.etiqueta;
    var t = document.createElement('span');
    t.textContent = p.texto;
    el.appendChild(e);
    el.appendChild(t);
    banda.appendChild(el);
  });

  // Tarifas
  var T = window.TARIFAS;
  document.getElementById('t-comision').textContent = pct(T.comision_cliente) + ' del precio';
  document.getElementById('t-procesamiento').textContent = pct(T.cargo_procesamiento) + ' del total';
  document.getElementById('t-comprador').textContent = pct(T.tarifa_comprador) + ' del precio';

  // Calculadora
  var entrada = document.getElementById('precio');
  function calcular() {
    var precio = Math.max(0, Number(String(entrada.value).replace(',', '.')) || 0);
    var d = window.desglosePrecio(precio);
    document.getElementById('d-encargo').textContent = soles(d.encargo);
    document.getElementById('d-comision').textContent = '+ ' + soles(d.comision);
    document.getElementById('d-procesamiento').textContent = '+ ' + soles(d.procesamiento);
    document.getElementById('d-total').textContent = soles(d.total);
    document.getElementById('d-recibe').textContent = soles(d.recibe_comprador);
  }
  entrada.addEventListener('input', calcular);
  calcular();

  // Menú móvil
  var boton = document.getElementById('hamburguesa');
  var menu = document.getElementById('menu');
  boton.addEventListener('click', function () {
    var abierto = menu.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });
  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      menu.classList.remove('abierto');
      boton.setAttribute('aria-expanded', 'false');
    }
  });

  // Sombra de la cabecera al desplazarse
  var cabecera = document.getElementById('cabecera');
  var alDesplazar = function () {
    cabecera.classList.toggle('con-sombra', window.scrollY > 8);
  };
  window.addEventListener('scroll', alDesplazar, { passive: true });
  alDesplazar();

  document.getElementById('anio').textContent = new Date().getFullYear();

  // Aparición al desplazarse. La clase `js` en <html> hace que el contenido
  // solo se oculte si este script corre: sin JavaScript todo se ve igual.
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('js');
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observador.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.revelar').forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      observador.observe(el);
    });
  }
})();
