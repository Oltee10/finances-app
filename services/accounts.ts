/**
 * Servicio para gestionar cuentas en Firestore
 * 
 * Funcionalidades:
 * - Obtener todas las cuentas donde el usuario es miembro
 * - Crear nueva cuenta (Individual o Group)
 * - Unirse a cuenta de grupo usando inviteCode
 * - Calcular balance de cuenta desde transacciones
 * - Generar inviteCode único para cuentas de grupo
 */

import { db } from '@/config/firebase';
import type { Account, AccountWithBalance, CreateAccountInput } from '@/types';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';

/**
 * Genera un código de unión aleatorio de 6 caracteres alfanuméricos
 * 
 * @returns Código único de 6 caracteres (ej: "A1B2C3")
 */
export function generateinviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Verifica si un inviteCode ya existe en Firestore
 * 
 * @param inviteCode - El código a verificar
 * @returns true si el código existe, false si no
 */
async function inviteCodeExists(inviteCode: string): Promise<boolean> {
  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('inviteCode', '==', inviteCode));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error verificando inviteCode:', error);
    return false;
  }
}

/**
 * Genera un inviteCode único (verifica que no exista)
 * 
 * @returns Código único de 6 caracteres
 */
async function generateUniqueinviteCode(): Promise<string> {
  let code = generateinviteCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (await inviteCodeExists(code) && attempts < maxAttempts) {
    code = generateinviteCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('No se pudo generar un código único después de varios intentos');
  }

  return code;
}

/**
 * Calcula el balance de una cuenta sumando todas sus transacciones
 * Usa la subcolección: accounts/{accountId}/transactions
 * 
 * @param accountId - ID de la cuenta
 * @returns Balance calculado (positivo para INCOME, negativo para EXPENSE)
 */
export async function calculateAccountBalance(accountId: string): Promise<number> {
  try {
    // Usar subcolección: accounts/{accountId}/transactions
    const transactionsRef = collection(db, 'accounts', accountId, 'transactions');
    const querySnapshot = await getDocs(transactionsRef);

    let balance = 0;

    querySnapshot.forEach((doc) => {
      const transaction = doc.data();
      if (transaction.type === 'INCOME') {
        balance += transaction.amount;
      } else if (transaction.type === 'EXPENSE') {
        balance -= transaction.amount;
      }
    });

    return balance;
  } catch (error: any) {
    // Manejar errores de permisos o cualquier otro error de Firebase
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.warn('Permisos insuficientes para calcular balance de cuenta:', accountId);
      return 0;
    }
    console.error('Error calculando balance:', error);
    return 0;
  }
}

/**
 * Obtiene todas las cuentas donde el usuario es miembro
 * 
 * @param userId - ID del usuario actual
 * @returns Array de cuentas con balance calculado
 */
export async function getUserAccounts(userId: string): Promise<AccountWithBalance[]> {
  try {
    const accountsRef = collection(db, 'accounts');
    // La consulta debe alinear con las reglas de seguridad:
    // allow read: if request.auth.uid in resource.data.memberIds;
    const q = query(accountsRef, where('memberIds', 'array-contains', userId));
    const querySnapshot = await getDocs(q);

    const accounts: AccountWithBalance[] = [];

    // Obtener cuentas y calcular balances en paralelo
    const accountPromises = querySnapshot.docs.map(async (docSnapshot) => {
      try {
        const accountData = docSnapshot.data();
        const memberIds = accountData.memberIds || accountData.members || [];
        const account: Account = {
          id: docSnapshot.id,
          name: accountData.name,
          type: accountData.type,
          currency: accountData.currency,
          ownerId: accountData.ownerId,
          memberIds,
          inviteCode: accountData.inviteCode || undefined,
          createdAt: accountData.createdAt,
          updatedAt: accountData.updatedAt,
        } as Account;

        // Calcular balance (ya maneja errores internamente y retorna 0)
        const balance = await calculateAccountBalance(docSnapshot.id);

        return {
          ...account,
          balance,
        } as AccountWithBalance;
      } catch (error: any) {
        // Si hay error procesando una cuenta individual, omitirla
        console.warn('Error procesando cuenta:', docSnapshot.id, error);
        return null;
      }
    });

    const accountsWithBalances = await Promise.all(accountPromises);
    
    // Filtrar cuentas nulas (que tuvieron errores)
    const validAccounts = accountsWithBalances.filter((acc): acc is AccountWithBalance => acc !== null);

    // Ordenar por fecha de creación (más recientes primero)
    return validAccounts.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });
  } catch (error: any) {
    // Si hay error de permisos, retornar array vacío en lugar de crashear
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.warn('Permisos insuficientes para obtener cuentas del usuario');
      return [];
    }
    console.error('Error obteniendo cuentas del usuario:', error);
    // Retornar array vacío en lugar de lanzar error
    return [];
  }
}

