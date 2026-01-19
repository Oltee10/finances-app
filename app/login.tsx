/**
 * Pantalla de Login/Register
 * 
 * UI limpia y centrada con StyleSheet.
 * Inputs: Username y Password (NO email visible al usuario).
 * Maneja login y registro con el mismo formulario.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

export default function LoginScreen() {
  const router = useRouter();
  const { theme, setThemeMode } = useTheme();
  const { user, loading, authenticating, error, login, register, clearError } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  
  const [isLogin, setIsLogin] = useState<boolean>(true); // true = login, false = register
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const colors = Colors[theme];

  // Redirigir si el usuario está autenticado
  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // Debug: Log cuando el error cambia para verificar que se establece
  useEffect(() => {
    console.log('Estado del error en LoginScreen:', error);
  }, [error]);

  // Limpiar errores cuando cambia el modo (login/register)
  // Usar useRef para rastrear el valor anterior y solo limpiar cuando realmente cambia
  const prevIsLoginRef = useRef(isLogin);
  useEffect(() => {
    if (prevIsLoginRef.current !== isLogin) {
      clearError();
      setUsernameError(null);
      setPasswordError(null);
      prevIsLoginRef.current = isLogin;
    }
  }, [isLogin]);

  /**
   * Traduce códigos de error de Firebase a mensajes amigables en español
   */
  const getFriendlyErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/invalid-credential':
        return 'Credenciales incorrectas.';
      case 'auth/user-not-found':
        return 'No existe una cuenta con este usuario.';
      case 'auth/wrong-password':
        return 'La contraseña es incorrecta.';
      case 'auth/email-already-in-use':
        return 'Este nombre de usuario ya está registrado.';
      case 'auth/invalid-email':
        return 'El formato del usuario no es válido.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Inténtalo más tarde.';
      default:
        return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    }
  };

  /**
   * Valida el formulario antes de enviar
   */
  const validateForm = (): boolean => {
    let isValid = true;

    // Validar username
    if (!username || username.trim().length === 0) {
      setUsernameError(t('login.validation.username.required'));
      isValid = false;
    } else if (username.trim().length < 3) {
      setUsernameError(t('login.validation.username.min'));
      isValid = false;
    } else {
      setUsernameError(null);
    }

    // Validar password
    if (!password || password.length === 0) {
      setPasswordError(t('login.validation.password.required'));
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError(t('login.validation.password.min'));
      isValid = false;
    } else {
      setPasswordError(null);
    }

    return isValid;
  };

  /**
   * Maneja el submit del formulario (login o register)
   */
  const handleSubmit = async (): Promise<void> => {
    // Limpiar errores previos de campos específicos
    setUsernameError(null);
    setPasswordError(null);
    // NO limpiar el error general aquí - se limpiará en login/register

    // Validar formulario
    if (!validateForm()) {
      return;
    }

    try {
      if (isLogin) {
        await login(username.trim(), password);
        // La redirección se maneja en el useEffect
      } else {
        await register(username.trim(), password);
        // La redirección se maneja en el useEffect
      }
    } catch (error: any) {
      // El error ya fue establecido en el AuthContext
      // No necesitamos hacer nada más aquí
      console.log('Error capturado en handleSubmit:', error);
    }
  };

  /**
   * Alterna entre modo login y registro
   */
  const toggleMode = (): void => {
    setIsLogin(!isLogin);
    setUsername('');
    setPassword('');
    clearError();
    setUsernameError(null);
    setPasswordError(null);
  };

  // Mostrar loading durante la verificación inicial de sesión
  if (loading) {
    return (
      <ThemedView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>{t('login.loading')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header con botón de ajustes */}
        <View style={[styles.topHeader, { backgroundColor: colors.background }]}>
          <View style={[styles.topHeaderContent, { backgroundColor: colors.background }]}>
            <View style={[styles.topHeaderSpacer, { backgroundColor: colors.background }]} />
            <TouchableOpacity
              style={[styles.settingsButton, { backgroundColor: colors.background + '20' }]}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.7}>
              <MaterialIcons name="settings" size={24} color={colors.tint} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={[styles.keyboardView, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={isInputFocused}
            showsVerticalScrollIndicator={false}
            style={{ backgroundColor: colors.background }}>
            <ThemedView style={[styles.content, { backgroundColor: colors.background }]}>
              {/* Título */}
              <ThemedView style={[styles.header, { backgroundColor: colors.background }]}>
                <ThemedText type="title" style={styles.title}>
                  {isLogin ? t('login.submit') : t('login.create')}
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {isLogin
                    ? t('login.subtitle.login')
                    : t('login.subtitle.register')}
                </ThemedText>
              </ThemedView>

          {/* Formulario */}
          <ThemedView style={[styles.form, { backgroundColor: colors.background }]}>
            {/* Input Username */}
            <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
              <ThemedText style={styles.label}>{t('login.username')}</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  usernameError && styles.inputError,
                  { color: colors.inputText, borderColor: usernameError ? colors.error : colors.inputBorder, backgroundColor: colors.inputBackground },
                ]}
                placeholder={t('login.username.placeholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setUsernameError(null);
                  // NO limpiar el error general - permanecerá visible hasta el próximo intento
                }}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authenticating}
              />
              {usernameError && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>{usernameError}</ThemedText>
              )}
            </View>

            {/* Input Password */}
            <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
              <ThemedText style={styles.label}>{t('login.password')}</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  passwordError && styles.inputError,
                  { color: colors.inputText, borderColor: passwordError ? colors.error : colors.inputBorder, backgroundColor: colors.inputBackground },
                ]}
                placeholder={t('login.password.placeholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(null);
                  // NO limpiar el error general - permanecerá visible hasta el próximo intento
                }}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!authenticating}
                onSubmitEditing={handleSubmit}
              />
              {passwordError && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>{passwordError}</ThemedText>
              )}
            </View>

            {/* Error general de autenticación - se muestra JUSTO ENCIMA del botón */}
            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: theme === 'dark' ? 'rgba(255, 59, 48, 0.15)' : '#ffebee' }]}>
                <Text style={[styles.errorMessageText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {/* Botón Submit */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                { backgroundColor: colors.tint },
                (authenticating || !username || !password) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={authenticating || !username || !password}>
              {authenticating ? (
                <ActivityIndicator size="small" color={colors.buttonTextOnTint} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.buttonTextOnTint }]}>
                  {isLogin ? t('login.submit') : t('login.create')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Login/Register */}
            <View style={[styles.toggleContainer, { backgroundColor: colors.background }]}>
              <ThemedText style={styles.toggleText}>
                {isLogin ? t('login.toggle.register') + ' ' : t('login.toggle.login') + ' '}
              </ThemedText>
              <TouchableOpacity onPress={toggleMode} disabled={authenticating}>
                <ThemedText style={[styles.toggleLink, { color: colors.tint }]}>
                  {isLogin ? t('login.toggle.link.register') : t('login.toggle.link.login')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>

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
              <View style={[styles.modalHeader, { backgroundColor: colors.background }]}>
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

              <View style={[styles.modalBody, { backgroundColor: colors.background }]}>
                {/* Opción: Apariencia */}
                <View style={[styles.settingsSection, { backgroundColor: colors.background }]}>
                  <View style={[styles.settingsSectionHeader, { backgroundColor: colors.background }]}>
                    <MaterialIcons name="palette" size={20} color={colors.tint} />
                    <ThemedText type="defaultSemiBold" style={styles.settingsSectionTitle}>
                      {t('settings.appearance')}
                    </ThemedText>
                  </View>
                  <View style={[styles.settingsOptions, { backgroundColor: colors.background }]}>
                    <TouchableOpacity
                      style={[
                        styles.settingsOption,
                        { borderColor: colors.border, backgroundColor: theme === 'light' ? colors.tint + '20' : colors.card },
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
                        { borderColor: colors.border, backgroundColor: theme === 'dark' ? colors.tint + '20' : colors.card },
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
                          theme === 'dark' ? { color: colors.tint } : { color: colors.text },
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
                <View style={[styles.settingsSection, { backgroundColor: colors.background }]}>
                  <View style={[styles.settingsSectionHeader, { backgroundColor: colors.background }]}>
                    <MaterialIcons name="language" size={20} color={colors.tint} />
                    <ThemedText type="defaultSemiBold" style={styles.settingsSectionTitle}>
                      {t('settings.language')}
                    </ThemedText>
                  </View>
                  <View style={[styles.settingsOptions, { backgroundColor: colors.background }]}>
                    <TouchableOpacity
                      style={[
                        styles.settingsOption,
                        { borderColor: colors.border, backgroundColor: language === 'es' ? colors.tint + '20' : colors.card },
                      ]}
                      onPress={() => setLanguage('es')}
                      activeOpacity={0.7}>
                      <ThemedText
                        style={[
                          styles.settingsOptionText,
                          language === 'es' ? { color: colors.tint } : { color: colors.text },
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
                        { borderColor: colors.border, backgroundColor: language === 'en' ? colors.tint + '20' : colors.card },
                      ]}
                      onPress={() => setLanguage('en')}
                      activeOpacity={0.7}>
                      <ThemedText
                        style={[
                          styles.settingsOptionText,
                          language === 'en' ? { color: colors.tint } : { color: colors.text },
                        ]}>
                        {t('settings.language.en')}
                      </ThemedText>
                      {language === 'en' && (
                        <MaterialIcons name="check" size={20} color={colors.tint} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ThemedView>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor handled inline
  },
  safeArea: {
    flex: 1,
    // backgroundColor handled via ThemedView
  },
  topHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  topHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  topHeaderSpacer: {
    flex: 1,
  },
  settingsButton: {
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
    // backgroundColor handled inline
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    gap: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 16,
  },
  form: {
    width: '100%',
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: 0,
  },
  inputError: {
    // Border color handled inline
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  errorMessageText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPrimary: {
    // Background color handled inline
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  toggleText: {
    fontSize: 14,
    opacity: 0.7,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '600',
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
    // backgroundColor and borderColor handled inline
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
