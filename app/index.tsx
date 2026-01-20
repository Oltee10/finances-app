/**
 * Home Screen - Pantalla principal con lista de cuentas
 * 
 * Funcionalidades:
 * - Lista de cuentas donde el usuario es miembro
 * - Cards con Name, Currency, y Balance
 * - FAB para agregar nueva cuenta
 * - Pull to refresh
 * - Modal de configuración (tema, idioma, cerrar sesión)
 */

import { ConfirmModal } from '@/components/ConfirmModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { subscribeToUserAccounts } from '@/services/accounts';
import type { AccountWithBalance } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { theme, setThemeMode } = useTheme();
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const colors = Colors[theme];

  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  /**
   * Suscripción en tiempo real a las cuentas del usuario
   */
  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToUserAccounts(user.id, (userAccounts) => {
      setAccounts(userAccounts);
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  /**
   * Maneja el pull to refresh
   */
  const handleRefresh = useCallback(() => {
    // No necesitamos recargar manualmente porque usamos onSnapshot,
    // pero mantenemos el gesto para feedback visual.
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  /**
   * Formatea el balance con símbolo de moneda usando Intl.NumberFormat
   * COP: solo enteros con separadores de miles (sin decimales)
   * EUR/USD: con decimales
   */
  const formatBalance = (balance: number, currency: string): string => {
    if (currency === 'COP') {
      const locale = 'es-CO';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(balance));
    } else {
      const locale = currency === 'EUR' ? 'de-DE' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(balance);
    }
  };

  /**
   * Navega directamente a crear cuenta
   */
  const navigateToCreateAccount = (): void => {
    router.push('/account-create');
  };

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

  /**
   * Renderiza un card de cuenta mejorado
   */
  const renderAccountCard = ({ item }: { item: AccountWithBalance }) => {
    const isPositive = item.balance >= 0;
    const balanceColor = isPositive ? colors.success : colors.error;
    const isDark = theme === 'dark';

    const handleCardPress = () => {
      router.push(`/account/${item.id}`);
    };

    return (
      <TouchableOpacity
        style={[
          styles.accountCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.tint,
          },
        ]}
        activeOpacity={0.7}
        onPress={handleCardPress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatBalance(item.balance, item.currency)}`}>
        <View style={styles.accountCardContent}>
          <View style={styles.accountCardHeader}>
            <View style={styles.accountCardTitleRow}>
              <View style={styles.accountCardTitleContainer}>
                <ThemedText type="defaultSemiBold" style={styles.accountCardName}>
                  {item.name}
                </ThemedText>
              </View>
              <View style={[
                styles.accountCardType,
                { backgroundColor: colors.tint + '15' }
              ]}>
                <MaterialIcons
                  name={item.type === 'INDIVIDUAL' ? 'person' : 'group'}
                  size={14}
                  color={colors.tint}
                />
                <ThemedText style={[styles.accountCardTypeText, { color: colors.tint }]}>
                  {item.type === 'INDIVIDUAL' ? t('home.type.individual') : t('home.type.group')}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.accountCardCurrency, { backgroundColor: colors.tint + '10', borderColor: colors.tint }]}>
              <ThemedText style={[styles.accountCardCurrencyText, { color: colors.tint }]}>
                {item.currency}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.accountCardBalance}>
            <ThemedText style={styles.accountCardBalanceLabel}>
              {t('home.balance')}
            </ThemedText>
            <Text
              style={[
                styles.accountCardBalanceAmount,
                { color: balanceColor },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}>
              {formatBalance(item.balance, item.currency)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Renderiza el estado vacío
   */
  const renderEmptyState = () => (
    <ThemedView style={[styles.emptyState, { backgroundColor: colors.background }]}>
      <MaterialIcons name="account-balance-wallet" size={64} color={colors.icon} style={{ opacity: 0.3 }} />
      <ThemedText type="subtitle" style={styles.emptyStateTitle}>
        {t('home.empty.title')}
      </ThemedText>
      <ThemedText style={styles.emptyStateText}>
        {t('home.empty.text')}
      </ThemedText>
      <TouchableOpacity
        style={[styles.emptyStateButton, { backgroundColor: colors.tint }]}
        onPress={navigateToCreateAccount}
        activeOpacity={0.8}>
        <Text style={[styles.emptyStateButtonText, { color: colors.text }]}>{t('home.empty.button')}</Text>
      </TouchableOpacity>
    </ThemedView>
  );

  // Loading inicial
  if (loading) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={theme === 'dark' ? '#FFFFFF' : colors.tint} />
        <ThemedText style={styles.loadingText}>{t('home.loading')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header Mejorado */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <ThemedText type="title" style={styles.headerTitle}>
                {t('home.title')}
              </ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                {accounts.length === 0
                  ? t('home.no.finances')
                  : `${accounts.length} ${accounts.length === 1 ? t('home.subtitle.singular') : t('home.subtitle')}`}
              </ThemedText>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={[styles.settingsButton, { backgroundColor: colors.background + '20' }]}
                onPress={() => setShowSettingsModal(true)}
                activeOpacity={0.7}>
                <MaterialIcons name="settings" size={24} color={colors.tint} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Lista de Cuentas */}
        <FlatList
          data={accounts}
          renderItem={renderAccountCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            accounts.length === 0 && styles.listContentEmpty,
            { backgroundColor: colors.background },
          ]}
          style={{ backgroundColor: colors.background }}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          removeClippedSubviews={false}
        />

        {/* FAB (Floating Action Button) */}
        {accounts.length > 0 && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.tint }]}
            onPress={navigateToCreateAccount}
            activeOpacity={0.8}>
            <Text style={[styles.fabText, { color: '#FFFFFF' }]}>+</Text>
          </TouchableOpacity>
        )}

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
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    // backgroundColor handled inline
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
    paddingTop: 34,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    gap: 6,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 44,
  },
  headerSubtitle: {
    fontSize: 15,
    opacity: 0.6,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsButton: {
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 20,
    // backgroundColor handled inline
  },
  listContentEmpty: {
    flex: 1,
  },
  accountCard: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  accountCardContent: {
    padding: 24,
    gap: 20,
  },
  accountCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  accountCardTitleRow: {
    flex: 1,
    gap: 12,
  },
  accountCardTitleContainer: {
    gap: 4,
  },
  accountCardName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  accountCardType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  accountCardTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountCardCurrency: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  accountCardCurrencyText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  accountCardBalance: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  accountCardBalanceLabel: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountCardBalanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyStateTitle: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 24,
  },
  emptyStateText: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 16,
    lineHeight: 24,
  },
  emptyStateButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    ...Platform.select({
      ios: {
        // shadowColor handled via theme
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '700',
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
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  fabText: {
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
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
        // shadowColor handled via theme
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
