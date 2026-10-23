/** Espejo de los tipos de la base de datos (supabase/migrations/0001_schema.sql). */

export type EstadoVerificacion =
  | 'pendiente'
  | 'en_revision'
  | 'verificado'
  | 'rechazado';

/** Qué dijo RENIEC al contrastar el DNI y el nombre. null = no se pudo validar. */
export type ResultadoDni = 'coincide' | 'no_coincide' | 'no_existe';

/** Decisión de la verificación automática (rostro + lectura del DNI). */
export type ResultadoIa = 'aprobado' | 'revisar' | 'rechazado';

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
  ia_resultado: ResultadoIa | null;
  dni_frente_path: string | null;
  selfie_path: string | null;
  verificado_en: string | null;
  motivo_rechazo: string | null;
  /** Lo pone y lo quita un administrador; el propio usuario no puede tocarlo. */
  suspendido?: boolean;
  suspendido_motivo?: string | null;
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
  ia_resultado: ResultadoIa | null;
  ia_similitud: number | null;
  ia_numero_coincide: boolean | null;
  ia_nombre_coincide: boolean | null;
  ia_detalle: string | null;
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

/** Lo que devuelve RENIEC (consultar-dni). No se guarda en ninguna tabla. */
export type PersonaReniec = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
};

// ---------------------------------------------------------------- administración

/** Reporte del período que arma el panel (admin_resumen). */
export type ResumenAdmin = {
  cuentas: {
    total: number;
    nuevas: number;
    verificadas: number;
    en_revision: number;
    pendientes: number;
    rechazadas: number;
    suspendidas: number;
    compradores: number;
    operadores: number;
    administradores: number;
  };
  biometria: {
    evaluadas: number;
    aprobadas: number;
    revisar: number;
    rechazadas: number;
    similitud_promedio: number | null;
    reniec_coincide: number;
    reniec_no_coincide: number;
  };
  pedidos: {
    publicados: number;
    por_estado: Partial<Record<EstadoPedido, number>>;
    valor_referencial: number;
  };
  ofertas: { enviadas: number; aceptadas: number; retiradas: number };
  dinero: {
    valor_transado: number;
    cobrado: number;
    comisiones: number;
    liberado: number;
    reembolsado: number;
    pagos_liberados: number;
    ticket_promedio: number | null;
  };
  ahora: {
    retenido: number;
    pagos_retenidos: number;
    pagos_por_confirmar: number;
    verificaciones_por_revisar: number;
    disputas_abiertas: number;
  };
  disputas: { abiertas: number; a_favor_cliente: number; a_favor_comprador: number };
  calificaciones: { promedio: number | null; total: number };
  serie: { dia: string; registros: number; pedidos: number; pagos: number }[];
};

export type FiltroCuentas =
  | 'todas'
  | 'verificadas'
  | 'en_revision'
  | 'pendientes'
  | 'rechazadas'
  | 'suspendidas'
  | 'compradores'
  | 'equipo';

export type CuentaAdmin = {
  perfil_id: string;
  nombre_completo: string;
  correo: string | null;
  telefono: string | null;
  dni: string | null;
  ciudad: string;
  es_comprador: boolean;
  verificacion: EstadoVerificacion;
  ia_resultado: ResultadoIa | null;
  dni_validacion: ResultadoDni | null;
  suspendido: boolean;
  es_operador: boolean;
  es_admin: boolean;
  pedidos: number;
  ofertas: number;
  calificacion: number | null;
  creado_en: string;
  ultimo_ingreso: string | null;
  /** Otras cuentas con el mismo DNI o el mismo nombre */
  parecidas: number;
  total: number;
};

export type CuentaParecida = {
  perfil_id: string;
  nombre_completo: string;
  correo: string | null;
  verificacion: EstadoVerificacion;
  dni: string | null;
  creado_en: string;
  motivo: 'Mismo DNI' | 'Mismo nombre';
};

export type FichaCuenta = {
  perfil: Perfil & {
    correo: string | null;
    ultimo_ingreso: string | null;
    correo_confirmado: boolean;
    origen: string | null;
    codigo_referido: string | null;
    terminos_aceptados_en: string | null;
    es_operador: boolean;
    es_admin: boolean;
    suspendido_en: string | null;
    ia_similitud: number | null;
  };
  reputacion: Reputacion | null;
  pedidos: {
    id: string;
    titulo: string;
    estado: EstadoPedido;
    valor_referencial: number | null;
    creado_en: string;
    total_cobrado: number | null;
    pago_estado: EstadoPago | null;
  }[];
  entregas: {
    id: string;
    titulo: string;
    estado: EstadoPedido;
    precio_final: number;
    oferta_estado: EstadoOferta;
    creado_en: string;
  }[];
  dinero: {
    pagado_como_cliente: number;
    cobrado_como_comprador: number;
    retenido_ahora: number;
    reembolsado: number;
  };
  disputas: {
    id: string;
    pedido_id: string;
    titulo: string;
    motivo: string;
    estado: string;
    resolucion: string | null;
    creado_en: string;
    la_abrio: boolean;
  }[];
  resenas: { puntaje: number; comentario: string; creado_en: string; autor: string }[];
  bitacora: {
    accion: string;
    detalle: Record<string, unknown>;
    creado_en: string;
    actor: string | null;
  }[];
};

export type FiltroVerificaciones =
  | 'todas'
  | 'por_revisar'
  | 'auto_aprobadas'
  | 'auto_rechazadas'
  | 'equipo'
  | 'rechazadas';

export type VerificacionHistorial = {
  perfil_id: string;
  nombre_completo: string;
  dni: string | null;
  verificacion: EstadoVerificacion;
  ia_resultado: ResultadoIa | null;
  ia_similitud: number | null;
  ia_numero_coincide: boolean | null;
  ia_nombre_coincide: boolean | null;
  ia_detalle: string | null;
  dni_validacion: ResultadoDni | null;
  motivo_rechazo: string | null;
  ia_evaluado_en: string | null;
  verificado_en: string | null;
  decidio: string | null;
  decidido_en: string | null;
};

export type PedidoAdmin = {
  pedido_id: string;
  titulo: string;
  categoria: string;
  estado: EstadoPedido;
  cliente_id: string;
  cliente: string;
  comprador_id: string | null;
  comprador: string | null;
  ofertas: number;
  precio_final: number | null;
  pago_estado: EstadoPago | null;
  total_cobrado: number | null;
  creado_en: string;
  total: number;
};

export type PagoAdmin = {
  pedido_id: string;
  titulo: string;
  cliente: string;
  comprador: string;
  metodo: MetodoPago | null;
  codigo_operacion: string | null;
  monto_encargo: number;
  comision: number;
  total_cobrado: number;
  monto_liberado: number;
  estado: EstadoPago;
  reportado_en: string | null;
  retenido_en: string | null;
  liberado_en: string | null;
  creado_en: string;
};

export type ConfigItem = { clave: string; valor: number; descripcion: string };

export type EntradaBitacora = {
  id: number;
  accion: string;
  objetivo_tipo: string | null;
  objetivo_id: string | null;
  detalle: Record<string, unknown>;
  actor: string;
  creado_en: string;
};
