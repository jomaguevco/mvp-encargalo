import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as api from '@/lib/api';
import type { ConfigItem } from '@/lib/tipos';
import { Bloque, BotonAdmin, PaginaAdmin } from '@/ui/admin';
import { Aviso, Cargando } from '@/ui/componentes';
import { avisar, confirmar } from '@/ui/dialogos';
import { Text, TextInput } from '@/ui/Texto';
import { C, E, R } from '@/ui/tema';

/**
 * Cómo se muestra y se valida cada clave. Las tarifas se guardan como
 * fracción (0.10) y se editan como porcentaje (10); los rangos son los mismos
 * que valida admin_actualizar_config en la base.
 */
const META: Record<string, { titulo: string; unidad: string; porcentaje?: boolean; grupo: string }> = {
  comision_cliente: { titulo: 'Comisión al cliente', unidad: '%', porcentaje: true, grupo: 'Tarifas' },
  tarifa_comprador: { titulo: 'Tarifa al comprador externo', unidad: '%', porcentaje: true, grupo: 'Tarifas' },
  cargo_procesamiento: { titulo: 'Cargo de procesamiento', unidad: '%', porcentaje: true, grupo: 'Tarifas' },
  dias_para_confirmar: { titulo: 'Días para confirmar la recepción', unidad: 'días', grupo: 'Plazos' },
  umbral_rostro_aprobar: { titulo: 'Similitud mínima para aprobar sola', unidad: '%', grupo: 'Filtro biométrico' },
  umbral_rostro_rechazar: { titulo: 'Similitud por debajo de la cual se rechaza', unidad: '%', grupo: 'Filtro biométrico' },
};

const aPantalla = (c: ConfigItem) =>
  META[c.clave]?.porcentaje ? String(+(Number(c.valor) * 100).toFixed(3)) : String(Number(c.valor));

/** Configuración del negocio: tarifas, plazos y umbrales del filtro biométrico. */
export default function ConfiguracionAdmin() {
  const [items, setItems] = useState<ConfigItem[] | null>(null);
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const xs = await api.configuracion();
      setItems(xs);
      setBorradores(Object.fromEntries(xs.map((c) => [c.clave, aPantalla(c)])));
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function guardar(c: ConfigItem) {
    const meta = META[c.clave];
    const texto = (borradores[c.clave] ?? '').replace(',', '.').trim();
    const n = Number(texto);
    if (!texto || Number.isNaN(n)) {
      avisar('Valor no válido', 'Escribe un número.');
      return;
    }
    const valor = meta?.porcentaje ? n / 100 : n;
    const esTarifa = meta?.grupo === 'Tarifas';
    const ok = await confirmar(
      `Cambiar «${meta?.titulo ?? c.clave}»`,
      `De ${aPantalla(c)} a ${texto} ${meta?.unidad ?? ''}.` +
        (esTarifa
          ? '\n\nSe aplica a todos los pagos NUEVOS. Recuerda actualizar también la hoja «Supuestos» del flujo de caja para que coincidan.'
          : ''),
      'Guardar',
      esTarifa,
    );
    if (!ok) return;
    setOcupado(c.clave);
    try {
      await api.actualizarConfig(c.clave, valor);
      await cargar();
    } catch (e) {
      avisar('No se pudo guardar', (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  if (items === null) return <Cargando texto="Cargando la configuración…" />;

  const grupos = Array.from(new Set(items.map((c) => META[c.clave]?.grupo ?? 'Otros')));

  return (
    <PaginaAdmin
      titulo="Configuración"
      subtitulo="Los valores viven en la tabla config: nada está escrito en el código. Cada cambio queda en la bitácora.">
      {!!error && <Aviso tono="error" titulo="No se pudo cargar">{error}</Aviso>}
      <Aviso tono="alerta" titulo="Cambios con efecto inmediato">
        Las tarifas recalculan todo pago nuevo y los umbrales cambian lo que la biometría aprueba sola. Los
        pagos ya creados no cambian.
      </Aviso>
      {grupos.map((g) => (
        <Bloque key={g} titulo={g} icono={g === 'Tarifas' ? 'cash-outline' : g === 'Plazos' ? 'time-outline' : g === 'Filtro biométrico' ? 'scan-outline' : 'options-outline'}>
          {items
            .filter((c) => (META[c.clave]?.grupo ?? 'Otros') === g)
            .map((c) => {
              const meta = META[c.clave];
              const cambiado = borradores[c.clave] !== aPantalla(c);
              return (
                <View key={c.clave} style={s.fila}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.titulo}>{meta?.titulo ?? c.clave}</Text>
                    <Text style={s.descripcion}>{c.descripcion}</Text>
                    <Text style={s.clave}>{c.clave}</Text>
                  </View>
                  <View style={s.editor}>
                    <TextInput
                      value={borradores[c.clave] ?? ''}
                      onChangeText={(t) => setBorradores((b) => ({ ...b, [c.clave]: t }))}
                      keyboardType="decimal-pad"
                      style={[s.entrada, cambiado && { borderColor: C.naranja }]}
                    />
                    <Text style={s.unidad}>{meta?.unidad ?? ''}</Text>
                    <BotonAdmin
                      titulo={ocupado === c.clave ? 'Guardando…' : 'Guardar'}
                      icono="save-outline"
                      variante={cambiado ? 'primario' : 'suave'}
                      deshabilitado={!cambiado || ocupado === c.clave}
                      onPress={() => guardar(c)}
                    />
                  </View>
                </View>
              );
            })}
        </Bloque>
      ))}
    </PaginaAdmin>
  );
}

const s = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: E.lg,
    paddingVertical: E.md,
    borderTopWidth: 1,
    borderColor: C.superficieSuave,
    flexWrap: 'wrap',
  },
  titulo: { fontSize: 15, fontWeight: '700', color: C.texto },
  descripcion: { fontSize: 13, color: C.textoSuave },
  clave: { fontSize: 11.5, color: C.grisTexto, fontFamily: 'monospace' },
  editor: { flexDirection: 'row', alignItems: 'center', gap: E.sm },
  entrada: {
    width: 110,
    height: 40,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: R.sm,
    paddingHorizontal: E.md,
    fontSize: 16,
    fontWeight: '700',
    color: C.azul,
    backgroundColor: C.blanco,
    textAlign: 'right',
  },
  unidad: { width: 36, fontSize: 14, color: C.textoSuave },
});
