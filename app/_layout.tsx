import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { WebContainer } from '@/components/WebContainer';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/contexts/ThemeContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

/**
 * Componente interno que maneja la navegación basada en autenticación
 */
function RootLayoutNav() {
  const { theme } = useTheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Verificar segmentos actuales
    const currentSegment = segments[0];
    const isLoginRoute = currentSegment === 'login';

    if (!user) {
      // Usuario no autenticado: solo puede acceder a login
      if (!isLoginRoute) {
        router.replace('/login');
      }
    } else {
      // Usuario autenticado: si está en login, redirigir a home
      if (isLoginRoute) {
        router.replace('/');
      }
    }
  }, [user, loading, segments, router]);

  // Mostrar loading spinner mientras se verifica el estado de autenticación
  if (loading) {
    const colors = Colors[theme];
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const stackContent = (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      <Stack.Screen
        name="account-create"
        options={{ presentation: 'modal', title: 'Nueva Cuenta', headerShown: false }}
      />
      <Stack.Screen
        name="account/[id]"
        options={{ title: 'Detalles de Cuenta', headerShown: false }}
      />
      <Stack.Screen
        name="account/[id]/transactions"
        options={{ title: 'Todas las transacciones', headerShown: false }}
      />
      <Stack.Screen
        name="account/[id]/transactions-filter"
        options={{ presentation: 'modal', title: 'Filtrar Transacciones', headerShown: false }}
      />
      <Stack.Screen
        name="transaction-add"
        options={{ presentation: 'modal', title: 'Nueva Transacción', headerShown: false }}
      />
    </Stack>
  );

  const navigationTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
  
  return (
    <ThemeProvider value={navigationTheme}>
      {Platform.OS === 'web' ? (
        <WebContainer>
          {stackContent}
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        </WebContainer>
      ) : (
        <>
          {stackContent}
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        </>
      )}
    </ThemeProvider>
  );
}

/**
 * Layout raíz que envuelve la app con AuthProvider
 */
export default function RootLayout() {
  return (
    <AppThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </LanguageProvider>
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
