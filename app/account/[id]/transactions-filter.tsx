/**
 * Pantalla Modal para filtrar transacciones
 * 
 * Ruta: /account/[id]/transactions-filter
 * 
 * Funcionalidades:
 * - Filtros por tipo, categoría, usuario, monto
 * - Aplicar filtros y volver a la lista
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UniversalDatePicker } from '@/components/UniversalDatePicker';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { subscribeToAccountTransactions } from '@/services/transactions';
import type { Account, Transaction } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function TransactionsFilterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const colors = Colors[theme];
  
  // Configurar locale para el date picker
  const datePickerLocale = language === 'es' ? 'es-ES' : 'en-US';

  const accountId = params.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});

  // Filtros - estos se pasarán de vuelta a la pantalla anterior
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterUserId, setFilterUserId] = useState<string>('ALL');
  const [filterMinAmount, setFilterMinAmount] = useState<number | null>(null);
  const [filterMaxAmount, setFilterMaxAmount] = useState<number | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<'ALL' | 'CASH' | 'CARD'>('ALL');
  const [showStartDatePicker, setShowStartDatePicker] = useState<boolean>(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState<boolean>(false);

  /**
   * Carga los filtros guardados al montar
   */
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const filtersJson = await AsyncStorage.getItem(`filters_${accountId}`);
        if (filtersJson) {
          const filters = JSON.parse(filtersJson);
          setFilterType(filters.filterType || 'ALL');
          setFilterCategory(filters.filterCategory || 'ALL');
          setFilterUserId(filters.filterUserId || 'ALL');
          setFilterMinAmount(filters.filterMinAmount ?? null);
          setFilterMaxAmount(filters.filterMaxAmount ?? null);
          setFilterStartDate(filters.filterStartDate ? new Date(filters.filterStartDate) : null);
          setFilterEndDate(filters.filterEndDate ? new Date(filters.filterEndDate) : null);
          setFilterPaymentMethod(filters.filterPaymentMethod || 'ALL');
        }
      } catch (error) {
        console.error('Error cargando filtros:', error);
      }
    };

    if (accountId) {
      loadFilters();
    }
  }, [accountId]);

  /**
   * Carga los datos de la cuenta
   */
  useEffect(() => {
    if (!accountId) {
      router.back();
      return;
    }

    const accountRef = doc(db, 'accounts', accountId);
    const unsubscribe = onSnapshot(
      accountRef,
      (accountDoc) => {
        if (!accountDoc.exists()) {
          router.back();
          return;
        }

        const accountData = accountDoc.data();
        const loadedAccount: Account = {
          id: accountDoc.id,
          name: accountData.name,
          type: accountData.type,
          currency: accountData.currency,
          ownerId: accountData.ownerId,
          memberIds: accountData.memberIds,
          inviteCode: accountData.inviteCode || undefined,
          createdAt: accountData.createdAt,
          updatedAt: accountData.updatedAt,
        } as Account;

        setAccount(loadedAccount);
        setLoading(false);
      },
      (error) => {
        console.error('Error cargando cuenta:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [accountId, router]);

  /**
   * Listener en tiempo real para transacciones (para obtener categorías y usuarios únicos)
   */
  useEffect(() => {
    if (!accountId) return;

    const unsubscribe = subscribeToAccountTransactions(accountId, (newTransactions) => {
      setTransactions(newTransactions);
    }, 1000);

    return () => unsubscribe();
  }, [accountId]);

  /**
   * Obtiene las categorías únicas de las transacciones
   */
  const getUniqueCategories = (): string[] => {
    const categories = new Set<string>();
    transactions.forEach((t) => categories.add(t.category));
    return Array.from(categories).sort();
  };

  /**
   * Obtiene los usuarios únicos de las transacciones
   */
  const getUniqueUserIds = (): string[] => {
    const userIds = new Set<string>();
    transactions.forEach((t) => userIds.add(t.userId));
    return Array.from(userIds);
  };

  /**
   * Carga los nombres de usuario para los userIds únicos
   */
  useEffect(() => {
    const loadUserNames = async () => {
      const userIds = getUniqueUserIds();
      if (userIds.length === 0) return;

      const namesMap: Record<string, string> = {};

      // Cargar el username para cada userId
      const promises = userIds.map(async (userId) => {
        try {
          // Intentar primero en users/userId
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // El username está en el campo 'username' del documento
            if (userData.username && typeof userData.username === 'string') {
              namesMap[userId] = userData.username;
              return;
            }
          }

          // Si no existe en users, intentar en accounts/userId (por si acaso)
          const accountDoc = await getDoc(doc(db, 'accounts', userId));
          if (accountDoc.exists()) {
            const accountData = accountDoc.data();
            if (accountData.username && typeof accountData.username === 'string') {
              namesMap[userId] = accountData.username;
              return;
            }
          }
        } catch (error) {
          console.error(`Error cargando usuario ${userId}:`, error);
        }
      });

      await Promise.all(promises);
      // Actualizar el mapa con los nuevos valores
      setUserNamesMap(prev => {
        const updated = { ...prev };
        Object.keys(namesMap).forEach(key => {
          if (namesMap[key]) {
            updated[key] = namesMap[key];
          }
        });
        return updated;
      });
    };

    if (transactions.length > 0) {
      loadUserNames();
    }
  }, [transactions]);

  /**
   * Aplica los filtros y vuelve a la pantalla anterior
   */
  const handleApplyFilters = async () => {
    try {
      // Guardar filtros en AsyncStorage
      const filters = {
        filterType,
        filterCategory,
        filterUserId,
        filterMinAmount,
        filterMaxAmount,
        filterStartDate: filterStartDate?.toISOString() || null,
        filterEndDate: filterEndDate?.toISOString() || null,
        filterPaymentMethod,
        sortOrder: 'newest', // Mantener el orden por defecto
      };
      await AsyncStorage.setItem(`filters_${accountId}`, JSON.stringify(filters));
      router.back();
    } catch (error) {
      console.error('Error guardando filtros:', error);
      router.back();
    }
  };

  /**
   * Resetea los filtros
   */
  const handleResetFilters = () => {
    setFilterType('ALL');
    setFilterCategory('ALL');
    setFilterUserId('ALL');
    setFilterMinAmount(null);
    setFilterMaxAmount(null);
    setFilterStartDate(null);
    setFilterEndDate(null);
    setFilterPaymentMethod('ALL');
  };

  if (loading || !account) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>{t('transactions.filter.loading')}</ThemedText>
      </ThemedView>
    );
  }

  const typeColor = filterType === 'INCOME' ? colors.success : filterType === 'EXPENSE' ? colors.error : colors.tint;

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
                {t('transactions.filter.title.screen')}
              </ThemedText>
            </View>

            {/* Filtro por Tipo */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transactions.filter.type')}</ThemedText>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    filterType === 'ALL' && {
                      backgroundColor: colors.tint,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => setFilterType('ALL')}
                  activeOpacity={0.7}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      filterType === 'ALL' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    {t('transactions.filter.type.all')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    filterType === 'INCOME' && {
                      backgroundColor: colors.success,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => setFilterType('INCOME')}
                  activeOpacity={0.7}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      filterType === 'INCOME' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    {t('transactions.filter.type.income')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    filterType === 'EXPENSE' && {
                      backgroundColor: colors.error,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => setFilterType('EXPENSE')}
                  activeOpacity={0.7}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      filterType === 'EXPENSE' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    {t('transactions.filter.type.expense')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Filtro por Categoría */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transactions.filter.category')}</ThemedText>
              <View style={styles.categorySelector}>
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    filterCategory === 'ALL' && {
                      backgroundColor: typeColor,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => setFilterCategory('ALL')}
                  activeOpacity={0.7}>
                  <ThemedText
                    style={[
                      styles.categoryButtonText,
                      filterCategory === 'ALL' && [styles.categoryButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    {t('transactions.filter.type.all')}
                  </ThemedText>
                </TouchableOpacity>
                {getUniqueCategories().map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      filterCategory === cat && {
                        backgroundColor: typeColor,
                      },
                      { borderColor: colors.icon },
                    ]}
                    onPress={() => setFilterCategory(cat)}
                    activeOpacity={0.7}>
                    <ThemedText
                      style={[
                        styles.categoryButtonText,
                        filterCategory === cat && [styles.categoryButtonTextActive, { color: '#FFFFFF' }],
                      ]}>
                      {cat}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Filtro por Usuario (solo para cuentas GROUP) */}
            {account?.type === 'GROUP' && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.label}>{t('transactions.filter.user')}</ThemedText>
                <View style={styles.categorySelector}>
                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      filterUserId === 'ALL' && {
                        backgroundColor: typeColor,
                      },
                      { borderColor: colors.icon },
                    ]}
                    onPress={() => setFilterUserId('ALL')}
                    activeOpacity={0.7}>
                    <ThemedText
                      style={[
                        styles.categoryButtonText,
                        filterUserId === 'ALL' && [styles.categoryButtonTextActive, { color: '#FFFFFF' }],
                      ]}>
                      {t('transactions.filter.all.users')}
                    </ThemedText>
                  </TouchableOpacity>
                  {getUniqueUserIds().map((userId) => {
                    // Determinar qué mostrar
                    const displayName = userId === user?.id 
                      ? t('transactions.filter.me') 
                      : userNamesMap[userId] || '...';

                    return (
                      <TouchableOpacity
                        key={userId}
                        style={[
                          styles.categoryButton,
                          filterUserId === userId && {
                            backgroundColor: typeColor,
                          },
                          { borderColor: colors.icon },
                        ]}
                        onPress={() => setFilterUserId(userId)}
                        activeOpacity={0.7}>
                        <ThemedText
                          style={[
                            styles.categoryButtonText,
                            filterUserId === userId && [styles.categoryButtonTextActive, { color: '#FFFFFF' }],
                          ]}>
                          {displayName}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Filtro por Método de Pago */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transactions.filter.payment.method')}</ThemedText>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    filterPaymentMethod === 'ALL' && {
                      backgroundColor: colors.tint,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => setFilterPaymentMethod('ALL')}
                  activeOpacity={0.7}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      filterPaymentMethod === 'ALL' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    {t('transactions.filter.type.all')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    filterPaymentMethod === 'CASH' && {
                      backgroundColor: colors.tint,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => setFilterPaymentMethod('CASH')}
                  activeOpacity={0.7}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      filterPaymentMethod === 'CASH' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    💵 {t('transactions.filter.payment.cash')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    filterPaymentMethod === 'CARD' && {
                      backgroundColor: colors.tint,
                    },
                    { borderColor: colors.icon },
                  ]}
                  onPress={() => setFilterPaymentMethod('CARD')}
                  activeOpacity={0.7}>
                  <ThemedText
                    style={[
                      styles.typeButtonText,
                      filterPaymentMethod === 'CARD' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                    ]}>
                    💳 {t('transactions.filter.payment.card')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Filtro por Monto */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transactions.filter.amount')}</ThemedText>
              <View style={styles.amountInputsRow}>
                <View style={styles.amountInputWrapper}>
                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.inputText, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground },
                    ]}
                    placeholder={t('transactions.filter.amount.min')}
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="numeric"
                    value={filterMinAmount !== null ? filterMinAmount.toString() : ''}
                    onChangeText={(text) => {
                      const value = text === '' ? null : parseFloat(text);
                      setFilterMinAmount(value !== null && !isNaN(value) && value >= 0 ? value : null);
                    }}
                  />
                </View>
                <View style={styles.amountInputWrapper}>
                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.inputText, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground },
                    ]}
                    placeholder={t('transactions.filter.amount.max')}
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="numeric"
                    value={filterMaxAmount !== null ? filterMaxAmount.toString() : ''}
                    onChangeText={(text) => {
                      const value = text === '' ? null : parseFloat(text);
                      setFilterMaxAmount(value !== null && !isNaN(value) && value >= 0 ? value : null);
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Filtro por Fecha */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>{t('transactions.filter.date.start')}</ThemedText>
              <View style={styles.amountInputsRow}>
                <View style={styles.amountInputWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      { borderColor: colors.icon },
                    ]}
                    onPress={() => {
                      if (showStartDatePicker) {
                        setShowStartDatePicker(false);
                      } else {
                        setShowStartDatePicker(true);
                        setShowEndDatePicker(false); // Cerrar el otro picker si está abierto
                      }
                    }}
                    activeOpacity={0.7}>
                    <ThemedText
                      style={[
                        styles.dateButtonText,
                        { color: filterStartDate ? colors.text : colors.icon },
                      ]}>
                      {filterStartDate
                        ? filterStartDate.toLocaleDateString(datePickerLocale, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : t('transactions.filter.date.start')}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                <View style={styles.amountInputWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      { borderColor: colors.icon },
                    ]}
                    onPress={() => {
                      if (showEndDatePicker) {
                        setShowEndDatePicker(false);
                      } else {
                        setShowEndDatePicker(true);
                        setShowStartDatePicker(false); // Cerrar el otro picker si está abierto
                      }
                    }}
                    activeOpacity={0.7}>
                    <ThemedText
                      style={[
                        styles.dateButtonText,
                        { color: filterEndDate ? colors.text : colors.icon },
                      ]}>
                      {filterEndDate
                        ? filterEndDate.toLocaleDateString(datePickerLocale, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : t('transactions.filter.date.end')}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Date Pickers - Posicionados a la izquierda */}
              {showStartDatePicker && (
                <View style={styles.datePickerContainer}>
                  <UniversalDatePicker
                    value={filterStartDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    locale={datePickerLocale}
                    textColor={theme === 'dark' ? '#FFFFFF' : '#000000'}
                    themeVariant={theme === 'dark' ? 'dark' : 'light'}
                    onChange={(selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowStartDatePicker(false);
                      }
                      setFilterStartDate(selectedDate);
                    }}
                    maximumDate={
                      (() => {
                        const today = new Date();
                        today.setHours(23, 59, 59, 999);
                        if (filterEndDate) {
                          const endDate = new Date(filterEndDate);
                          endDate.setHours(23, 59, 59, 999);
                          return endDate < today ? endDate : today;
                        }
                        return today;
                      })()
                    }
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={[styles.datePickerButton, { backgroundColor: colors.tint }]}
                      onPress={() => setShowStartDatePicker(false)}>
                      <ThemedText style={[styles.datePickerButtonText, { color: '#FFFFFF' }]}>{t('common.confirm')}</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              {showEndDatePicker && (
                <View style={styles.datePickerContainer}>
                  <UniversalDatePicker
                    value={filterEndDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    locale={datePickerLocale}
                    textColor={theme === 'dark' ? '#FFFFFF' : '#000000'}
                    themeVariant={theme === 'dark' ? 'dark' : 'light'}
                    onChange={(selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowEndDatePicker(false);
                      }
                      setFilterEndDate(selectedDate);
                    }}
                    minimumDate={filterStartDate || undefined}
                    maximumDate={new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={[styles.datePickerButton, { backgroundColor: colors.tint }]}
                      onPress={() => setShowEndDatePicker(false)}>
                      <ThemedText style={[styles.datePickerButtonText, { color: '#FFFFFF' }]}>{t('common.confirm')}</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Botón Aplicar Filtros */}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: typeColor },
              ]}
              onPress={handleApplyFilters}
              activeOpacity={0.7}>
              <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
                {t('transactions.filter.apply')}
              </ThemedText>
            </TouchableOpacity>

            {/* Botón Limpiar Filtros */}
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleResetFilters}
              activeOpacity={0.7}>
              <ThemedText style={[styles.clearButtonText, { color: colors.icon }]}>
                {t('transactions.filter.reset')}
              </ThemedText>
            </TouchableOpacity>

            {/* Botón Cancelar */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              activeOpacity={0.7}>
              <ThemedText style={[styles.cancelButtonText, { color: colors.icon }]}>
                {t('transactions.filter.cancel')}
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
    // color handled inline
    opacity: 1,
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
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  amountInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountInputWrapper: {
    flex: 1,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
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
    ...Platform.select({
      ios: {
        backgroundColor: 'transparent',
        alignItems: 'flex-start',
      },
      android: {
        // En Android el picker se muestra como modal nativo
      },
    }),
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