/**
 * Suscribe en tiempo real a todas las cuentas donde el usuario es miembro.
 * Devuelve una función para desuscribirse.
 *
 * NOTA: La consulta de cuentas es en tiempo real con onSnapshot.
 * El cálculo de balances sigue usando lecturas puntuales de transacciones.
 */
export function subscribeToUserAccounts(
  userId: string,
  callback: (accounts: AccountWithBalance[]) => void
): () => void {
  try {
    const accountsRef = collection(db, 'accounts');
    // La consulta debe usar el mismo campo que las reglas de seguridad (memberIds)
    const q = query(accountsRef, where('memberIds', 'array-contains', userId));

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot: QuerySnapshot<DocumentData>) => {
        try {
          const accountPromises = querySnapshot.docs.map(async (docSnapshot) => {
            try {
              const accountData = docSnapshot.data();
              const memberIds = accountData.memberIds || accountData.members || [];
              const account: Account = {
                id: docSnapshot.id,
                name: accountData.name,
                type: accountData.type,
                currency: accountData.currency,
                ownerId: accountData.ownerId,
                memberIds,
                inviteCode: accountData.inviteCode || undefined,
                createdAt: accountData.createdAt,
                updatedAt: accountData.updatedAt,
              } as Account;

              // Calcular balance (ya maneja errores internamente y retorna 0)
              const balance = await calculateAccountBalance(docSnapshot.id);

              return {
                ...account,
                balance,
              } as AccountWithBalance;
            } catch (error: any) {
              // Si hay error procesando una cuenta individual, omitirla
              console.warn('Error procesando cuenta en snapshot:', docSnapshot.id, error);
              return null;
            }
          });

          const accountsWithBalances = await Promise.all(accountPromises);
          
          // Filtrar cuentas nulas (que tuvieron errores)
          const validAccounts = accountsWithBalances.filter((acc): acc is AccountWithBalance => acc !== null);

          const sorted = validAccounts.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });

          callback(sorted);
        } catch (error: any) {
          // Si hay error general, llamar callback con array vacío
          console.error('Error procesando snapshot de cuentas:', error);
          callback([]);
        }
      },
      (error: any) => {
        // Manejar errores de permisos en el listener
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          console.warn('Permisos insuficientes para escuchar cuentas del usuario');
          callback([]);
        } else {
          console.error('Error en listener de cuentas del usuario:', error);
          callback([]);
        }
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error inicializando listener de cuentas del usuario:', error);
    return () => {};
  }
}

/**
 * Crea una nueva cuenta
 * 
 * @param accountData - Datos de la cuenta a crear
 * @param userId - ID del usuario que crea la cuenta (será el ownerId)
 * @returns La cuenta creada con su ID
 */
