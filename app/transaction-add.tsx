/**
 * Pantalla Modal para agregar transacciones
 * 
 * Funcionalidades:
 * - Formulario para agregar INCOME o EXPENSE
 * - Inputs: Amount, Category, Note
 * - Selector de tipo (Ingreso/Gasto)
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createTransaction } from '@/services/transactions';
import type { Currency, TransactionType, PaymentMethod } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Categorías - se traducirán usando el contexto de idioma
const CATEGORY_KEYS = {
  INCOME: ['category.income.salary', 'category.income.rent', 'category.income.bonus', 'category.income.sale', 'category.income.investment', 'category.income.other'],
  EXPENSE: ['category.expense.food', 'category.expense.transport', 'category.expense.entertainment', 'category.expense.health', 'category.expense.education', 'category.expense.other'],
};

export default function TransactionAddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const colors = Colors[theme];

  const accountId = params.accountId;

  const [transactionType, setTransactionType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [amountRaw, setAmountRaw] = useState<number>(0); // Valor numérico real para la BD
  const [category, setCategory] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('USD');

  /**
   * Carga la información de la cuenta para obtener el currency
   */
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) return;

      try {
        const accountRef = doc(db, 'accounts', accountId);
        const accountDoc = await getDoc(accountRef);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          setCurrency(accountData.currency || 'USD');
        }
      } catch (error) {
        console.error('Error cargando cuenta:', error);
      }
    };

    loadAccount();
  }, [accountId]);

  /**
   * Formatea el input de moneda según el tipo de moneda
   * COP: solo enteros con puntos como separadores de miles (1.000)
   * EUR: decimales con coma, puntos para miles (1.200,50)
   * USD: decimales con punto, comas para miles (1,200.50)
   */
  const formatCurrencyInput = (value: string, currency: Currency): { formatted: string; raw: number } => {
    if (!value || value.trim().length === 0) {
      return { formatted: '', raw: 0 };
    }

    if (currency === 'COP') {
      // COP: solo enteros con puntos como separadores de miles
      // Extraer solo números
      const numericValue = value.replace(/[^0-9]/g, '');
      if (!numericValue) {
        return { formatted: '', raw: 0 };
      }
      const integerValue = parseInt(numericValue, 10);
      const formatted = integerValue.toLocaleString('es-CO');
      return { formatted, raw: integerValue };
    } else if (currency === 'EUR' || currency === 'USD') {
      // EUR: decimales con coma, puntos para miles (1.200,50)
      const hasComma = value.includes(',');
      
      if (hasComma) {
        const parts = value.split(',');
        const integerPart = parts[0].replace(/[^0-9]/g, '');
        const decimalPart = parts[1]?.replace(/[^0-9]/g, '').slice(0, 2) || '';
        
        const integerValue = integerPart ? parseInt(integerPart, 10) : 0;
        const decimalValue = decimalPart ? parseInt(decimalPart, 10) / Math.pow(10, decimalPart.length) : 0;
        
        const formattedInteger = integerValue.toLocaleString('de-DE');
        const formatted = decimalPart ? `${formattedInteger},${decimalPart}` : `${formattedInteger},`;
        const raw = integerValue + decimalValue;
        
        return { formatted, raw };
      } else {
        // Solo enteros
        const numericValue = value.replace(/[^0-9]/g, '');
        if (!numericValue) {
          return { formatted: '', raw: 0 };
        }
        const integerValue = parseInt(numericValue, 10);
        const formatted = integerValue.toLocaleString('de-DE');
        return { formatted, raw: integerValue };
      }
    } else {
      // USD: decimales con punto, comas para miles (1,200.50)
      const hasDot = value.includes('.');
      
      if (hasDot) {
        const parts = value.split('.');
        const integerPart = parts[0].replace(/[^0-9]/g, '');
        const decimalPart = parts[1]?.replace(/[^0-9]/g, '').slice(0, 2) || '';
        
        const integerValue = integerPart ? parseInt(integerPart, 10) : 0;
        const decimalValue = decimalPart ? parseInt(decimalPart, 10) / Math.pow(10, decimalPart.length) : 0;
        
        const formattedInteger = integerValue.toLocaleString('en-US');
        const formatted = decimalPart ? `${formattedInteger}.${decimalPart}` : `${formattedInteger}.`;
        const raw = integerValue + decimalValue;
        
        return { formatted, raw };
      } else {
        // Solo enteros
        const numericValue = value.replace(/[^0-9]/g, '');
        if (!numericValue) {
          return { formatted: '', raw: 0 };
        }
        const integerValue = parseInt(numericValue, 10);
        const formatted = integerValue.toLocaleString('en-US');
        return { formatted, raw: integerValue };
      }
    }
  };

  /**
   * Limpia el formulario
   */
  const resetForm = (): void => {
    setAmount('');
    setAmountRaw(0);
    setCategory('');
    setNote('');
    setPaymentMethod('CARD');
    setError(null);
  };

  /**
   * Valida el formulario
   */
  const validateForm = (): boolean => {
    if (amountRaw <= 0) {
      setError('El monto debe ser un número positivo');
      return false;
    }

    if (!category || category.trim().length === 0) {
      setError('La categoría es requerida');
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Maneja la creación de la transacción
   */
  const handleCreateTransaction = async (): Promise<void> => {
    if (!user) {
      Alert.alert('Error', 'No estás autenticado');
      return;
    }

    if (!accountId) {
      Alert.alert('Error', 'ID de cuenta no proporcionado');
      router.back();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createTransaction(
        {
          accountId,
          type: transactionType,
          amount: amountRaw,
          category: category.trim(),
          paymentMethod,
          note: note.trim() || undefined,
          date: serverTimestamp(),
        },
        user.id
      );

      // Éxito: cerrar modal y refrescar lista
      router.back();
    } catch (error: any) {
      const errorMessage = error.message || t('transaction.add.error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja el cambio de tipo de transacción
   */
  const handleTypeChange = (type: TransactionType): void => {
    setTransactionType(type);
    setCategory(''); // Limpiar categoría al cambiar tipo
    setError(null);
  };

  const categoryKeys = transactionType === 'INCOME' ? CATEGORY_KEYS.INCOME : CATEGORY_KEYS.EXPENSE;
  const categories = categoryKeys.map((key: string) => t(key));
  const typeColor = transactionType === 'INCOME' ? colors.success : colors.error;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                {t('transaction.add.title')}
              </ThemedText>
            </View>

            {/* Selector de Tipo */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transaction.add.type')}</ThemedText>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === 'INCOME' && {
                      backgroundColor: colors.success,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => handleTypeChange('INCOME')}
                  disabled={loading}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      transactionType === 'INCOME' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    {t('transaction.add.type.income')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === 'EXPENSE' && {
                      backgroundColor: colors.error,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => handleTypeChange('EXPENSE')}
                  disabled={loading}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      transactionType === 'EXPENSE' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    {t('transaction.add.type.expense')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Input Monto */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transaction.add.amount')}</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.amountInput,
                  { color: colors.text, borderColor: colors.icon },
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.icon}
                value={amount}
                onChangeText={(text) => {
                  const { formatted, raw } = formatCurrencyInput(text, currency);
                  setAmount(formatted);
                  setAmountRaw(raw);
                  setError(null);
                }}
                keyboardType={currency === 'COP' ? 'number-pad' : 'decimal-pad'}
                editable={!loading}
              />
            </View>

            {/* Selector de Método de Pago */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Método de Pago</ThemedText>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    paymentMethod === 'CASH' && {
                      backgroundColor: colors.tint,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => {
                    setPaymentMethod('CASH');
                    setError(null);
                  }}
                  disabled={loading}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      paymentMethod === 'CASH' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    💵 Efectivo
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    paymentMethod === 'CARD' && {
                      backgroundColor: colors.tint,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => {
                    setPaymentMethod('CARD');
                    setError(null);
                  }}
                  disabled={loading}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      paymentMethod === 'CARD' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    💳 Tarjeta
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selector de Categoría */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transaction.add.category')}</ThemedText>
              <View style={styles.categorySelector}>
                {categoryKeys.map((key: string, index: number) => {
                  const cat = categories[index];
                  const categoryKey = key;
                  return (
                    <TouchableOpacity
                      key={categoryKey}
                      style={[
                        styles.categoryButton,
                        category === cat && {
                          backgroundColor: typeColor,
                        },
                        { borderColor: colors.icon },
                      ]}
                      onPress={() => {
                        setCategory(cat);
                        setError(null);
                      }}
                      disabled={loading}>
                      <ThemedText
                        style={[
                          styles.categoryButtonText,
                          category === cat && [styles.categoryButtonTextActive, { color: '#FFFFFF' }],
                        ]}>
                        {cat}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Input Nota (Opcional) */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transaction.add.note')}</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.noteInput,
                  { color: colors.text, borderColor: colors.icon },
                ]}
                placeholder={t('transaction.add.note.placeholder')}
                placeholderTextColor={colors.icon}
                value={note}
                onChangeText={(text) => {
                  setNote(text);
                  setError(null);
                }}
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>

            {/* Error */}
            {error && <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>}

            {/* Botón Crear */}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: typeColor },
                (!amount || !category || loading) && styles.buttonDisabled,
              ]}
              onPress={handleCreateTransaction}
              disabled={!amount || !category || loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  {transactionType === 'INCOME' ? t('transaction.add.create.income') : t('transaction.add.create.expense')}
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Botón Cancelar */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}>
              <ThemedText style={[styles.cancelButtonText, { color: colors.icon }]}>
                {t('transaction.add.cancel')}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
  },
  inputContainer: {
    gap: 12,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.5,
  },
  typeButtonTextActive: {
    // color handled inline
    opacity: 1,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  amountInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    textAlign: 'center',
  },
  categoryButtonTextActive: {
    // color handled inline
    opacity: 1,
  },
  noteInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
});
