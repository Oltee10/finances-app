/**
 * Servicio para gestionar transacciones en Firestore
 * 
 * Funcionalidades:
 * - Crear transacciones (INCOME/EXPENSE)
 * - Obtener transacciones de una cuenta
 * - Listener en tiempo real (onSnapshot)
 * - Calcular balance total desde transacciones
 * - Obtener datos para gráficos (balance histórico)
 * 
 * IMPORTANTE: Las transacciones ahora se almacenan como subcolección:
 * accounts/{accountId}/transactions/{transactionId}
 * 
 * NOTA: Después de migrar, elimina la colección raíz 'transactions' en Firebase Console,
 * ya que el app ya no la utilizará.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Transaction, CreateTransactionInput, TransactionType } from '@/types';

/**
 * Crea una nueva transacción
 * 
 * @param transactionData - Datos de la transacción a crear
 * @param userId - ID del usuario que crea la transacción
 * @returns La transacción creada con su ID
 */
export async function createTransaction(
  transactionData: Omit<CreateTransactionInput, 'userId'>,
  userId: string
): Promise<Transaction> {
  try {
    // Usar subcolección: accounts/{accountId}/transactions
    const transactionsRef = collection(db, 'accounts', transactionData.accountId, 'transactions');

    // Preparar datos de la transacción
    // Nota: Firestore no acepta valores undefined, así que omitimos el campo 'note' si está vacío
    const newTransaction: any = {
      accountId: transactionData.accountId,
      userId,
      type: transactionData.type,
      amount: Math.abs(transactionData.amount), // Asegurar que siempre sea positivo
      category: transactionData.category.trim(),
      paymentMethod: transactionData.paymentMethod || 'CARD', // Default a CARD si no se especifica
      date: transactionData.date || serverTimestamp(),
      createdAt: serverTimestamp() as any,
    };

    // Solo incluir 'note' si tiene un valor válido (no vacío, no undefined)
    const trimmedNote = transactionData.note?.trim();
    if (trimmedNote && trimmedNote.length > 0) {
      newTransaction.note = trimmedNote;
    }

    // Agregar documento a Firestore
    const docRef = await addDoc(transactionsRef, newTransaction);

    // Actualizar el documento padre de la cuenta para disparar el listener
    const accountRef = doc(db, 'accounts', transactionData.accountId);
    await updateDoc(accountRef, { updatedAt: serverTimestamp() });

    // Retornar la transacción creada
    return {
      id: docRef.id,
      ...newTransaction,
    } as Transaction;
  } catch (error) {
    console.error('Error creando transacción:', error);
    throw error;
  }
}

/**
 * Obtiene todas las transacciones de una cuenta
 * 
 * @param accountId - ID de la cuenta
 * @param limitCount - Límite de transacciones a obtener (por defecto 50)
 * @returns Array de transacciones ordenadas por fecha (más recientes primero)
 */
export async function getAccountTransactions(
  accountId: string,
  limitCount: number = 50
): Promise<Transaction[]> {
  try {
    // Usar subcolección: accounts/{accountId}/transactions
    const transactionsRef = collection(db, 'accounts', accountId, 'transactions');
    const q = query(
      transactionsRef,
      orderBy('date', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        accountId: data.accountId || accountId, // accountId puede venir del data o del path
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        paymentMethod: data.paymentMethod || 'CARD', // Default a CARD para transacciones antiguas
        date: data.date,
        note: data.note || undefined,
        createdAt: data.createdAt,
      } as Transaction;
    });
  } catch (error: any) {
    // Manejar errores de permisos
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.warn('Permisos insuficientes para obtener transacciones de cuenta:', accountId);
      return [];
    }
    console.error('Error obteniendo transacciones:', error);
    // Retornar array vacío en lugar de lanzar error
    return [];
  }
}

/**
 * Calcula el balance total de una cuenta sumando todas sus transacciones
 * 
 * @param transactions - Array de transacciones de la cuenta
 * @returns Balance calculado (positivo para INCOME, negativo para EXPENSE)
 */
export function calculateBalance(transactions: Transaction[]): number {
  return transactions.reduce((balance, transaction) => {
    if (transaction.type === 'INCOME') {
      return balance + transaction.amount;
    } else if (transaction.type === 'EXPENSE') {
      return balance - transaction.amount;
    }
    return balance;
  }, 0);
}

/**
 * Obtiene transacciones con listener en tiempo real
 * 
 * @param accountId - ID de la cuenta
 * @param callback - Función que se ejecuta cuando cambian las transacciones
 * @param limitCount - Límite de transacciones a obtener (por defecto 50)
 * @returns Función para desuscribirse del listener
 */
export function subscribeToAccountTransactions(
  accountId: string,
  callback: (transactions: Transaction[]) => void,
  limitCount: number = 50
): Unsubscribe {
  // Usar subcolección: accounts/{accountId}/transactions
  const transactionsRef = collection(db, 'accounts', accountId, 'transactions');
  
  // Query sin orderBy para evitar necesidad de índice compuesto
  // Ordenaremos en el cliente
  const q = query(transactionsRef);

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      let transactions: Transaction[] = querySnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          accountId: data.accountId || accountId, // accountId puede venir del data o del path
          userId: data.userId,
          type: data.type,
          amount: data.amount,
          category: data.category,
          paymentMethod: data.paymentMethod || 'CARD', // Default a CARD para transacciones antiguas
          date: data.date,
          note: data.note || undefined,
          createdAt: data.createdAt,
        } as Transaction;
      });

      // Ordenar por fecha descendente en el cliente
      transactions.sort((a, b) => {
        const aDate = a.date?.toMillis() || 0;
        const bDate = b.date?.toMillis() || 0;
        return bDate - aDate;
      });

      // Limitar resultados
      transactions = transactions.slice(0, limitCount);

      callback(transactions);
    },
    (error: any) => {
      // Manejar errores de permisos
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.warn('Permisos insuficientes para escuchar transacciones de cuenta:', accountId);
        callback([]);
      } else {
        console.error('Error en listener de transacciones:', error);
        callback([]);
      }
    }
  );

  return unsubscribe;
}

/**
 * Elimina una transacción
 * 
 * @param accountId - ID de la cuenta
 * @param transactionId - ID de la transacción a eliminar
 */
export async function deleteTransaction(
  accountId: string,
  transactionId: string
): Promise<void> {
  try {
    // Usar subcolección: accounts/{accountId}/transactions/{transactionId}
    const transactionRef = doc(db, 'accounts', accountId, 'transactions', transactionId);
    await deleteDoc(transactionRef);

    // Actualizar el documento padre de la cuenta para disparar el listener
    const accountRef = doc(db, 'accounts', accountId);
    await updateDoc(accountRef, { updatedAt: serverTimestamp() });
  } catch (error) {
    console.error('Error eliminando transacción:', error);
    throw error;
  }
}