export async function createAccount(
  accountData: Omit<CreateAccountInput, 'ownerId' | 'memberIds'>,
  userId: string
): Promise<Account> {
  try {
    const accountsRef = collection(db, 'accounts');

    // Preparar datos de la cuenta
    const newAccount: Omit<Account, 'id'> = {
      name: accountData.name.trim(),
      type: accountData.type,
      currency: accountData.currency,
      ownerId: userId,
      // Campo usado por las reglas de seguridad: request.auth.uid in resource.data.memberIds
      memberIds: [userId],
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    // Si es un grupo, generar inviteCode único
    if (accountData.type === 'GROUP') {
      newAccount.inviteCode = await generateUniqueinviteCode();
    }

    // Agregar documento a Firestore
    const docRef = await addDoc(accountsRef, newAccount);

    // Retornar la cuenta creada
    return {
      id: docRef.id,
      ...newAccount,
    } as Account;
  } catch (error) {
    console.error('Error creando cuenta:', error);
    throw error;
  }
}

/**
 * Busca una cuenta por su inviteCode
 * 
 * @param inviteCode - El código de invitación a buscar
 * @returns La cuenta encontrada o null si no existe
 */
export async function findAccountByinviteCode(inviteCode: string): Promise<Account | null> {
  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('inviteCode', '==', inviteCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnapshot = querySnapshot.docs[0];
    const accountData = docSnapshot.data();
    const memberIds = accountData.memberIds || accountData.members || [];

    return {
      id: docSnapshot.id,
      name: accountData.name,
      type: accountData.type,
      currency: accountData.currency,
      ownerId: accountData.ownerId,
      memberIds,
      inviteCode: accountData.inviteCode || undefined,
      createdAt: accountData.createdAt,
      updatedAt: accountData.updatedAt,
    } as Account;
  } catch (error) {
    console.error('Error buscando cuenta por inviteCode:', error);
    throw error;
  }
}

/**
 * Agrega un usuario a la lista de miembros de una cuenta usando arrayUnion
 * 
 * @param accountId - ID de la cuenta
 * @param userId - ID del usuario a agregar
 * @returns La cuenta actualizada
 */
export async function joinAccount(accountId: string, userId: string): Promise<Account> {
  try {
    const accountRef = doc(db, 'accounts', accountId);
    const accountDoc = await getDoc(accountRef);

    if (!accountDoc.exists()) {
      throw new Error('Cuenta no encontrada');
    }

    // Usar arrayUnion para agregar el usuario a memberIds
    // arrayUnion evita duplicados automáticamente
    await updateDoc(accountRef, {
      memberIds: arrayUnion(userId),
      updatedAt: serverTimestamp(),
    });

    // Retornar la cuenta actualizada
    const updatedAccountData = await getDoc(accountRef);
    return {
      id: updatedAccountData.id,
      ...updatedAccountData.data(),
    } as Account;
  } catch (error) {
    console.error('Error uniéndose a cuenta:', error);
    throw error;
  }
}

/**
 * Une un usuario a una cuenta usando un inviteCode
 * 
 * @param inviteCode - El código de invitación
 * @param userId - ID del usuario que se quiere unir
 * @returns La cuenta a la que se unió el usuario
 */
export async function joinAccountByCode(inviteCode: string, userId: string): Promise<Account> {
  try {
    // Buscar la cuenta por inviteCode
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('inviteCode', '==', inviteCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('Código de invitación no válido');
    }

    const accountDoc = querySnapshot.docs[0];
    const accountData = accountDoc.data();

    // Verificar que sea una cuenta de grupo
    if (accountData.type !== 'GROUP') {
      throw new Error('Este código no pertenece a una cuenta de grupo');
    }

    // Usar arrayUnion para agregar el usuario a memberIds
    await updateDoc(accountDoc.ref, {
      memberIds: arrayUnion(userId),
      updatedAt: serverTimestamp(),
    });

    // Retornar la cuenta actualizada
    const updatedAccountData = await getDoc(accountDoc.ref);
    return {
      id: updatedAccountData.id,
      ...updatedAccountData.data(),
    } as Account;
  } catch (error) {
    console.error('Error uniéndose a cuenta por código:', error);
    throw error;
  }
}
