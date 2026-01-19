/**
 * WebContainer - Wrapper para web que limita el ancho y centra el contenido
 * 
 * En web, simula una experiencia móvil con maxWidth: 480px centrado
 * En móvil/nativo, no aplica restricciones
 */

import React, { type ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ThemedView } from './themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface WebContainerProps {
  children: ReactNode;
}

export function WebContainer({ children }: WebContainerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (Platform.OS !== 'web') {
    // En móvil/nativo, renderizar directamente sin wrapper
    return <>{children}</>;
  }

  // En web, aplicar contenedor centrado con maxWidth
  return (
    <View style={[styles.webContainer, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.webContent}>
        {children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    width: '100%',
    ...Platform.select({
      web: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 0,
        margin: 0,
      },
    }),
  },
  webContent: {
    flex: 1,
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 600,
        minHeight: '100vh',
        alignSelf: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        position: 'relative',
        overflow: 'hidden',
      },
    }),
  },
});
