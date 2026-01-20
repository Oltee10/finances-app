/**
 * Pantalla de Detalles de Cuenta - Dashboard de Finanzas
 * 
 * Ruta: /account/[id]
 * 
 * Funcionalidades:
 * - Header con nombre, balance y moneda
 * - Botón Share Code para cuentas GROUP
 * - Gráfico de balance últimos 30 días
 * - Lista de transacciones en tiempo real
 * - Botón para agregar transacciones
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateBalance, subscribeToAccountTransactions } from '@/services/transactions';
import type { Account, Transaction } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  type DocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  COP: '$',
};

export default function AccountDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const colors = Colors[theme];
  const isDark = theme === 'dark';

  const accountId = params.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showJoinCode, setShowJoinCode] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  
  // Filtros
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterUserId, setFilterUserId] = useState<string>('ALL');
  const [filterMinAmount, setFilterMinAmount] = useState<number | null>(null);
  const [filterMaxAmount, setFilterMaxAmount] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  /**
   * Carga los datos de la cuenta
   */
  const loadAccount = useCallback(async () => {
    if (!accountId) {
      router.back();
      return;
    }

    try {
      const accountRef = doc(db, 'accounts', accountId);
      const accountDoc = await getDoc(accountRef);

      if (!accountDoc.exists()) {
        Alert.alert('Error', 'Cuenta no encontrada');
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
    } catch (error) {
      console.error('Error cargando cuenta:', error);
      Alert.alert('Error', 'No se pudo cargar la cuenta');
      router.back();
    }
  }, [accountId, router]);


  /**
   * Listener en tiempo real para transacciones
   */
  useEffect(() => {
    if (!accountId) return;

    const unsubscribe = subscribeToAccountTransactions(accountId, (newTransactions) => {
      setTransactions(newTransactions);
      const newBalance = calculateBalance(newTransactions);
      setBalance(newBalance);
    });

    return () => unsubscribe();
  }, [accountId]);


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

    // Ordenar
    filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'newest': {
          // Más recientes primero
          const aDate = a.date?.toMillis() || 0;
          const bDate = b.date?.toMillis() || 0;
          return bDate - aDate;
        }
        case 'oldest': {
          // Más antiguas primero
          const aDate = a.date?.toMillis() || 0;
          const bDate = b.date?.toMillis() || 0;
          return aDate - bDate;
        }
        case 'highest': {
          // Mayor monto primero
          return b.amount - a.amount;
        }
        case 'lowest': {
          // Menor monto primero
          return a.amount - b.amount;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [transactions, filterType, filterCategory, filterUserId, filterMinAmount, filterMaxAmount, sortOrder, account?.type]);

  /**
   * Listener en tiempo real para cambios en la cuenta
   */
  useEffect(() => {
    if (!accountId) return;

    const accountRef = doc(db, 'accounts', accountId);
    const unsubscribe = onSnapshot(
      accountRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          const accountData = snapshot.data();
          const updatedAccount: Account = {
            id: snapshot.id,
            name: accountData.name,
            type: accountData.type,
            currency: accountData.currency,
            ownerId: accountData.ownerId,
            memberIds: accountData.memberIds,
            joinCode: accountData.joinCode || undefined,
            createdAt: accountData.createdAt,
            updatedAt: accountData.updatedAt,
          } as Account;
          setAccount(updatedAccount);
        }
      },
      (error) => {
        console.error('Error en listener de cuenta:', error);
      }
    );

    return () => unsubscribe();
  }, [accountId]);

  /**
   * Carga inicial
   */
  useEffect(() => {
    setLoading(true);
    loadAccount();
  }, [loadAccount]);

  /**
   * Formatea el balance con símbolo de moneda usando Intl.NumberFormat
   * COP: solo enteros con separadores de miles (sin decimales)
   * EUR/USD: con decimales
   */
  const formatBalance = (amount: number, currency: string): string => {
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
   * Formatea fecha para mostrar en transacciones
   */
  const formatDate = (date: Timestamp | undefined): string => {
    if (!date) return '';
    const dateObj = date.toDate();
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
   * Navega a la pantalla de agregar transacción
   */
  const navigateToAddTransaction = (): void => {
    router.push(`/transaction-add?accountId=${accountId}`);
  };

  const [copied, setCopied] = useState<boolean>(false);

  /**
   * Copia el join code al portapapeles
   */
  const handleCopyJoinCode = async (): Promise<void> => {
    if (!account?.joinCode) return;
    
    try {
      await Clipboard.setStringAsync(account.joinCode);
      setCopied(true);
      
      // Resetear el estado de copiado después de 2 segundos
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Error copiando código:', error);
      Alert.alert('Error', 'No se pudo copiar el código. Intenta de nuevo.');
    }
  };

  /**
   * Elimina la cuenta y todas sus transacciones (eliminación en cascada)
   * Usando el mismo flujo de confirmación (Alert / Modal RN) en todas las plataformas
   */
  const handleDeleteAccount = async (): Promise<void> => {
    if (!accountId || !account) return;

    // Mismo flujo de confirmación en todas las plataformas (incluyendo Web)
    Alert.alert(
      t('account.delete'),
      t('account.delete.confirm'),
      [
        {
          text: t('account.delete.cancel'),
          style: 'cancel',
        },
        {
          text: t('account.delete.continue'),
          onPress: () => {
            Alert.alert(
              t('account.delete.warning'),
              t('account.delete.warning.text'),
              [
                {
                  text: t('account.delete.cancel'),
                  style: 'cancel',
                },
                {
                  text: t('account.delete.confirm.button'),
                  style: 'destructive',
                  onPress: async () => {
                    await performAccountDeletion();
                  },
                },
              ],
              { cancelable: true }
            );
          },
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Realiza la eliminación en cascada: primero todas las transacciones, luego la cuenta
   */
  const performAccountDeletion = async (): Promise<void> => {
    if (!accountId) return;

    setDeleting(true);

    try {
      // Paso 1: Obtener referencia a la subcolección de transacciones
      const transactionsRef = collection(db, 'accounts', accountId, 'transactions');

      // Paso 2: Obtener todas las transacciones
      const transactionsSnapshot = await getDocs(transactionsRef);

      // Paso 3: Crear un WriteBatch para eliminar todas las transacciones
      const batch = writeBatch(db);

      transactionsSnapshot.docs.forEach((transactionDoc) => {
        batch.delete(transactionDoc.ref);
      });

      // Paso 4: Ejecutar el batch para eliminar todas las transacciones
      await batch.commit();

      // Paso 5: Eliminar el documento de la cuenta
      const accountRef = doc(db, 'accounts', accountId);
      await deleteDoc(accountRef);

      // Paso 6: Redirigir a la pantalla principal
      router.replace('/');
    } catch (error: any) {
      console.error('Error eliminando cuenta:', error);

      if (error?.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Sesión expirada',
          'Por seguridad, vuelve a iniciar sesión y luego intenta eliminar la cuenta de nuevo.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          error?.message || 'No se pudo eliminar la cuenta. Intenta de nuevo.',
          [{ text: 'OK' }]
        );
      }

      setDeleting(false);
    }
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
          </View>
        </View>
      </View>
    );
  };

  if (loading || !account) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>Cargando cuenta...</ThemedText>
      </ThemedView>
    );
  }

  /**
   * Renderiza el header del FlatList (Balance, etc.)
   */
  const renderListHeader = () => (
    <>
      {/* Header Section */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.backButton, { backgroundColor: colors.background + '20' }]}
            activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={20} color={colors.tint} />
            <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>{t('account.back')}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={[styles.deleteButton, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
            disabled={deleting}
            activeOpacity={0.7}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <MaterialIcons name="delete-outline" size={22} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.headerContent}>
          <View style={styles.accountNameContainer}>
            <ThemedText type="title" style={styles.accountName}>
              {account.name}
            </ThemedText>
            <View style={[styles.accountTypeBadge, { backgroundColor: colors.tint + '15' }]}>
              <MaterialIcons 
                name={account.type === 'GROUP' ? 'group' : 'person'} 
                size={16} 
                color={colors.tint} 
              />
              <ThemedText style={[styles.accountTypeText, { color: colors.tint }]}>
                {account.type === 'GROUP' ? t('account.type.group') : t('account.type.personal')}
              </ThemedText>
            </View>
          </View>
          
          {/* Balance Section - Rediseñada */}
          <View style={[styles.balanceContainer, { 
            backgroundColor: isDark 
              ? (balance >= 0 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)')
              : (balance >= 0 ? 'rgba(52, 199, 89, 0.08)' : 'rgba(255, 59, 48, 0.08)'),
            borderColor: balance >= 0 ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)',
          }]}>
            <ThemedText style={[styles.balanceLabel, { 
              color: balance >= 0 ? colors.success : colors.error,
              opacity: 0.8,
            }]}>
              {t('account.balance.total')}
            </ThemedText>
            <Text
              style={[
                styles.balanceAmount,
                { color: balance >= 0 ? '#34C759' : '#FF3B30' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.5}>
              {formatBalance(balance, account.currency)}
            </Text>
            <View style={[styles.currencyBadge, { 
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              borderColor: balance >= 0 ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)',
            }]}>
              <ThemedText style={[styles.currencyText, { 
                color: balance >= 0 ? colors.success : colors.error,
              }]}>
                {account.currency}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Share Code para cuentas GROUP */}
        {account.type === 'GROUP' && account.joinCode && (
          <View style={styles.shareCodeContainer}>
            <TouchableOpacity
              style={[styles.shareCodeButton, { backgroundColor: colors.tint }]}
              onPress={() => setShowJoinCode(!showJoinCode)}>
              <ThemedText style={styles.shareCodeButtonText}>
                {showJoinCode ? t('account.share.code.hide') : t('account.share.code.show')}
              </ThemedText>
            </TouchableOpacity>
            {showJoinCode && (
              <View style={[styles.joinCodeDisplay, { borderColor: colors.tint }]}>
                <View style={styles.joinCodeContent}>
                  <View style={styles.joinCodeValueContainer}>
                    <Text style={[styles.joinCodeValue, { color: colors.text }]}>
                      {account.joinCode}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.copyButton, { backgroundColor: colors.background, borderColor: colors.icon }, copied && styles.copyButtonActive]}
                    onPress={handleCopyJoinCode}
                    activeOpacity={0.7}>
                    {copied ? (
                      <MaterialIcons name="check" size={20} color={colors.success} />
                    ) : (
                      <MaterialIcons name="content-copy" size={20} color={colors.tint} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </>
  );

  /**
   * Renderiza el estado vacío cuando no hay transacciones
   */
  const renderEmptyComponent = () => (
    <View style={styles.emptyTransactions}>
      <ThemedText style={styles.emptyTransactionsText}>
        {t('account.empty.transactions')}
      </ThemedText>
      <ThemedText style={styles.emptyTransactionsSubtext}>
        Toca el botón "+" para agregar tu primera transacción
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

  // Limitar a las últimas 5 transacciones
  const displayTransactions = filteredTransactions.slice(0, 5);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {renderListHeader()}
          
          {/* Transactions Section */}
          <View style={styles.transactionsContainer}>
            <View style={styles.transactionsHeader}>
              <View style={styles.transactionsHeaderLeft}>
              <ThemedText type="subtitle" style={styles.transactionsTitle}>
                {t('account.transactions')}
              </ThemedText>
              <ThemedText style={styles.transactionsCount}>
                {filteredTransactions.length} {filteredTransactions.length === 1 ? t('account.transaction') : t('account.transactions.plural')}
                {filteredTransactions.length > 5 && ` (${t('common.loading').replace('...', '')} 5)`}
              </ThemedText>
              </View>
              <TouchableOpacity
                style={[styles.viewAllButton, { borderColor: colors.icon }]}
                onPress={() => router.push(`/account/${accountId}/transactions`)}
                activeOpacity={0.7}>
                <ThemedText style={styles.viewAllButtonText}>{t('account.view.all')}</ThemedText>
              </TouchableOpacity>
            </View>

            {displayTransactions.length === 0 ? (
              renderEmptyComponent()
            ) : (
              <View style={styles.transactionsList}>
                {displayTransactions.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {renderTransaction({ item })}
                    {index < displayTransactions.length - 1 && (
                      <View style={styles.transactionSeparator} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Modal de filtros */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                {t('transactions.filter.title')}
              </ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowFilterModal(false)}
                activeOpacity={0.7}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Filtro por Tipo */}
              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Tipo de Transacción</ThemedText>
                <View style={styles.filterButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      filterType === 'ALL' && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => setFilterType('ALL')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        filterType === 'ALL' && { color: '#FFFFFF' },
                      ]}>
                      Todas
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                        filterType === 'INCOME' && { backgroundColor: colors.success },
                    ]}
                    onPress={() => setFilterType('INCOME')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        filterType === 'INCOME' && { color: '#FFFFFF' },
                      ]}>
                      Ingresos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      filterType === 'EXPENSE' && { backgroundColor: colors.error },
                    ]}
                    onPress={() => setFilterType('EXPENSE')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        filterType === 'EXPENSE' && { color: '#FFFFFF' },
                      ]}>
                      Gastos
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filtro por Categoría */}
              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Categoría</ThemedText>
                <ScrollView
                  style={styles.categoriesList}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}>
                  <TouchableOpacity
                    style={[
                      styles.categoryButton,
                      filterCategory === 'ALL' && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => setFilterCategory('ALL')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.categoryButtonText,
                        filterCategory === 'ALL' && { color: '#FFFFFF' },
                      ]}>
                      Todas las categorías
                    </Text>
                  </TouchableOpacity>
                  {getUniqueCategories().map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        filterCategory === category && { backgroundColor: colors.tint },
                      ]}
                      onPress={() => setFilterCategory(category)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.categoryButtonText,
                          filterCategory === category && { color: '#FFFFFF' },
                        ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Filtro por Usuario (solo para cuentas GROUP) */}
              {account?.type === 'GROUP' && (
                <View style={styles.filterSection}>
                  <ThemedText style={styles.filterSectionTitle}>Usuario</ThemedText>
                  <ScrollView
                    style={styles.categoriesList}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}>
                    <TouchableOpacity
                      style={[
                        styles.categoryButton,
                        filterUserId === 'ALL' && { backgroundColor: colors.tint },
                      ]}
                      onPress={() => setFilterUserId('ALL')}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.categoryButtonText,
                          filterUserId === 'ALL' && { color: '#FFFFFF' },
                        ]}>
                        Todos los usuarios
                      </Text>
                    </TouchableOpacity>
                    {getUniqueUserIds().map((userId) => (
                      <TouchableOpacity
                        key={userId}
                        style={[
                          styles.categoryButton,
                          filterUserId === userId && { backgroundColor: colors.tint },
                        ]}
                        onPress={() => setFilterUserId(userId)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.categoryButtonText,
                            filterUserId === userId && { color: '#FFFFFF' },
                          ]}>
                          {userId === user?.id ? 'Yo' : `Usuario: ${userId.substring(0, 8)}...`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Filtro por Monto */}
              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Monto</ThemedText>
                <View style={styles.amountFilterRow}>
                  <View style={styles.amountInputContainer}>
                    <ThemedText style={styles.amountInputLabel}>Mínimo</ThemedText>
                    <TextInput
                      style={[styles.amountInput, { backgroundColor: colors.background, borderColor: colors.icon + '40', color: colors.text }]}
                      placeholder="0"
                      placeholderTextColor={colors.text + '80'}
                      keyboardType="numeric"
                      value={filterMinAmount !== null ? filterMinAmount.toString() : ''}
                      onChangeText={(text) => {
                        const value = text === '' ? null : parseFloat(text);
                        setFilterMinAmount(value !== null && !isNaN(value) && value >= 0 ? value : null);
                      }}
                    />
                  </View>
                  <View style={styles.amountInputContainer}>
                    <ThemedText style={styles.amountInputLabel}>Máximo</ThemedText>
                    <TextInput
                      style={[styles.amountInput, { backgroundColor: colors.background, borderColor: colors.icon + '40', color: colors.text }]}
                      placeholder="Sin límite"
                      placeholderTextColor={colors.text + '80'}
                      keyboardType="numeric"
                      value={filterMaxAmount !== null ? filterMaxAmount.toString() : ''}
                      onChangeText={(text) => {
                        const value = text === '' ? null : parseFloat(text);
                        setFilterMaxAmount(value !== null && !isNaN(value) && value >= 0 ? value : null);
                      }}
                    />
                  </View>
                </View>
                {/* Botones de rangos rápidos */}
                <View style={styles.filterButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      filterMinAmount === null && filterMaxAmount === null && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      setFilterMinAmount(null);
                      setFilterMaxAmount(null);
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        filterMinAmount === null && filterMaxAmount === null && { color: '#FFFFFF' },
                      ]}>
                      Todos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      filterMaxAmount === 50 && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      setFilterMinAmount(null);
                      setFilterMaxAmount(50);
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        filterMaxAmount === 50 && { color: '#FFFFFF' },
                      ]}>
                      {'< 50'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      filterMinAmount === 50 && filterMaxAmount === 500 && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      setFilterMinAmount(50);
                      setFilterMaxAmount(500);
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        filterMinAmount === 50 && filterMaxAmount === 500 && { color: '#FFFFFF' },
                      ]}>
                      50-500
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      filterMinAmount === 500 && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      setFilterMinAmount(500);
                      setFilterMaxAmount(null);
                    }}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        filterMinAmount === 500 && { color: '#FFFFFF' },
                      ]}>
                      {'> 500'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filtro por Orden */}
              <View style={styles.filterSection}>
                <ThemedText style={styles.filterSectionTitle}>Ordenar Por</ThemedText>
                <View style={styles.filterButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      sortOrder === 'newest' && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => setSortOrder('newest')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        sortOrder === 'newest' && { color: '#FFFFFF' },
                      ]}>
                      Más Recientes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      sortOrder === 'oldest' && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => setSortOrder('oldest')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        sortOrder === 'oldest' && { color: '#FFFFFF' },
                      ]}>
                      Más Antiguas
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.filterButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      sortOrder === 'highest' && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => setSortOrder('highest')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        sortOrder === 'highest' && { color: '#FFFFFF' },
                      ]}>
                      Mayor Monto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterTypeButton,
                      sortOrder === 'lowest' && { backgroundColor: colors.tint },
                    ]}
                    onPress={() => setSortOrder('lowest')}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.filterTypeButtonText,
                        sortOrder === 'lowest' && { color: '#FFFFFF' },
                      ]}>
                      Menor Monto
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {hasActiveFilters && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary, { backgroundColor: theme === 'dark' ? colors.cardElevated : 'rgba(0, 0, 0, 0.05)', borderColor: colors.border }]}
                  onPress={handleResetFilters}
                  activeOpacity={0.7}>
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary, { color: colors.text }]}>
                    Limpiar Filtros
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.tint }]}
                onPress={() => setShowFilterModal(false)}
                activeOpacity={0.7}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary, { color: colors.text }]}>
                  Aplicar
                </Text>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* FAB para agregar transacción */}
      <TouchableOpacity
        style={[styles.fab, styles.fabPrimary, { backgroundColor: colors.tint }]}
        onPress={navigateToAddTransaction}
        activeOpacity={0.8}>
        <Text style={[styles.fabText, { color: "#FFFFFF" }]}>+</Text>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
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
    paddingBottom: 24,
    gap: 16,
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  headerContent: {
    gap: 12,
    alignItems: 'center',
  },
  accountNameContainer: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  accountName: {
    fontSize: 28,
    textAlign: 'center',
  },
  accountTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  accountTypeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  balanceContainer: {
    alignItems: 'center',
    gap: 18,
    width: '100%',
    padding: 36,
    borderRadius: 24,
    borderWidth: 2.5,
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  balanceAmount: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: '100%',
    letterSpacing: -2,
  },
  currencyBadge: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  shareCodeContainer: {
    marginTop: 8,
    gap: 12,
  },
  shareCodeButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  shareCodeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  joinCodeDisplay: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'rgba(10, 126, 164, 0.08)',
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  joinCodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  joinCodeValueContainer: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  joinCodeValue: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 5,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      web: 'monospace',
    }),
  },
  copyButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    minHeight: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  copyButtonActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderColor: '#34C759',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  transactionsHeaderLeft: {
    gap: 6,
    flex: 1,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  viewAllButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 110,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  transactionsContainer: {
    marginTop: 8,
  },
  transactionsList: {
    paddingHorizontal: 24,
    gap: 12,
  },
  flatListContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  flatListContentEmpty: {
    flexGrow: 1,
  },
  transactionsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  transactionsCount: {
    fontSize: 13,
    opacity: 0.6,
    fontWeight: '500',
  },
  emptyTransactions: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTransactionsText: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.7,
    textAlign: 'center',
  },
  emptyTransactionsSubtext: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    lineHeight: 20,
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
    gap: 4,
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  transactionSeparator: {
    height: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    alignItems: 'center',
    zIndex: 1000,
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  fabPrimary: {
    // backgroundColor handled inline
  },
  fabText: {
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
  // Modal de filtros
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  filterSection: {
    marginBottom: 24,
    gap: 12,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  filterTypeButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  amountFilterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  amountInputContainer: {
    flex: 1,
    gap: 6,
  },
  amountInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
  },
  categoriesList: {
    maxHeight: 200,
  },
  categoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    // backgroundColor handled inline
  },
  modalButtonSecondary: {
    // backgroundColor and borderColor handled inline
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    // color handled inline
  },
  modalButtonTextSecondary: {
    // color handled inline
  },
});
