/**
 * Servicio para gestionar cuentas en Firestore
 * 
 * Funcionalidades:
 * - Obtener todas las cuentas donde el usuario es miembro
 * - Crear nueva cuenta (Individual o Group)
 * - Unirse a cuenta de grupo usando joinCode
 * - Calcular balance de cuenta desde transacciones
 * - Generar joinCode único para cuentas de grupo
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Account, AccountWithBalance, CreateAccountInput, Currency, AccountType } from '@/types';

/**
 * Genera un código de unión aleatorio de 6 caracteres alfanuméricos
 * 
 * @returns Código único de 6 caracteres (ej: "A1B2C3")
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Verifica si un joinCode ya existe en Firestore
 * 
 * @param joinCode - El código a verificar
 * @returns true si el código existe, false si no
 */
async function joinCodeExists(joinCode: string): Promise<boolean> {
  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('joinCode', '==', joinCode));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error verificando joinCode:', error);
    return false;
  }
}

/**
 * Genera un joinCode único (verifica que no exista)
 * 
 * @returns Código único de 6 caracteres
 */
async function generateUniqueJoinCode(): Promise<string> {
  let code = generateJoinCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (await joinCodeExists(code) && attempts < maxAttempts) {
    code = generateJoinCode();
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
  } catch (error) {
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
    const q = query(accountsRef, where('memberIds', 'array-contains', userId));
    const querySnapshot = await getDocs(q);

    const accounts: AccountWithBalance[] = [];

    // Obtener cuentas y calcular balances en paralelo
    const accountPromises = querySnapshot.docs.map(async (docSnapshot) => {
      const accountData = docSnapshot.data();
      const account: Account = {
        id: docSnapshot.id,
        name: accountData.name,
        type: accountData.type,
        currency: accountData.currency,
        ownerId: accountData.ownerId,
        memberIds: accountData.memberIds,
        joinCode: accountData.joinCode || undefined,
        createdAt: accountData.createdAt,
        updatedAt: accountData.updatedAt,
      } as Account;

      // Calcular balance
      const balance = await calculateAccountBalance(docSnapshot.id);

      return {
        ...account,
        balance,
      } as AccountWithBalance;
    });

    const accountsWithBalances = await Promise.all(accountPromises);

    // Ordenar por fecha de creación (más recientes primero)
    return accountsWithBalances.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error obteniendo cuentas del usuario:', error);
    throw error;
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
    const q = query(accountsRef, where('memberIds', 'array-contains', userId));

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot: QuerySnapshot<DocumentData>) => {
        try {
          const accountPromises = querySnapshot.docs.map(async (docSnapshot) => {
            const accountData = docSnapshot.data();
            const account: Account = {
              id: docSnapshot.id,
              name: accountData.name,
              type: accountData.type,
              currency: accountData.currency,
              ownerId: accountData.ownerId,
              memberIds: accountData.memberIds,
              joinCode: accountData.joinCode || undefined,
              createdAt: accountData.createdAt,
              updatedAt: accountData.updatedAt,
            } as Account;

            const balance = await calculateAccountBalance(docSnapshot.id);

            return {
              ...account,
              balance,
            } as AccountWithBalance;
          });

          const accountsWithBalances = await Promise.all(accountPromises);

          const sorted = accountsWithBalances.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });

          callback(sorted);
        } catch (error) {
          console.error('Error procesando snapshot de cuentas:', error);
        }
      },
      (error) => {
        console.error('Error en listener de cuentas del usuario:', error);
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
      memberIds: [userId], // El creador es siempre miembro
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    // Si es un grupo, generar joinCode único
    if (accountData.type === 'GROUP') {
      newAccount.joinCode = await generateUniqueJoinCode();
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
 * Busca una cuenta por su joinCode
 * 
 * @param joinCode - El código de unión a buscar
 * @returns La cuenta encontrada o null si no existe
 */
export async function findAccountByJoinCode(joinCode: string): Promise<Account | null> {
  try {
    const accountsRef = collection(db, 'accounts');
    const q = query(accountsRef, where('joinCode', '==', joinCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnapshot = querySnapshot.docs[0];
    const accountData = docSnapshot.data();

    return {
      id: docSnapshot.id,
      name: accountData.name,
      type: accountData.type,
      currency: accountData.currency,
      ownerId: accountData.ownerId,
      memberIds: accountData.memberIds,
      joinCode: accountData.joinCode || undefined,
      createdAt: accountData.createdAt,
      updatedAt: accountData.updatedAt,
    } as Account;
  } catch (error) {
    console.error('Error buscando cuenta por joinCode:', error);
    throw error;
  }
}

/**
 * Agrega un usuario a la lista de miembros de una cuenta
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

    const accountData = accountDoc.data();
    const memberIds = accountData.memberIds || [];

    // Verificar que el usuario no sea ya miembro
    if (memberIds.includes(userId)) {
      throw new Error('El usuario ya es miembro de esta cuenta');
    }

    // Agregar el usuario a memberIds
    const updatedMemberIds = [...memberIds, userId];

    // Actualizar el documento
    await updateDoc(accountRef, {
      memberIds: updatedMemberIds,
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
 * Une un usuario a una cuenta usando un joinCode
 * 
 * @param joinCode - El código de unión
 * @param userId - ID del usuario que se quiere unir
 * @returns La cuenta a la que se unió el usuario
 */
export async function joinAccountByCode(joinCode: string, userId: string): Promise<Account> {
  try {
    // Buscar la cuenta por joinCode
    const account = await findAccountByJoinCode(joinCode);

    if (!account) {
      throw new Error('Código de unión no válido');
    }

    if (account.type !== 'GROUP') {
      throw new Error('Este código no pertenece a una cuenta de grupo');
    }

    // Unir al usuario a la cuenta
    return await joinAccount(account.id, userId);
  } catch (error) {
    console.error('Error uniéndose a cuenta por código:', error);
    throw error;
  }
}
