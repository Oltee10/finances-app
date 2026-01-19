/**
 * AuthContext - Contexto de React para manejar la autenticación
 * 
 * Funcionalidades:
 * - Login con username/password
 * - Registro con username/password
 * - Logout
 * - Estado de carga de sesión
 * - Persistencia de sesión usando onAuthStateChanged
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type AuthError,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, usernameToEmail, emailToUsername } from '@/config/firebase';
import { useLanguage } from '@/contexts/LanguageContext';
import type { User } from '@/types';

/**
 * Interfaz del contexto de autenticación
 */
interface AuthContextType {
  /** Usuario actual autenticado (null si no está autenticado) */
  user: User | null;
  /** Usuario de Firebase Auth (para referencias directas si es necesario) */
  firebaseUser: FirebaseUser | null;
  /** Indica si se está verificando la sesión inicial */
  loading: boolean;
  /** Indica si se está procesando una operación de autenticación */
  authenticating: boolean;
  /** Error de autenticación (si existe) */
  error: string | null;
  /** Función para iniciar sesión */
  login: (username: string, password: string) => Promise<void>;
  /** Función para registrar un nuevo usuario */
  register: (username: string, password: string) => Promise<void>;
  /** Función para cerrar sesión */
  logout: () => Promise<void>;
  /** Función para limpiar el error */
  clearError: () => void;
}

