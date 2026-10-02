import { ScrollView, View } from 'react-native';
import { VERSION_TERMINOS } from '@/lib/negocio';
import { Aviso, Micro, Parrafo, Subtitulo } from '@/ui/componentes';
import { E } from '@/ui/tema';

/**
 * Términos y condiciones y política de privacidad (acción ES-14, requisito R17).
 *
 * Es un BORRADOR redactado por el equipo: la acción ES-13 contempla revisarlo con
 * un abogado, en particular la cláusula de custodia del dinero. Cuando el texto
 * cambie, se sube VERSION_TERMINOS en negocio.ts para que quede registrado qué
 * versión aceptó cada usuario.
 *
 * Las tarifas no se escriben aquí: viven en la tabla config y el usuario las ve
 * en el desglose del precio antes de pagar.
 */
const TERMINOS: [string, string][] = [
  ['1. Qué es Encárgalo',
   'Encárgalo es una plataforma que conecta a personas que quieren un producto del ' +
   'extranjero (clientes) con personas verificadas que pueden comprarlo y traerlo ' +
   '(compradores externos). Encárgalo no vende los productos: facilita el acuerdo, ' +
   'verifica la identidad de las partes y custodia el pago hasta la entrega.'],
  ['2. Verificación de identidad',
   'Para publicar pedidos u ofertar es obligatorio verificar la identidad con el DNI y ' +
   'una selfie. Un operador de Encárgalo revisa ambos documentos. Encárgalo puede ' +
   'rechazar una verificación o suspender una cuenta si detecta datos falsos.'],
  ['3. Custodia del pago',
   'Cuando el cliente acepta una oferta, paga el total que se muestra en el desglose: ' +
   'el precio del comprador externo, la comisión de servicio y el cargo por ' +
   'procesamiento. Ese dinero queda retenido por Encárgalo únicamente para esa ' +
   'transacción y no se usa para ningún otro fin. Se libera al comprador externo ' +
   'cuando el cliente confirma la recepción o, si vence el plazo de confirmación sin ' +
   'que el cliente haya abierto una disputa, cuando Encárgalo revisa el caso y lo ' +
   'libera. Al comprador externo se le descuenta ' +
   'la tarifa de servicio que también figura en el desglose.'],
  ['4. Disputas y reembolsos',
   'Si el producto no llega o no corresponde a lo pedido, cualquiera de las dos partes ' +
   'puede abrir una disputa mientras el dinero esté retenido, adjuntando evidencia. ' +
   'Encárgalo revisa el caso y decide si devuelve el dinero al cliente o lo libera al ' +
   'comprador externo. La decisión se comunica a ambas partes con su motivo.'],
  ['5. Cancelaciones',
   'El cliente puede cancelar un pedido mientras no haya reportado el pago, indicando el ' +
   'motivo. El comprador externo puede retirar su oferta mientras no haya sido aceptada.'],
  ['6. Productos que no se pueden encargar',
   'Medicamentos con receta, armas y sus piezas, alimentos frescos, plantas, productos ' +
   'inflamables, sustancias controladas y cualquier bien prohibido o restringido por ' +
   'SUNAT o por la ley peruana. Los envíos que superan el monto libre de impuestos ' +
   'pagan tributos de importación, que corren por cuenta del cliente salvo que la ' +
   'oferta diga lo contrario.'],
  ['7. Obligaciones de los usuarios',
   'Dar información verdadera, comunicarse por el chat de la aplicación, cumplir los ' +
   'plazos ofrecidos y no usar la plataforma para fines ilícitos. El incumplimiento ' +
   'puede llevar a la suspensión de la cuenta.'],
  ['8. Reclamos',
   'Los reclamos se presentan por el chat de soporte o por correo, y se responden en ' +
   'un plazo máximo de 15 días hábiles, según el Código de Protección y Defensa del ' +
   'Consumidor (Ley N° 29571). El libro de reclamaciones virtual estará disponible ' +
   'dentro de la aplicación.'],
];

const PRIVACIDAD: [string, string][] = [
  ['Qué datos tratamos',
   'Nombre, celular, correo, número de DNI, la foto del DNI y una selfie, y los datos de ' +
   'tus pedidos, ofertas, pagos y mensajes dentro de la aplicación. También cómo nos ' +
   'conociste y, si lo indicas, el código de quien te invitó.'],
  ['Para qué',
   'Para verificar tu identidad, operar tus pedidos y pagos, resolver disputas y medir ' +
   'qué canales nos traen usuarios. No vendemos ni cedemos tus datos a terceros.'],
  ['Cuánto tiempo',
   'Las fotos del DNI y la selfie se borran en el momento en que se aprueba tu ' +
   'verificación: solo conservamos el número de DNI. El resto se guarda mientras tu ' +
   'cuenta esté activa.'],
  ['Tus derechos',
   'Puedes pedir acceder a tus datos, corregirlos, cancelarlos u oponerte a su ' +
   'tratamiento (derechos ARCO, Ley N° 29733) escribiendo al correo de soporte. ' +
   'Respondemos en los plazos que fija la ley.'],
  ['Seguridad',
   'Las comunicaciones viajan cifradas, las imágenes se guardan en almacenamiento ' +
   'privado y cada usuario solo puede leer sus propios pedidos, pagos y mensajes.'],
];

function Bloque({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={{ marginBottom: E.lg }}>
      <Parrafo style={{ fontWeight: '700', marginBottom: E.xs }}>{titulo}</Parrafo>
      <Parrafo suave>{texto}</Parrafo>
    </View>
  );
}

export default function Legal() {
  return (
    <ScrollView contentContainerStyle={{ padding: E.xl, paddingBottom: E.xxl }}>
      <Aviso tono="alerta" titulo="Versión preliminar">
        Este texto está en revisión legal. Al crear tu cuenta aceptas esta versión; si
        cambia, te pediremos aceptarla de nuevo.
      </Aviso>

      <Subtitulo>Términos y condiciones</Subtitulo>
      {TERMINOS.map(([t, x]) => (
        <Bloque key={t} titulo={t} texto={x} />
      ))}

      <Subtitulo>Política de privacidad</Subtitulo>
      {PRIVACIDAD.map(([t, x]) => (
        <Bloque key={t} titulo={t} texto={x} />
      ))}

      <Micro>Versión {VERSION_TERMINOS}</Micro>
    </ScrollView>
  );
}
