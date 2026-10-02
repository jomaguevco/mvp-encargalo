/** Espejo de los tipos de la base de datos (supabase/migrations/0001_schema.sql). */

export type EstadoVerificacion =
  | 'pendiente'
  | 'en_revision'
  | 'verificado'
  | 'rechazado';

/** Qué dijo RENIEC al contrastar el DNI y el nombre. null = no se pudo validar. */
export type ResultadoDni = 'coincide' | 'no_coincide' | 'no_existe';

export type EstadoPedido =
  | 'publicado'
  | 'aceptado'
  | 'pagado'
  | 'comprado'
  | 'en_viaje'
  | 'entregado'
  | 'confirmado'
  | 'en_disputa'
  | 'cancelado';

export type EstadoOferta = 'enviada' | 'aceptada' | 'rechazada' | 'retirada';

export type EstadoPago =
  | 'pendiente'
  | 'en_revision'
  | 'retenido'
  | 'liberado'
  | 'reembolsado';

export type MetodoPago = 'yape' | 'plin' | 'transferencia';

export type Perfil = {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  ciudad: string;
  es_cliente: boolean;
  es_comprador: boolean;
  dni: string | null;
  verificacion: EstadoVerificacion;
  dni_validacion: ResultadoDni | null;
  dni_frente_path: string | null;
  selfie_path: string | null;
  verificado_en: string | null;
  motivo_rechazo: string | null;
  creado_en: string;
};

export type Pedido = {
  id: string;
  cliente_id: string;
  titulo: string;
  descripcion: string;
  url_producto: string | null;
  imagen_path: string | null;
  categoria: string;
  cantidad: number;
  ciudad_entrega: string;
  fecha_limite: string;
  valor_referencial: number | null;
  estado: EstadoPedido;
  oferta_aceptada_id: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type Oferta = {
  id: string;
  pedido_id: string;
  comprador_id: string;
  precio_final: number;
  fecha_entrega: string;
  nota: string;
  estado: EstadoOferta;
  creado_en: string;
};

export type Pago = {
  id: string;
  pedido_id: string;
  oferta_id: string;
  cliente_id: string;
  comprador_id: string;
  monto_encargo: number;
  comision_cliente: number;
  cargo_procesamiento: number;
  total_cobrado: number;
  tarifa_comprador: number;
  monto_liberado: number;
  metodo: MetodoPago | null;
  codigo_operacion: string | null;
  comprobante_path: string | null;
  estado: EstadoPago;
  reportado_en: string | null;
  retenido_en: string | null;
  liberado_en: string | null;
  creado_en: string;
};

export type EventoPedido = {
  id: number;
  pedido_id: string;
  actor_id: string | null;
  estado_previo: EstadoPedido | null;
  estado_nuevo: EstadoPedido;
  nota: string;
  creado_en: string;
};

export type Mensaje = {
  id: number;
  pedido_id: string;
  emisor_id: string;
  cuerpo: string;
  creado_en: string;
};

export type Calificacion = {
  id: number;
  pedido_id: string;
  califica_id: string;
  calificado_id: string;
  puntaje: number;
  comentario: string;
  creado_en: string;
};

/** Vista pública: no expone DNI, teléfono ni correo. */
export type Reputacion = {
  perfil_id: string;
  nombre_completo: string;
  ciudad: string;
  verificacion: EstadoVerificacion;
  pedidos_cumplidos: number;
  tasa_cumplimiento: number | null;
  puntualidad: number | null;
  calificacion: number | null;
  total_calificaciones: number;
  antiguedad_dias: number;
};

export type DesglosePrecio = {
  monto_encargo: number;
  comision: number;
  procesamiento: number;
  total: number;
  tarifa_comprador: number;
  recibe_comprador: number;
};

/** Oferta acompañada de la reputación pública de quien la envió. */
export type OfertaConReputacion = Oferta & { reputacion: Reputacion | null };

/** Filas que devuelven las funciones de la consola del equipo. */
export type VerificacionPendiente = {
  perfil_id: string;
  nombre_completo: string;
  dni: string | null;
  telefono: string | null;
  dni_frente_path: string | null;
  selfie_path: string | null;
  solicitado_en: string;
  dni_validacion: ResultadoDni | null;
};

export type PagoPendiente = {
  pedido_id: string;
  titulo: string;
  cliente: string;
  total_cobrado: number;
  metodo: MetodoPago | null;
  codigo_operacion: string | null;
  comprobante_path: string | null;
  reportado_en: string | null;
};

export type DisputaAbierta = {
  disputa_id: string;
  pedido_id: string;
  titulo: string;
  abierta_por: string;
  abierta_por_id: string;
  motivo: string;
  evidencia_path: string | null;
  monto: number;
  estado_pedido: EstadoPedido;
  creado_en: string;
};

/** Bandeja de avisos (supabase/migrations/0007_avisos.sql). */
export type TipoAviso =
  | 'oferta'
  | 'pedido'
  | 'pago'
  | 'mensaje'
  | 'calificacion'
  | 'verificacion';

export type Aviso = {
  id: number;
  perfil_id: string;
  pedido_id: string | null;
  tipo: TipoAviso;
  titulo: string;
  cuerpo: string;
  leido: boolean;
  creado_en: string;
};

/** Reseña pública: el comentario detrás del promedio. */
export type Resena = {
  id: number;
  puntaje: number;
  comentario: string;
  autor: string;
  pedido: string;
  creado_en: string;
};

/** Oferta propia vista desde «Mis entregas», con el pedido resumido. */
export type OfertaEnviada = {
  oferta_id: string;
  pedido_id: string;
  titulo: string;
  categoria: string;
  precio_final: number;
  fecha_entrega: string;
  estado_oferta: EstadoOferta;
  estado_pedido: EstadoPedido;
  creado_en: string;
};

/** Cola del equipo: entregas cuyo plazo de confirmación ya venció. */
export type ConfirmacionVencida = {
  pedido_id: string;
  titulo: string;
  cliente: string;
  comprador: string;
  monto: number;
  entregado_en: string;
  vence_en: string;
  dias_vencido: number;
};
