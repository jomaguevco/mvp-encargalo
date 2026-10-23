import { useLocalSearchParams } from 'expo-router';
import Operador, { type Cola } from '@/app/(app)/operador';

const COLAS: Cola[] = ['verificaciones', 'pagos', 'vencidas', 'disputas'];

/**
 * Operación diaria del piloto: verificaciones, pagos por confirmar, plazos
 * vencidos y disputas. Es la misma consola que ven los operadores en la
 * pestaña «Equipo» de la app, para que las dos nunca se contradigan. Con
 * ?cola=pagos (o disputas, vencidas) abre ya filtrada en esa cola.
 */
export default function OperacionAdmin() {
  const { cola } = useLocalSearchParams<{ cola?: string }>();
  const inicial = COLAS.find((c) => c === cola);
  // key: si cambia la cola pedida, la consola arranca con ese filtro.
  return <Operador key={inicial ?? 'todas'} soloCola={inicial} enPanel />;
}
