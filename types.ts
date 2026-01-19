/**
 * TypeScript interfaces y tipos para la aplicación de finanzas
 * Modelo de datos para Firestore
 */

/**
 * Tipo de cuenta - Individual o Grupo
 */
export type AccountType = 'INDIVIDUAL' | 'GROUP';

/**
 * Monedas soportadas
 */
export type Currency = 'EUR' | 'USD' | 'COP';

/**
 * Tipo de transacción
 */
export type TransactionType = 'INCOME' | 'EXPENSE';

/**
 * Usuario
 * Colección: users
 */
export interface User {
  /** ID del usuario (coincide con auth.uid en Firebase) */
  id: string;
  /** Nombre de usuario (único, usado para autenticación) */
  username: string;
  /** Fecha de creación del usuario (timestamp de Firestore) */
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * Cuenta / Cartera
 * Colección: accounts
 * 
 * Nota: El campo 'balance' es calculado y no se almacena directamente.
 * Se calcula sumando todas las transacciones asociadas.
 */
export interface Account {
  /** ID único de la cuenta */
  id: string;
  /** Nombre de la cuenta */
  name: string;
  /** Tipo de cuenta: Individual o Grupo */
  type: AccountType;
  /** Moneda de la cuenta */
  currency: Currency;
  /** ID del propietario (user.id) - siempre es el creador */
  ownerId: string;
  /** Array de IDs de usuarios que son miembros de la cuenta */
  memberIds: string[];
  /** 
   * Código único de 6 caracteres para unirse a cuentas de grupo
   * Solo presente si type === 'GROUP'
   * Formato: alfanumérico (ej: "A1B2C3")
   */
  joinCode?: string;
  /** Fecha de creación de la cuenta */
  createdAt: FirebaseFirestore.Timestamp;
  /** Fecha de última actualización */
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Transacción
 * Colección: transactions
 */
export interface Transaction {
  /** ID único de la transacción */
  id: string;
  /** ID de la cuenta asociada */
  accountId: string;
  /** ID del usuario que realizó la transacción */
  userId: string;
  /** Tipo de transacción: Ingreso o Gasto */
  type: TransactionType;
  /** Monto de la transacción (siempre positivo) */
  amount: number;
  /** Categoría de la transacción (ej: "Comida", "Transporte", "Salario") */
  category: string;
  /** Fecha de la transacción (timestamp de Firestore) */
  date: FirebaseFirestore.Timestamp;
  /** Nota opcional sobre la transacción */
  note?: string;
  /** Fecha de creación de la transacción */
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * Tipos de ayuda para crear documentos (sin id y timestamps)
 */
export type CreateUserInput = Omit<User, 'id' | 'createdAt'>;

export type CreateAccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;

export type CreateTransactionInput = Omit<Transaction, 'id' | 'createdAt'>;

/**
 * Tipo para representar el balance calculado de una cuenta
 * Útil para queries y visualizaciones
 */
export interface AccountWithBalance extends Account {
  /** Balance calculado sumando todas las transacciones */
  balance: number;
}
