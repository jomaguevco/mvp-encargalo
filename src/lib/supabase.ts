import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase.\n\n' +
      'Copia .env.example a .env y pega la URL y la clave anónima de tu proyecto ' +
      '(Supabase → Project Settings → API). Luego reinicia con: npx expo start -c',
  );
}

/**
 * Expo Router renderiza las rutas web en Node, donde no existe `window`.
 * AsyncStorage lo usa por debajo, así que sin esta guarda el servidor de
 * desarrollo se cae en cuanto alguien abre localhost:8081 en el navegador.
 */
const enServidor = typeof window === 'undefined';

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: enServidor ? undefined : AsyncStorage,
    autoRefreshToken: !enServidor,
    persistSession: !enServidor,
    // En móvil no hay URL de la que leer el token
    detectSessionInUrl: false,
  },
});
