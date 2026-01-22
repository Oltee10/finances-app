/**
 * Pantalla Modal para editar transacciones
 * 
 * Funcionalidades:
 * - Formulario para editar transacciones existentes
 * - Inputs: Amount, Category, Note, Date, Payment Method
 * - Selector de tipo (Ingreso/Gasto)
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UniversalDatePicker } from '@/components/UniversalDatePicker';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { updateTransaction } from '@/services/transactions';
import type { Currency, TransactionType, PaymentMethod } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
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
// Categorías importantes (se muestran primero)
const EXPENSE_CATEGORIES_IMPORTANT = [
  'category.expense.food',
  'category.expense.gasoline',
  'category.expense.restaurants',
  'category.expense.store',
  'category.expense.travel',
  'category.expense.medicines',
];

// Categorías secundarias (se muestran al hacer clic en "Ver más")
const EXPENSE_CATEGORIES_SECONDARY = [
  'category.expense.mobile',
  'category.expense.education',
  'category.expense.beauty',
  'category.expense.health',
  'category.expense.internet',
  'category.expense.pension',
  'category.expense.entertainment',
  'category.expense.transport',
  'category.expense.other',
];

const CATEGORY_KEYS = {
  INCOME: ['category.income.salary', 'category.income.rent', 'category.income.bonus', 'category.income.sale', 'category.income.investment', 'category.income.other'],
  EXPENSE: [...EXPENSE_CATEGORIES_IMPORTANT, ...EXPENSE_CATEGORIES_SECONDARY],
};

export default function TransactionEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string; transactionId?: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const colors = Colors[theme];

  const accountId = params.accountId;
  const transactionId = params.transactionId;

  const [transactionType, setTransactionType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [amountRaw, setAmountRaw] = useState<number>(0);
  const [category, setCategory] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [showMoreCategories, setShowMoreCategories] = useState<boolean>(false);
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const datePickerLocale = language === 'es' ? 'es-ES' : 'en-US';

  /**
   * Carga la transacción existente
   */
  useEffect(() => {
    const loadTransaction = async () => {
      if (!accountId || !transactionId) {
        Alert.alert(t('common.error'), 'ID de transacción no válido');
        router.back();
        return;
      }

      try {
        setLoadingData(true);
        
        // Cargar información de la cuenta para obtener currency
        const accountRef = doc(db, 'accounts', accountId);
        const accountDoc = await getDoc(accountRef);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          setCurrency(accountData.currency || 'USD');
        }

        // Cargar la transacción
        const transactionRef = doc(db, 'accounts', accountId, 'transactions', transactionId);
        const transactionDoc = await getDoc(transactionRef);
        
        if (!transactionDoc.exists()) {
          Alert.alert(t('common.error'), 'Transacción no encontrada');
          router.back();
          return;
        }

        const transactionData = transactionDoc.data();
        
        // Establecer los valores del formulario
        setTransactionType(transactionData.type);
        setAmountRaw(transactionData.amount);
        setCategory(transactionData.category);
        setPaymentMethod(transactionData.paymentMethod || 'CARD');
        setNote(transactionData.note || '');
        
        // Formatear el monto para mostrar
        const { formatted } = formatCurrencyInput(transactionData.amount.toString(), transactionData.currency || 'USD');
        setAmount(formatted);
        
        // Establecer la fecha
        if (transactionData.date) {
          const date = transactionData.date.toDate();
          setTransactionDate(date);
        }
      } catch (error) {
        console.error('Error cargando transacción:', error);
        Alert.alert(t('common.error'), 'Error al cargar la transacción');
        router.back();
      } finally {
        setLoadingData(false);
      }
    };

    loadTransaction();
  }, [accountId, transactionId]);

  /**
   * Formatea el input de moneda según el tipo de moneda
   */
  const formatCurrencyInput = (value: string, currency: Currency): { formatted: string; raw: number } => {
    if (!value || value.trim().length === 0) {
      return { formatted: '', raw: 0 };
    }

    if (currency === 'COP') {
      const numericValue = value.replace(/[^0-9]/g, '');
      if (!numericValue) {
        return { formatted: '', raw: 0 };
      }
      const integerValue = parseInt(numericValue, 10);
      const formatted = integerValue.toLocaleString('es-CO');
      return { formatted, raw: integerValue };
    } else if (currency === 'EUR' || currency === 'USD') {
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
        const numericValue = value.replace(/[^0-9]/g, '');
        if (!numericValue) {
          return { formatted: '', raw: 0 };
        }
        const integerValue = parseInt(numericValue, 10);
        const formatted = integerValue.toLocaleString('de-DE');
        return { formatted, raw: integerValue };
      }
    }

    return { formatted: value, raw: parseFloat(value) || 0 };
  };

  /**
   * Valida el formulario
   */
  const validateForm = (): boolean => {
    if (!amount || amountRaw <= 0) {
      setError(t('transaction.add.validation.amount.required'));
      return false;
    }

    if (!category || category.trim().length === 0) {
      setError(t('transaction.add.validation.category.required'));
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Maneja la actualización de la transacción
   */
  const handleUpdateTransaction = async (): Promise<void> => {
    if (!user) {
      Alert.alert(t('common.error'), t('transaction.add.error.not.authenticated'));
      return;
    }

    if (!accountId || !transactionId) {
      Alert.alert(t('common.error'), 'ID de transacción no válido');
      router.back();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convertir la fecha a Timestamp de Firestore
      const dateTimestamp = Timestamp.fromDate(transactionDate);

      await updateTransaction(
        accountId,
        transactionId,
        {
          type: transactionType,
          amount: amountRaw,
          category: category.trim(),
          paymentMethod,
          note: note.trim() || undefined,
          date: dateTimestamp,
        }
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

  // Determinar qué categorías mostrar según el tipo
  const getCategoryKeys = () => {
    if (transactionType === 'INCOME') {
      return CATEGORY_KEYS.INCOME;
    } else {
      if (showMoreCategories) {
        return CATEGORY_KEYS.EXPENSE;
      } else {
        return EXPENSE_CATEGORIES_IMPORTANT;
      }
    }
  };

  const categoryKeys = getCategoryKeys();
  const categories = categoryKeys.map((key: string) => t(key));
  const typeColor = transactionType === 'INCOME' ? colors.success : colors.error;

  if (loadingData) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>Cargando transacción...</ThemedText>
        </View>
      </ThemedView>
    );
  }

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
                {t('transaction.edit')}
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

            {/* Selector de Fecha */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transaction.add.date')}</ThemedText>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: colors.icon }]}
                onPress={() => setShowDatePicker(!showDatePicker)}
                activeOpacity={0.7}>
                <ThemedText style={[styles.dateButtonText, { color: colors.text }]}>
                  {transactionDate.toLocaleDateString(datePickerLocale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </ThemedText>
              </TouchableOpacity>
              {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <UniversalDatePicker
                    value={transactionDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    locale={datePickerLocale}
                    textColor={theme === 'dark' ? '#FFFFFF' : '#000000'}
                    themeVariant={theme === 'dark' ? 'dark' : 'light'}
                    onChange={(selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                      }
                      setTransactionDate(selectedDate);
                    }}
                    maximumDate={new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={[styles.datePickerButton, { backgroundColor: colors.tint }]}
                      onPress={() => setShowDatePicker(false)}>
                      <ThemedText style={[styles.datePickerButtonText, { color: '#FFFFFF' }]}>
                        {t('common.confirm')}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Selector de Método de Pago */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transaction.add.payment.method')}</ThemedText>
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
                    💵 {t('transaction.add.payment.cash')}
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
                    💳 {t('transaction.add.payment.card')}
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
              {/* Botón "Ver más" / "Ver menos" para categorías de gasto */}
              {transactionType === 'EXPENSE' && (
                <TouchableOpacity
                  style={[styles.viewMoreButton, { borderColor: colors.icon }]}
                  onPress={() => {
                    setShowMoreCategories(!showMoreCategories);
                    setError(null);
                  }}
                  disabled={loading}>
                  <ThemedText style={[styles.viewMoreButtonText, { color: colors.tint }]}>
                    {showMoreCategories ? t('category.view.less') : t('category.view.more')}
                  </ThemedText>
                </TouchableOpacity>
              )}
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

            {/* Botón Guardar */}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: typeColor },
                (!amount || !category || loading) && styles.buttonDisabled,
              ]}
              onPress={handleUpdateTransaction}
              disabled={!amount || !category || loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  {t('transaction.edit.save')}
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Botón Cancelar */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}>
              <ThemedText style={[styles.cancelButtonText, { color: colors.icon }]}>
                {t('transaction.edit.cancel')}
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
    paddingBottom: 120,
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
  viewMoreButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  viewMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateButton: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dateButtonText: {
    fontSize: 16,
  },
  datePickerContainer: {
    marginTop: 12,
    alignSelf: 'flex-start',
    width: '100%',
  },
  datePickerButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
});
