import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from './Texto';
import { Chip, type NombreIcono } from './componentes';
import { avisar } from './dialogos';
import { useEscritorio } from './escritorio';
import { C, E, R, sombra } from './tema';
import { ESTADO_PAGO, ESTADO_PEDIDO, ESTADO_VERIFICACION } from '@/lib/negocio';
import type {
  EstadoPago,
  EstadoPedido,
  EstadoVerificacion,
  ResultadoDni,
  ResultadoIa,
} from '@/lib/tipos';

/**
 * Piezas del panel de administración (/admin).
 *
 * El panel es una herramienta de escritorio: tablas anchas, filtros a la vista
 * y exportación a CSV. Reusa la marca y los componentes de la app, pero no su
 * ritmo de tarjetas grandes, que en una lista de 300 cuentas no se puede leer.
 */

// ------------------------------------------------------------------ página
export function PaginaAdmin({
  titulo,
  subtitulo,
  acciones,
  children,
  refrescando,
  onRefrescar,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  children: ReactNode;
  refrescando?: boolean;
  onRefrescar?: () => void;
}) {
  const { es: escritorio } = useEscritorio();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.fondo }}
      contentContainerStyle={[s.pagina, escritorio && s.paginaEscritorio]}
      refreshControl={
        onRefrescar ? (
          <RefreshControl refreshing={!!refrescando} onRefresh={onRefrescar} />
        ) : undefined
      }>
      <View style={[s.cabecera, !escritorio && { flexDirection: 'column', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.titulo}>{titulo}</Text>
          {!!subtitulo && <Text style={s.subtitulo}>{subtitulo}</Text>}
        </View>
        {!!acciones && <View style={s.acciones}>{acciones}</View>}
      </View>
      {children}
    </ScrollView>
  );
}

/** Botón compacto para la barra de acciones de una página. */
export function BotonAdmin({
  titulo,
  icono,
  onPress,
  variante = 'suave',
  deshabilitado,
}: {
  titulo: string;
  icono?: NombreIcono;
  onPress: () => void;
  variante?: 'suave' | 'primario' | 'peligro' | 'exito';
  deshabilitado?: boolean;
}) {
  const fondo = {
    suave: C.blanco,
    primario: C.azul,
    peligro: C.rojo,
    exito: C.verde,
  }[variante];
  const color = variante === 'suave' ? C.azul : C.blanco;
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        s.boton,
        { backgroundColor: fondo, borderColor: variante === 'suave' ? C.borde : fondo },
        (pressed || hovered) && { opacity: 0.85 },
        deshabilitado && { opacity: 0.4 },
      ]}>
      {!!icono && <Ionicons name={icono} size={16} color={color} />}
      <Text style={[s.botonTexto, { color }]}>{titulo}</Text>
    </Pressable>
  );
}

// ------------------------------------------------------------------ cifras
export function Kpi({
  etiqueta,
  valor,
  detalle,
  icono,
  color = C.azulMedio,
  onPress,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  icono: NombreIcono;
  color?: string;
  onPress?: () => void;
}) {
  const cuerpo = (
    <>
      <View style={s.kpiFila}>
        <View style={[s.kpiIcono, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icono} size={16} color={color} />
        </View>
        <Text style={s.kpiEtiqueta} numberOfLines={2}>
          {etiqueta}
        </Text>
      </View>
      <Text style={s.kpiValor} numberOfLines={1}>
        {valor}
      </Text>
      {!!detalle && <Text style={s.kpiDetalle}>{detalle}</Text>}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.kpi, pressed && { opacity: 0.85 }]}>
        {cuerpo}
      </Pressable>
    );
  }
  return <View style={s.kpi}>{cuerpo}</View>;
}

/** Cuadrícula de cifras: cuatro por fila en escritorio, dos en el teléfono. */
export function GrillaKpi({ children }: { children: ReactNode }) {
  return <View style={s.grilla}>{children}</View>;
}

