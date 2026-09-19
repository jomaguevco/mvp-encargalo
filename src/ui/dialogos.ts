import { Alert, Platform } from 'react-native';

/**
 * Diálogos que funcionan en Android y en navegador.
 *
 * react-native-web no implementa Alert.alert: en el navegador la llamada no
 * hace absolutamente nada y el botón parece roto. Por eso todo el código usa
 * estos ayudantes en lugar de Alert directamente.
 */

const enWeb = Platform.OS === 'web' && typeof window !== 'undefined';

export function confirmar(
  titulo: string,
  mensaje: string,
  textoAceptar = 'Aceptar',
  destructivo = false,
): Promise<boolean> {
  if (enWeb) {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));
  }
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
      {
        text: textoAceptar,
        style: destructivo ? 'destructive' : 'default',
        onPress: () => resolver(true),
      },
    ]);
  });
}

export function avisar(titulo: string, mensaje: string) {
  if (enWeb) {
    window.alert(`${titulo}\n\n${mensaje}`);
    return;
  }
  Alert.alert(titulo, mensaje);
}