/**
 * Crea el contexto de autenticación
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hook para usar el contexto de autenticación
 * 
 * @throws Error si se usa fuera del AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}

/**
 * Props del AuthProvider
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Proveedor del contexto de autenticación
 * 
 * Maneja:
 * - Estado de autenticación
 * - Persistencia de sesión mediante onAuthStateChanged
 * - Creación automática del documento de usuario en Firestore al registrarse
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authenticating, setAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Maneja errores de Firebase Auth y los convierte a mensajes amigables
   */
  const handleAuthError = (error: any): void => {
    if (error.code === 'auth/invalid-credential') {
      setError(t('auth.error.invalid-credential'));
    } else if (error.code === 'auth/user-not-found') {
      setError(t('auth.error.user-not-found'));
    } else if (error.code === 'auth/wrong-password') {
      setError(t('auth.error.wrong-password'));
    } else if (error.code === 'auth/email-already-in-use') {
      setError(t('auth.error.email-already-in-use'));
    } else if (error.code === 'auth/invalid-email') {
      setError(t('auth.error.invalid-email'));
    } else if (error.code === 'auth/weak-password') {
      setError(t('auth.error.weak-password'));
    } else if (error.code === 'auth/too-many-requests') {
      setError(t('auth.error.too-many-requests'));
    } else if (error.code === 'auth/network-request-failed') {
      setError(t('auth.error.network-request-failed'));
    } else if (error.code === 'auth/internal-error') {
      setError(t('auth.error.internal-error'));
    } else if (error.code === 'auth/operation-not-allowed') {
      setError(t('auth.error.operation-not-allowed'));
    } else if (error.code === 'auth/requires-recent-login') {
      setError(t('auth.error.requires-recent-login'));
    } else {
      setError(error.message || t('auth.error.unexpected'));
    }
  };

  /**
   * Carga el documento del usuario desde Firestore
   */
  const loadUserFromFirestore = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: firebaseUser.uid,
          username: userData.username,
          createdAt: userData.createdAt,
        } as User;
      }
      
      // Si el documento no existe, retorna null
      // (esto podría pasar si el usuario fue eliminado manualmente)
      return null;
    } catch (error) {
      console.error('Error al cargar usuario desde Firestore:', error);
      return null;
    }
  };

  /**
   * Crea el documento del usuario en Firestore después del registro
   */
  const createUserDocument = async (firebaseUser: FirebaseUser, username: string): Promise<void> => {
    try {
      const userDoc: User = {
        id: firebaseUser.uid,
        username,
        createdAt: serverTimestamp() as any, // Firebase Timestamp se asigna en el servidor
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), userDoc);
    } catch (error) {
      console.error('Error al crear documento de usuario:', error);
      throw error;
    }
  };

  /**
   * Inicia sesión con username y password
   * 
   * Convierte el username a email usando el dominio pseudo
   */
  const login = async (username: string, password: string): Promise<void> => {
    setAuthenticating(true);
    // Limpiar error previo solo al inicio
    setError(null);
    
    try {
      const email = usernameToEmail(username);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Cargar el documento del usuario desde Firestore
      const userDoc = await loadUserFromFirestore(userCredential.user);
      
      if (userDoc) {
        setUser(userDoc);
        setFirebaseUser(userCredential.user);
        // Limpiar error si el login fue exitoso
        setError(null);
      } else {
        // Si no existe el documento, hacer logout (caso edge)
        await signOut(auth);
        setError(t('auth.error.user-not-found-db'));
        throw new Error(t('auth.error.user-not-found-db'));
      }
    } catch (error: any) {
      // Manejar el error y establecer el mensaje
      console.log('Error en login:', error.code, error.message);
      if (error.code) {
        handleAuthError(error);
      } else {
        setError(error.message || t('auth.error.unexpected'));
      }
      // NO lanzar el error de nuevo - ya lo manejamos
    } finally {
      setAuthenticating(false);
    }
  };

  /**
   * Registra un nuevo usuario con username y password
   * 
   * Convierte el username a email usando el dominio pseudo.
   * Crea automáticamente el documento del usuario en Firestore.
   */
  const register = async (username: string, password: string): Promise<void> => {
    setAuthenticating(true);
    // Limpiar error previo solo al inicio
    setError(null);
    
    try {
      // Validar que el username no esté vacío
      if (!username || username.trim().length === 0) {
        setError(t('login.validation.username.required'));
        throw new Error(t('login.validation.username.required'));
      }
      
      // Validar que la contraseña tenga al menos 6 caracteres (requerimiento de Firebase)
      if (!password || password.length < 6) {
        setError(t('login.validation.password.min'));
        throw new Error(t('login.validation.password.min'));
      }
      
      const email = usernameToEmail(username);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Crear el documento del usuario en Firestore
      await createUserDocument(userCredential.user, username.trim());
      
      // Cargar el documento del usuario desde Firestore
      const userDoc = await loadUserFromFirestore(userCredential.user);
      
      if (userDoc) {
        setUser(userDoc);
        setFirebaseUser(userCredential.user);
        // Limpiar error si el registro fue exitoso
        setError(null);
      }
    } catch (error: any) {
      // Manejar el error y establecer el mensaje
      console.log('Error en register:', error.code, error.message);
      if (error.code) {
        handleAuthError(error);
      } else {
        // Si ya establecimos el error arriba (validación), no lo sobrescribimos
        if (!error.message || (!error.message.includes('vacío') && !error.message.includes('caracteres'))) {
          setError(error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.');
        }
      }
      // NO lanzar el error de nuevo - ya lo manejamos
    } finally {
      setAuthenticating(false);
    }
  };

  /**
   * Cierra sesión del usuario actual
   */
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
      setError(null);
    } catch (error: any) {
      const errorMessage = handleAuthError(error);
      setError(errorMessage);
      throw error;
    }
  };

  /**
   * Limpia el error actual
   */
  const clearError = (): void => {
    setError(null);
  };

  /**
   * Efecto para escuchar cambios en el estado de autenticación
   * Esto maneja la persistencia de sesión automáticamente
   */
  useEffect(() => {
    setLoading(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Usuario autenticado: cargar datos desde Firestore
        const userDoc = await loadUserFromFirestore(firebaseUser);
        setUser(userDoc);
        setFirebaseUser(firebaseUser);
        // Solo limpiar error si el usuario se autenticó exitosamente
        setError(null);
      } else {
        // Usuario no autenticado: limpiar estado
        // NO limpiar el error aquí - puede ser un error de autenticación que debe mostrarse
        setUser(null);
        setFirebaseUser(null);
      }
      
      setLoading(false);
    });

    // Limpiar el listener al desmontar
    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    authenticating,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