/** Bloque con título, para agrupar cifras o una tabla. */
export function Bloque({
  titulo,
  icono,
  derecha,
  children,
  style,
}: {
  titulo: string;
  icono?: NombreIcono;
  derecha?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.bloque, style]}>
      <View style={s.bloqueCabecera}>
        {!!icono && <Ionicons name={icono} size={17} color={C.azulMedio} />}
        <Text style={s.bloqueTitulo}>{titulo}</Text>
        <View style={{ flex: 1 }} />
        {derecha}
      </View>
      {children}
    </View>
  );
}

/** Una fila «etiqueta ........ valor» con barra de proporción opcional. */
export function FilaDato({
  etiqueta,
  valor,
  proporcion,
  color = C.azulMedio,
}: {
  etiqueta: string;
  valor: string;
  proporcion?: number;
  color?: string;
}) {
  return (
    <View style={{ gap: 4, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: E.sm }}>
        <Text style={s.filaEtiqueta}>{etiqueta}</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.filaValor}>{valor}</Text>
      </View>
      {proporcion != null && (
        <View style={s.barraFondo}>
          <View
            style={[
              s.barraRelleno,
              { width: `${Math.max(0, Math.min(1, proporcion)) * 100}%`, backgroundColor: color },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ gráfico
/**
 * Barras por día. Sin librería de gráficos: con Views alcanza para leer una
 * tendencia, y no suma peso al paquete de la app móvil.
 */
export function BarrasDiarias({
  serie,
  campos,
}: {
  serie: Record<string, number | string>[];
  campos: { clave: string; etiqueta: string; color: string }[];
}) {
  const max = Math.max(1, ...serie.flatMap((d) => campos.map((c) => Number(d[c.clave]) || 0)));
  const mostrarEtiqueta = (i: number) =>
    serie.length <= 14 || i % Math.ceil(serie.length / 10) === 0 || i === serie.length - 1;
  return (
    <View>
      <View style={s.leyenda}>
        {campos.map((c) => (
          <View key={c.clave} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.color }} />
            <Text style={s.leyendaTexto}>{c.etiqueta}</Text>
          </View>
        ))}
      </View>
      <View style={s.grafico}>
        {serie.map((d, i) => (
          <View key={String(d.dia)} style={s.columna}>
            <View style={s.columnaBarras}>
              {campos.map((c) => {
                const v = Number(d[c.clave]) || 0;
                return (
                  <View
                    key={c.clave}
                    // El valor exacto aparece al pasar el mouse (title en web).
                    {...(Platform.OS === 'web' ? { title: `${d.dia}: ${v} ${c.etiqueta.toLowerCase()}` } : {})}
                    style={{
                      flex: 1,
                      height: `${(v / max) * 100}%`,
                      minHeight: v > 0 ? 3 : 0,
                      backgroundColor: c.color,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                    }}
                  />
                );
              })}
            </View>
            <Text style={s.columnaEtiqueta} numberOfLines={1}>
              {mostrarEtiqueta(i) ? String(d.dia).slice(5).split('-').reverse().join('/') : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ tabla
export type Columna<T> = {
  clave: string;
  titulo: string;
  /** Peso relativo del ancho */
  ancho?: number;
  alinear?: 'izquierda' | 'derecha';
  render?: (fila: T) => ReactNode;
  /** Valor plano para ordenar y para el CSV, si render no devuelve texto */
  valor?: (fila: T) => string | number | null;
};

/**
 * Tabla de datos. En pantallas angostas se desplaza de costado en vez de
 * apretar las columnas hasta volverlas ilegibles.
 */
export function Tabla<T>({
  columnas,
  filas,
  clave,
  onFila,
  vacio = 'No hay datos para mostrar',
}: {
  columnas: Columna<T>[];
  filas: T[];
  clave: (fila: T) => string;
  onFila?: (fila: T) => void;
  vacio?: string;
}) {
  const { es: escritorio } = useEscritorio();
  const anchoMinimo = escritorio ? undefined : columnas.reduce((a, c) => a + (c.ancho ?? 1) * 120, 0);

  const contenido = (
    <View style={[s.tabla, anchoMinimo ? { width: anchoMinimo } : null]}>
      <View style={[s.tablaFila, s.tablaCabecera]}>
        {columnas.map((c) => (
          <Text
            key={c.clave}
            style={[
              s.tablaTitulo,
              { flex: c.ancho ?? 1 },
              c.alinear === 'derecha' && { textAlign: 'right' },
            ]}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {filas.length === 0 && <Text style={s.tablaVacia}>{vacio}</Text>}
      {filas.map((f, i) => {
        const celdas = columnas.map((c) => {
          const v = c.render ? c.render(f) : String((f as Record<string, unknown>)[c.clave] ?? '—');
          return (
            <View
              key={c.clave}
              style={[
                { flex: c.ancho ?? 1, justifyContent: 'center' },
                c.alinear === 'derecha' && { alignItems: 'flex-end' },
              ]}>
              {typeof v === 'string' || typeof v === 'number' ? (
                <Text
                  style={[s.tablaCelda, c.alinear === 'derecha' && { textAlign: 'right' }]}
                  numberOfLines={2}>
                  {v}
                </Text>
              ) : (
                v
              )}
            </View>
          );
        });
        return onFila ? (
          <Pressable
            key={clave(f)}
            onPress={() => onFila(f)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              s.tablaFila,
              i % 2 === 1 && s.tablaBanda,
              (pressed || hovered) && { backgroundColor: C.azulFondo },
            ]}>
            {celdas}
          </Pressable>
        ) : (
          <View key={clave(f)} style={[s.tablaFila, i % 2 === 1 && s.tablaBanda]}>
            {celdas}
          </View>
        );
      })}
    </View>
  );

  if (anchoMinimo) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator>
        {contenido}
      </ScrollView>
    );
  }
  return contenido;
}

// ------------------------------------------------------------------ filtros
export function Buscador({
  valor,
  onCambiar,
  onBuscar,
  placeholder = 'Buscar…',
}: {
  valor: string;
  onCambiar: (t: string) => void;
  onBuscar: () => void;
  placeholder?: string;
}) {
  return (
    <View style={s.buscador}>
      <Ionicons name="search" size={17} color={C.grisTexto} />
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        onSubmitEditing={onBuscar}
        placeholder={placeholder}
        placeholderTextColor={C.grisTexto}
        returnKeyType="search"
        style={s.buscadorEntrada}
      />
      {!!valor && (
        <Pressable
          onPress={() => {
            onCambiar('');
            setTimeout(onBuscar, 0);
          }}
          hitSlop={8}>
          <Ionicons name="close-circle" size={17} color={C.grisTexto} />
        </Pressable>
      )}
    </View>
  );
}

/** Fichas de filtro en una fila. */
export function Fichas<T extends string>({
  valor,
  opciones,
  onCambiar,
}: {
  valor: T;
  opciones: { valor: T; etiqueta: string; conteo?: number }[];
  onCambiar: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fichas}>
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onCambiar(o.valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activa }}
            style={[s.ficha, activa && s.fichaActiva]}>
            <Text style={[s.fichaTexto, activa && { color: C.sobreOscuro }]}>
              {o.etiqueta}
              {o.conteo != null ? ` · ${o.conteo}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Paginador({
  desde,
  porPagina,
  total,
  onCambiar,
}: {
  desde: number;
  porPagina: number;
  total: number;
  onCambiar: (desde: number) => void;
}) {
  if (total <= porPagina) {
    return <Text style={s.paginadorTexto}>{total} en total</Text>;
  }
  const hasta = Math.min(desde + porPagina, total);
  return (
    <View style={s.paginador}>
      <Text style={s.paginadorTexto}>
        {desde + 1}–{hasta} de {total}
      </Text>
      <BotonAdmin
        titulo="Anterior"
        icono="chevron-back"
        deshabilitado={desde === 0}
        onPress={() => onCambiar(Math.max(0, desde - porPagina))}
      />
      <BotonAdmin
        titulo="Siguiente"
        icono="chevron-forward"
        deshabilitado={hasta >= total}
        onPress={() => onCambiar(desde + porPagina)}
      />
    </View>
  );
}

// ------------------------------------------------------------------ insignias
export function ChipVerificacion({ estado }: { estado: EstadoVerificacion }) {
  const info = ESTADO_VERIFICACION[estado];
  return <Chip texto={info?.etiqueta ?? estado} color={info?.color ?? C.grisTexto} />;
}

export function ChipPedido({ estado }: { estado: EstadoPedido }) {
  const info = ESTADO_PEDIDO[estado];
  return <Chip texto={info?.etiqueta ?? estado} color={info?.color ?? C.grisTexto} />;
}

export function ChipPago({ estado }: { estado: EstadoPago | null }) {
  if (!estado) return <Text style={s.tablaCelda}>—</Text>;
  const info = ESTADO_PAGO[estado];
  return <Chip texto={info?.etiqueta ?? estado} color={info?.color ?? C.grisTexto} />;
}

export function ChipIa({ resultado }: { resultado: ResultadoIa | null }) {
  if (!resultado) return <Chip texto="Sin evaluar" color={C.grisTexto} icono="help-circle" />;
  const conf = {
    aprobado: { texto: 'IA: aprobó', color: C.verde, icono: 'scan' as const },
    revisar: { texto: 'IA: revisar', color: C.ambar, icono: 'eye' as const },
    rechazado: { texto: 'IA: rechazó', color: C.rojo, icono: 'close-circle' as const },
  }[resultado];
  return <Chip texto={conf.texto} color={conf.color} icono={conf.icono} />;
}

export function ChipReniec({ r }: { r: ResultadoDni | null }) {
  if (!r) return <Chip texto="RENIEC: sin validar" color={C.grisTexto} icono="help-circle" />;
  return r === 'coincide' ? (
    <Chip texto="RENIEC: coincide" color={C.verde} icono="checkmark-circle" />
  ) : (
    <Chip
      texto={r === 'no_existe' ? 'RENIEC: no existe' : 'RENIEC: no coincide'}
      color={C.rojo}
      icono="warning"
    />
  );
}

/** Cómo se lee cada acción de la bitácora. */
export const ACCION_BITACORA: Record<string, string> = {
  verificacion_verificado: 'Verificación aprobada por el equipo',
  verificacion_rechazado: 'Verificación rechazada por el equipo',
  verificacion_automatica_verificado: 'Verificación aprobada por la biometría',
  verificacion_automatica_rechazado: 'Verificación rechazada por la biometría',
  cuenta_suspendida: 'Cuenta suspendida',
  cuenta_reactivada: 'Cuenta reactivada',
  rol_otorgado: 'Rol otorgado',
  rol_retirado: 'Rol retirado',
  pago_retenido: 'Pago confirmado y retenido',
  pago_liberado: 'Pago liberado al comprador externo',
  pago_reembolsado: 'Pago reembolsado al cliente',
  pago_pendiente: 'Comprobante rechazado: vuelve a pendiente',
  disputa_resuelta_cliente: 'Disputa resuelta a favor del cliente',
  disputa_resuelta_comprador: 'Disputa resuelta a favor del comprador',
  config_actualizada: 'Configuración cambiada',
  foto_quitada: 'Foto de perfil quitada por moderación',
};

// ------------------------------------------------------------------ exportar
/**
 * Descarga filas como CSV (solo en la web, que es donde vive el panel).
 * Lleva BOM para que Excel abra bien las tildes y la ñ.
 */
export function descargarCsv(nombre: string, filas: Record<string, unknown>[]) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    avisar('Exportar', 'La exportación a CSV está disponible en la versión web del panel.');
    return;
  }
  if (filas.length === 0) {
    avisar('Exportar', 'No hay filas para exportar con estos filtros.');
    return;
  }
  const columnas = Object.keys(filas[0]);
  const escapar = (v: unknown) => {
    const t =
      v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv =
    '﻿' +
    [columnas.join(','), ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(','))].join(
      '\n',
    );
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Pide un texto al administrador (motivo de una suspensión, por ejemplo). */
export function pedirTexto(titulo: string, ayuda: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const t = window.prompt(`${titulo}\n\n${ayuda}`);
    return t == null ? null : t.trim();
  }
  avisar(titulo, 'Esta acción se hace desde la versión web del panel.');
  return null;
}

const s = StyleSheet.create({
  pagina: { padding: E.lg, gap: E.lg, paddingBottom: 64 },
  paginaEscritorio: { padding: E.xxl, gap: E.xl, maxWidth: 1440, width: '100%', alignSelf: 'center' },
  cabecera: { flexDirection: 'row', alignItems: 'flex-end', gap: E.lg },
  titulo: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: C.azul },
  subtitulo: { fontSize: 15, color: C.textoSuave },
  acciones: { flexDirection: 'row', gap: E.sm, flexWrap: 'wrap' },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: R.sm,
    borderWidth: 1,
  },
  botonTexto: { fontSize: 14, fontWeight: '700' },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: E.md },
  kpi: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borde,
    padding: E.lg,
    gap: 6,
    ...sombra(1),
  },
  kpiFila: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  kpiIcono: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiEtiqueta: { flex: 1, fontSize: 13.5, fontWeight: '600', color: C.textoSuave },
  kpiValor: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: C.azul },
  kpiDetalle: { fontSize: 12.5, color: C.grisTexto },
  bloque: {
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borde,
    padding: E.lg,
    gap: E.md,
  },
  bloqueCabecera: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  bloqueTitulo: { fontSize: 17, fontWeight: '700', color: C.azul },
  filaEtiqueta: { fontSize: 14, color: C.texto },
  filaValor: { fontSize: 14, fontWeight: '700', color: C.azul },
  barraFondo: { height: 6, borderRadius: 3, backgroundColor: C.superficieSuave, overflow: 'hidden' },
  barraRelleno: { height: 6, borderRadius: 3 },
  leyenda: { flexDirection: 'row', gap: E.lg, marginBottom: E.sm, flexWrap: 'wrap' },
  leyendaTexto: { fontSize: 12.5, color: C.textoSuave },
  grafico: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    gap: 3,
    borderBottomWidth: 1,
    borderColor: C.borde,
  },
  columna: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  columnaBarras: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  columnaEtiqueta: { fontSize: 10, color: C.grisTexto, textAlign: 'center', marginTop: 4, height: 14 },
  tabla: {
    backgroundColor: C.blanco,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borde,
    overflow: 'hidden',
  },
  tablaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.md,
    paddingHorizontal: E.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: C.superficieSuave,
  },
  tablaCabecera: { backgroundColor: C.azul, borderColor: C.azul },
  tablaTitulo: { fontSize: 12.5, fontWeight: '700', color: C.sobreOscuro, textTransform: 'uppercase', letterSpacing: 0.4 },
  tablaBanda: { backgroundColor: '#FBF8F3' },
  tablaCelda: { fontSize: 14, color: C.texto },
  tablaVacia: { padding: E.xl, textAlign: 'center', color: C.textoSuave },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.sm,
    backgroundColor: C.blanco,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: R.md,
    paddingHorizontal: E.md,
    height: 42,
    flex: 1,
    minWidth: 220,
  },
  buscadorEntrada: { flex: 1, fontSize: 15, color: C.texto, height: 40 },
  fichas: { gap: E.sm, paddingRight: E.lg },
  ficha: {
    paddingHorizontal: 14,
    height: 34,
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.blanco,
  },
  fichaActiva: { backgroundColor: C.azul, borderColor: C.azul },
  fichaTexto: { fontSize: 13.5, fontWeight: '600', color: C.texto },
  paginador: { flexDirection: 'row', alignItems: 'center', gap: E.sm, justifyContent: 'flex-end' },
  paginadorTexto: { fontSize: 13.5, color: C.textoSuave, textAlign: 'right' },
});
