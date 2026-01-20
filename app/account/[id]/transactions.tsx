/**
 * Pantalla de Todas las Transacciones
 * 
 * Ruta: /account/[id]/transactions
 * 
 * Funcionalidades:
 * - Lista completa de todas las transacciones de una cuenta
 * - Filtros avanzados (tipo, categoría, usuario, monto)
 * - Ordenamiento personalizable
 */

import { ConfirmModal } from '@/components/ConfirmModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { deleteTransaction, subscribeToAccountTransactions } from '@/services/transactions';
import type { Account, Transaction } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  COP: '$',
};

export default function AllTransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { theme, setThemeMode } = useTheme();
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const colors = Colors[theme];

  const accountId = params.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  // Filtros
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterUserId, setFilterUserId] = useState<string>('ALL');
  const [filterMinAmount, setFilterMinAmount] = useState<number | null>(null);
  const [filterMaxAmount, setFilterMaxAmount] = useState<number | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

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
          joinCode: accountData.joinCode || undefined,
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
   * Listener en tiempo real para transacciones
   */
  useEffect(() => {
    if (!accountId) return;

    const unsubscribe = subscribeToAccountTransactions(accountId, (newTransactions) => {
      setTransactions(newTransactions);
    }, 1000); // Límite alto para obtener todas

    return () => unsubscribe();
  }, [accountId]);

  /**
   * Carga los filtros guardados cuando la pantalla se enfoca
   */
  useFocusEffect(
    React.useCallback(() => {
      const loadFilters = async () => {
        if (!accountId) return;
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
            setSortOrder(filters.sortOrder || 'newest');
          }
        } catch (error) {
          console.error('Error cargando filtros:', error);
        }
      };

      loadFilters();
    }, [accountId])
  );

  /**
   * Calcula las transacciones filtradas y ordenadas usando useMemo
   */
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filtrar por tipo
    if (filterType !== 'ALL') {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    // Filtrar por categoría
    if (filterCategory !== 'ALL') {
      filtered = filtered.filter((t) => t.category === filterCategory);
    }

    // Filtrar por usuario (solo para cuentas GROUP)
    if (account?.type === 'GROUP' && filterUserId !== 'ALL') {
      filtered = filtered.filter((t) => t.userId === filterUserId);
    }

    // Filtrar por monto mínimo
    if (filterMinAmount !== null && filterMinAmount > 0) {
      filtered = filtered.filter((t) => t.amount >= filterMinAmount);
    }

    // Filtrar por monto máximo
    if (filterMaxAmount !== null && filterMaxAmount > 0) {
      filtered = filtered.filter((t) => t.amount <= filterMaxAmount);
    }

    // Filtrar por fecha inicio
    if (filterStartDate !== null) {
      const startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((t) => {
        if (!t.date) return false;
        const transactionDate = t.date.toDate ? t.date.toDate() : new Date(t.date);
        transactionDate.setHours(0, 0, 0, 0);
        return transactionDate >= startDate;
      });
    }

    // Filtrar por fecha fin
    if (filterEndDate !== null) {
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => {
        if (!t.date) return false;
        const transactionDate = t.date.toDate ? t.date.toDate() : new Date(t.date);
        transactionDate.setHours(0, 0, 0, 0);
        return transactionDate <= endDate;
      });
    }

    // Ordenar (por defecto: más recientes primero)
    filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'newest': {
          const aDate = a.date?.toMillis() || 0;
          const bDate = b.date?.toMillis() || 0;
          return bDate - aDate;
        }
        case 'oldest': {
          const aDate = a.date?.toMillis() || 0;
          const bDate = b.date?.toMillis() || 0;
          return aDate - bDate;
        }
        case 'highest': {
          return b.amount - a.amount;
        }
        case 'lowest': {
          return a.amount - b.amount;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [transactions, filterType, filterCategory, filterUserId, filterMinAmount, filterMaxAmount, filterStartDate, filterEndDate, sortOrder, account?.type]);

  /**
   * Formatea el monto de transacción usando Intl.NumberFormat
   * COP: solo enteros con separadores de miles (sin decimales)
   * EUR/USD: con decimales
   */
  const formatTransactionAmount = (amount: number, currency: string): string => {
    if (currency === 'COP') {
      // COP: solo enteros con puntos como separadores de miles (sin decimales)
      const locale = 'es-CO';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(amount));
    } else {
      // EUR/USD: con decimales
      const locale = currency === 'EUR' ? 'de-DE' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }
  };

  /**
   * Formatea la fecha de transacción
   */
  const formatDate = (date: any): string => {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateObj.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return dateObj.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: dateObj.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  /**
   * Maneja la eliminación de una transacción
   */
  const handleDeleteTransaction = (transaction: Transaction) => {
    if (!accountId) return;

    Alert.alert(
      t('transactions.delete'),
      t('transactions.delete.confirm'),
      [
        {
          text: t('transactions.delete.cancel'),
          style: 'cancel',
        },
        {
          text: t('transactions.delete.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(accountId, transaction.id);
            } catch (error) {
              console.error('Error eliminando transacción:', error);
              Alert.alert('Error', 'No se pudo eliminar la transacción. Intenta de nuevo.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Renderiza una transacción
   */
  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'INCOME';
    const amountColor = isIncome ? '#34C759' : '#FF3B30';
    const formattedAmount = formatTransactionAmount(item.amount, account?.currency || 'USD');
    const displayAmount = isIncome ? `+${formattedAmount}` : `-${formattedAmount}`;
    const iconName = isIncome ? 'arrow-upward' : 'arrow-downward';

    return (
      <View style={[styles.transactionItem, { 
        backgroundColor: colors.background,
        borderColor: isIncome ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)',
      }]}>
        <View style={styles.transactionContent}>
          <View style={styles.transactionLeft}>
            <View style={styles.transactionCategoryRow}>
              <View style={[styles.transactionIconContainer, { 
                backgroundColor: isIncome ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)' 
              }]}>
                <MaterialIcons 
                  name={iconName} 
                  size={18} 
                  color={amountColor} 
                />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.transactionCategory}>
                {item.category}
              </ThemedText>
            </View>
            {item.note && (
              <ThemedText style={styles.transactionNote}>{item.note}</ThemedText>
            )}
            <ThemedText style={styles.transactionDate}>{formatDate(item.date)}</ThemedText>
          </View>
          <View style={styles.transactionRight}>
            <Text style={[styles.transactionAmount, { color: amountColor }]}>
              {displayAmount}
            </Text>
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
              onPress={() => handleDeleteTransaction(item)}
              activeOpacity={0.7}>
              <MaterialIcons name="delete" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /**
   * Renderiza el estado vacío
   */
  const renderEmptyComponent = () => (
    <View style={styles.emptyTransactions}>
      <ThemedText style={styles.emptyTransactionsText}>
        {t('transactions.empty')}
      </ThemedText>
      <ThemedText style={styles.emptyTransactionsSubtext}>
        {filterType !== 'ALL' || filterCategory !== 'ALL' || hasActiveFilters
          ? t('transactions.empty.filtered')
          : t('transactions.empty.default')}
      </ThemedText>
    </View>
  );

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
   * Resetea los filtros
   */
  const handleResetFilters = () => {
    setFilterType('ALL');
    setFilterCategory('ALL');
    setFilterUserId('ALL');
    setFilterMinAmount(null);
    setFilterMaxAmount(null);
    setSortOrder('newest');
  };

  /**
   * Verifica si hay filtros activos
   */
  const hasActiveFilters =
    filterType !== 'ALL' ||
    filterCategory !== 'ALL' ||
    filterUserId !== 'ALL' ||
    filterMinAmount !== null ||
    filterMaxAmount !== null ||
    sortOrder !== 'newest';

  /**
   * Maneja el logout con confirmación usando ConfirmModal
   */
  const handleLogout = (): void => {
    setShowSettingsModal(false);
    setShowLogoutModal(true);
  };

  /**
   * Ejecuta el logout después de confirmación
   */
  const executeLogout = (): void => {
    setShowLogoutModal(false);
    logout().catch((error) => {
      console.error('Error al cerrar sesión:', error);
    });
  };

  if (loading || !account) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>{t('transactions.loading')}</ThemedText>
      </ThemedView>
    );
  }

  const typeColor = filterType === 'INCOME' ? colors.success : filterType === 'EXPENSE' ? colors.error : colors.tint;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>← {t('account.back')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: colors.background + '20' }]}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.7}>
            <MaterialIcons name="settings" size={24} color={colors.tint} />
          </TouchableOpacity>
        </View>
        <ThemedText type="title" style={styles.title}>
          {t('transactions.all')}
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          {filteredTransactions.length} {filteredTransactions.length === 1 ? t('account.transaction') : t('account.transactions.plural')}
        </ThemedText>
        
        {/* Botón Filtrar Transacciones */}
        <TouchableOpacity
          style={[styles.filterTransactionsButton, { borderColor: colors.icon }]}
          onPress={() => router.push(`/account/${accountId}/transactions-filter`)}
          activeOpacity={0.7}>
          <ThemedText style={styles.filterTransactionsButtonText}>{t('transactions.filter')}</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Lista de Transacciones */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={[
          styles.flatListContent,
          filteredTransactions.length === 0 && styles.flatListContentEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={styles.transactionSeparator} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal de Configuración */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}>
          <ThemedView
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                {t('settings.title')}
              </ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSettingsModal(false)}
                activeOpacity={0.7}>
                <MaterialIcons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Opción: Apariencia */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <MaterialIcons name="palette" size={20} color={colors.tint} />
                  <ThemedText type="defaultSemiBold" style={styles.settingsSectionTitle}>
                    {t('settings.appearance')}
                  </ThemedText>
                </View>
                <View style={styles.settingsOptions}>
                  <TouchableOpacity
                    style={[
                      styles.settingsOption,
                      theme === 'light' && { backgroundColor: colors.tint + '20' },
                    ]}
                    onPress={async () => {
                      await setThemeMode('light');
                    }}
                    activeOpacity={0.7}>
                    <MaterialIcons
                      name="light-mode"
                      size={20}
                      color={theme === 'light' ? colors.tint : colors.icon}
                    />
                    <ThemedText
                      style={[
                        styles.settingsOptionText,
                        { color: colors.text },
                      ]}>
                      {t('settings.appearance.light')}
                    </ThemedText>
                    {theme === 'light' && (
                      <MaterialIcons name="check" size={20} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.settingsOption,
                      theme === 'dark' && { backgroundColor: colors.tint + '20' },
                    ]}
                    onPress={async () => {
                      await setThemeMode('dark');
                    }}
                    activeOpacity={0.7}>
                    <MaterialIcons
                      name="dark-mode"
                      size={20}
                      color={theme === 'dark' ? colors.tint : colors.icon}
                    />
                    <ThemedText
                      style={[
                        styles.settingsOptionText,
                        theme === 'dark' ? { color: '#FFFFFF' } : { color: colors.text },
                      ]}>
                      {t('settings.appearance.dark')}
                    </ThemedText>
                    {theme === 'dark' && (
                      <MaterialIcons name="check" size={20} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Opción: Idioma */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <MaterialIcons name="language" size={20} color={colors.tint} />
                  <ThemedText type="defaultSemiBold" style={styles.settingsSectionTitle}>
                    {t('settings.language')}
                  </ThemedText>
                </View>
                <View style={styles.settingsOptions}>
                  <TouchableOpacity
                    style={[
                      styles.settingsOption,
                      language === 'es' && { backgroundColor: colors.tint + '20' },
                    ]}
                    onPress={() => setLanguage('es')}
                    activeOpacity={0.7}>
                    <ThemedText
                      style={[
                        styles.settingsOptionText,
                        { color: colors.text },
                      ]}>
                      {t('settings.language.es')}
                    </ThemedText>
                    {language === 'es' && (
                      <MaterialIcons name="check" size={20} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.settingsOption,
                      language === 'en' && { backgroundColor: colors.tint + '20' },
                    ]}
                    onPress={() => setLanguage('en')}
                    activeOpacity={0.7}>
                    <ThemedText
                      style={[
                        styles.settingsOptionText,
                        { color: colors.text },
                      ]}>
                      {t('settings.language.en')}
                    </ThemedText>
                    {language === 'en' && (
                      <MaterialIcons name="check" size={20} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Opción: Cerrar Sesión */}
              <TouchableOpacity
                style={[styles.logoutOption, { borderColor: '#FF3B30' + '40' }]}
                onPress={handleLogout}
                activeOpacity={0.7}>
                <MaterialIcons name="logout" size={20} color={colors.error} />
                <ThemedText style={[styles.logoutOptionText, { color: colors.error }]}>
                  {t('settings.logout')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Confirmación de Logout */}
      <ConfirmModal
        visible={showLogoutModal}
        title={t('settings.logout')}
        message={t('settings.logout.confirm')}
        confirmText={t('settings.logout.confirm.button')}
        cancelText={t('settings.logout.cancel')}
        confirmButtonStyle="destructive"
        onConfirm={executeLogout}
        onCancel={() => setShowLogoutModal(false)}
        cancelable={true}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  filterTransactionsButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  filterTransactionsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    textAlign: 'center',
  },
  flatListContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  flatListContentEmpty: {
    flexGrow: 1,
  },
  transactionItem: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.1)',
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  transactionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  transactionLeft: {
    flex: 1,
    gap: 6,
  },
  transactionCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transactionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionCategory: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  transactionNote: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 6,
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  deleteButton: {
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionSeparator: {
    height: 12,
  },
  emptyTransactions: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTransactionsText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyTransactionsSubtext: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
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
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 12,
  },
  modalBody: {
    paddingHorizontal: 24,
    gap: 32,
  },
  settingsSection: {
    gap: 16,
  },
  settingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  settingsOptions: {
    gap: 12,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.1)',
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 8,
  },
  logoutOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
});
