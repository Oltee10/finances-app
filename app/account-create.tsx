/**
 * Pantalla Modal para crear cuenta o unirse a grupo
 * 
 * Funcionalidades:
 * - Crear cuenta Individual o Group
 * - Unirse a cuenta de grupo con joinCode
 * - Generación automática de joinCode para grupos
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { createAccount, joinAccountByCode } from '@/services/accounts';
import type { AccountType, Currency } from '@/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const CURRENCIES: Currency[] = ['EUR', 'USD', 'COP'];
const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: 'Euro (€)',
  USD: 'Dólar ($)',
  COP: 'Peso Colombiano ($)',
};

export default function AccountCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: AccountType }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const colors = Colors[theme];

  // Estado del formulario de creación
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [accountName, setAccountName] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [accountType, setAccountType] = useState<AccountType>(
    (params.type as AccountType) || 'INDIVIDUAL'
  );
  const [joinCode, setJoinCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Si se pasa el tipo en la URL, establecerlo
  useEffect(() => {
    if (params.type && (params.type === 'INDIVIDUAL' || params.type === 'GROUP')) {
      setAccountType(params.type);
      setMode('create');
    }
  }, [params.type]);

  /**
   * Limpia el formulario
   */
  const resetForm = (): void => {
    setAccountName('');
    setCurrency('USD');
    setAccountType('INDIVIDUAL');
    setJoinCode('');
    setError(null);
  };

  /**
   * Cambia el modo entre crear y unirse
   */
  const toggleMode = (): void => {
    const newMode = mode === 'create' ? 'join' : 'create';
    setMode(newMode);
    resetForm();
  };

  /**
   * Valida el formulario de creación
   */
  const validateCreateForm = (): boolean => {
    if (!accountName || accountName.trim().length === 0) {
      setError('El nombre de la cuenta es requerido');
      return false;
    }

    if (accountName.trim().length < 2) {
      setError('El nombre de la cuenta debe tener al menos 2 caracteres');
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Valida el formulario de unión
   */
  const validateJoinForm = (): boolean => {
    if (!joinCode || joinCode.trim().length === 0) {
      setError('El código de unión es requerido');
      return false;
    }

    if (joinCode.trim().length !== 6) {
      setError('El código de unión debe tener 6 caracteres');
      return false;
    }

    setError(null);
    return true;
  };

  /**
   * Maneja la creación de cuenta
   */
  const handleCreateAccount = async (): Promise<void> => {
    if (!user) {
      Alert.alert('Error', 'No estás autenticado');
      return;
    }

    if (!validateCreateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createAccount(
        {
          name: accountName.trim(),
          type: accountType,
          currency,
        },
        user.id
      );

      // Éxito: cerrar modal y refrescar lista
      router.back();
    } catch (error: any) {
      const errorMessage = error.message || 'Error al crear la cuenta. Intenta de nuevo.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja la unión a grupo con joinCode
   */
  const handleJoinAccount = async (): Promise<void> => {
    if (!user) {
      Alert.alert('Error', 'No estás autenticado');
      return;
    }

    if (!validateJoinForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const code = joinCode.trim().toUpperCase();
      await joinAccountByCode(code, user.id);

      // Éxito: cerrar modal y refrescar lista
      router.back();
    } catch (error: any) {
      const errorMessage =
        error.message ||
        'Error al unirse a la cuenta. Verifica que el código sea correcto.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maneja el submit del formulario
   */
  const handleSubmit = async (): Promise<void> => {
    if (mode === 'create') {
      await handleCreateAccount();
    } else {
      await handleJoinAccount();
    }
  };

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
                {mode === 'create' ? t('account.create.title') : t('account.create.join')}
              </ThemedText>
              {mode === 'create' && (
                <TouchableOpacity onPress={toggleMode} style={styles.modeToggle}>
                  <ThemedText style={[styles.modeToggleText, { color: colors.tint }]}>
                    {t('account.create.join')} →
                  </ThemedText>
                </TouchableOpacity>
              )}
              {mode === 'join' && (
                <TouchableOpacity onPress={toggleMode} style={styles.modeToggle}>
                  <ThemedText style={[styles.modeToggleText, { color: colors.tint }]}>
                    ← {t('account.create.or.create')}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Formulario de Creación */}
            {mode === 'create' && (
              <View style={styles.form}>
                {/* Nombre de la cuenta */}
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>{t('account.create.name')}</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      { color: colors.text, borderColor: colors.icon },
                    ]}
                    placeholder="Ej: Mi Cuenta Personal"
                    placeholderTextColor={colors.icon}
                    value={accountName}
                    onChangeText={(text) => {
                      setAccountName(text);
                      setError(null);
                    }}
                    editable={!loading}
                  />
                </View>

                {/* Selector de Moneda */}
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>{t('account.create.currency')}</ThemedText>
                  <View style={styles.currencySelector}>
                    {CURRENCIES.map((curr) => (
                      <TouchableOpacity
                        key={curr}
                        style={[
                          styles.currencyButton,
                          currency === curr && [styles.currencyButtonActive, { backgroundColor: colors.tint, borderColor: colors.tint }],
                          !(currency === curr) && { borderColor: colors.icon },
                        ]}
                        onPress={() => {
                          setCurrency(curr);
                          setError(null);
                        }}
                        disabled={loading}>
                        <ThemedText
                          style={[
                            styles.currencyButtonText,
                            currency === curr && [styles.currencyButtonTextActive, { color: '#FFFFFF' }],
                          ]}>
                          {curr}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Selector de Tipo de Cuenta - Botones Horizontales */}
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>{t('account.create.type')}</ThemedText>
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        accountType === 'INDIVIDUAL' && [styles.typeButtonActive, { backgroundColor: colors.tint, borderColor: colors.tint }],
                        !(accountType === 'INDIVIDUAL') && { borderColor: colors.icon },
                      ]}
                      onPress={() => {
                        setAccountType('INDIVIDUAL');
                        setError(null);
                      }}
                      disabled={loading}>
                      <ThemedText
                        style={[
                          styles.typeButtonText,
                          accountType === 'INDIVIDUAL' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                        ]}>
                        {t('account.create.type.individual')}
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        accountType === 'GROUP' && [styles.typeButtonActive, { backgroundColor: colors.tint, borderColor: colors.tint }],
                        !(accountType === 'GROUP') && { borderColor: colors.icon },
                      ]}
                      onPress={() => {
                        setAccountType('GROUP');
                        setError(null);
                      }}
                      disabled={loading}>
                      <ThemedText
                        style={[
                          styles.typeButtonText,
                          accountType === 'GROUP' && [styles.typeButtonTextActive, { color: '#FFFFFF' }],
                        ]}>
                        {t('account.create.type.group')}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Error */}
                {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

                {/* Botón Crear */}
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonPrimary,
                    { backgroundColor: colors.tint },
                    (!accountName || loading) && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!accountName || loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{t('account.create.create')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Formulario de Unión */}
            {mode === 'join' && (
              <View style={styles.form}>
                {/* Input JoinCode */}
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Código de Unión</ThemedText>
                  <ThemedText style={styles.description}>
                    Ingresa el código de 6 caracteres proporcionado por el creador del grupo
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      styles.joinCodeInput,
                      { color: colors.text, borderColor: colors.icon },
                    ]}
                    placeholder="A1B2C3"
                    placeholderTextColor={colors.icon}
                    value={joinCode}
                    onChangeText={(text) => {
                      // Solo permitir letras y números, máximo 6 caracteres, en mayúsculas
                      const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
                      setJoinCode(cleaned);
                      setError(null);
                    }}
                    editable={!loading}
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                {/* Error */}
                {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

                {/* Botón Unirse */}
                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: colors.tint },
                    (joinCode.length !== 6 || loading) && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={joinCode.length !== 6 || loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>{t('account.create.join.button')}</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Botón Cancelar */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}>
              <ThemedText style={[styles.cancelButtonText, { color: colors.icon }]}>
                Cancelar
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
    gap: 8,
  },
  title: {
    textAlign: 'center',
  },
  modeToggle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    gap: 24,
    marginBottom: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  joinCodeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  currencySelector: {
    flexDirection: 'row',
    gap: 12,
  },
  currencyButton: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyButtonActive: {
    // backgroundColor and borderColor handled inline
  },
  currencyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.5,
  },
  currencyButtonTextActive: {
    // color handled inline
    opacity: 1,
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
  typeButtonActive: {
    // backgroundColor and borderColor handled inline
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
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPrimary: {
    // backgroundColor handled inline
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    // color handled inline
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: -8,
  },
});
