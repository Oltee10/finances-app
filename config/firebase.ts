/**
 * Configuración de Firebase
 * 
 * Nota: Para usar esta aplicación, necesitas crear un proyecto en Firebase Console
 * y agregar las credenciales aquí o usar variables de entorno.
 * 
 * Para desarrollo, puedes usar Firebase Emulator Suite:
 * - Configura las variables de entorno según sea necesario
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// @ts-expect-error - getReactNativePersistence existe en runtime pero no en tipos de TypeScript para Firebase v12
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Configuración de Firebase
 * 
 * IMPORTANTE: Reemplaza estas credenciales con las de tu proyecto Firebase
 * Obtén estas credenciales desde Firebase Console > Project Settings > General
 */
const firebaseConfig = {
    apiKey: "AIzaSyAitnQ734xsPiBcmeA4mM4mcxNwUgsMKkY",
    authDomain: "finanzas-app-2026.firebaseapp.com",
    projectId: "finanzas-app-2026",
    storageBucket: "finanzas-app-2026.firebasestorage.app",
    messagingSenderId: "983513461554",
    appId: "1:983513461554:web:932a7a51616676c4751d2b"
  };

/**
 * Dominio pseudo utilizado para convertir username a email
 * El usuario nunca ve este dominio, solo ingresa su username
 */
export const PSEUDO_EMAIL_DOMAIN = '@app.internal';

/**
 * Inicializa Firebase solo si no está ya inicializado
 * Esto previene errores en hot-reload
 */
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

/**
 * Inicializa Firebase Auth con persistencia usando AsyncStorage
 * Esto permite que la sesión del usuario persista entre reinicios de la app
 * 
 * En React Native, Firebase Auth v9+ requiere usar initializeAuth con 
 * getReactNativePersistence para persistir la sesión en AsyncStorage
 */
let auth: Auth;

// Intentar inicializar auth con persistencia AsyncStorage
// Siempre intentar usar initializeAuth con persistencia primero
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error: any) {
  // Si ya está inicializado, el error será "auth/already-initialized"
  // En ese caso, obtener la instancia existente
  if (error?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    // Si es otro error, intentar usar getAuth como fallback
    try {
      auth = getAuth(app);
    } catch {
      // Si todo falla, lanzar el error original
      throw error;
    }
  }
}

/**
 * Instancias de Firebase Auth y Firestore
 */
export { auth };
export const db: Firestore = getFirestore(app);

/**
 * Helper function: Convierte username a email usando el dominio pseudo
 * 
 * @param username - El nombre de usuario ingresado por el usuario
 * @returns El email completo para usar con Firebase Auth
 * 
 * @example
 * usernameToEmail('miguel') // 'miguel@app.internal'
 */
export function usernameToEmail(username: string): string {
  return `${username.trim()}${PSEUDO_EMAIL_DOMAIN}`;
}

/**
 * Helper function: Extrae el username del email
 * 
 * @param email - El email completo de Firebase Auth
 * @returns El username sin el dominio
 * 
 * @example
 * emailToUsername('miguel@app.internal') // 'miguel'
 */
export function emailToUsername(email: string): string {
  if (email.endsWith(PSEUDO_EMAIL_DOMAIN)) {
    return email.replace(PSEUDO_EMAIL_DOMAIN, '');
  }
  return email;
}

export default app;
