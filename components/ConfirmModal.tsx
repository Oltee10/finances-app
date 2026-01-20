/**
 * ConfirmModal - Componente reutilizable para confirmaciones
 * 
 * Reemplaza Alert.alert y window.confirm con una UI consistente
 * en todas las plataformas (Web, iOS, Android).
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonStyle?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
  cancelable?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmButtonStyle = 'default',
  onConfirm,
  onCancel,
  cancelable = true,
}: ConfirmModalProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const handleBackdropPress = () => {
    if (cancelable) {
      onCancel();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onCancel}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleBackdropPress}>
        <ThemedView
          style={[styles.modalContainer, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              {title}
            </ThemedText>
            {cancelable && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onCancel}
                activeOpacity={0.7}>
                <MaterialIcons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            )}
          </View>

          {/* Message */}
          <View style={styles.body}>
            <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </ThemedText>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { borderColor: colors.border },
              ]}
              onPress={onCancel}
              activeOpacity={0.7}>
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor:
                    confirmButtonStyle === 'destructive'
                      ? colors.error
                      : colors.tint,
                },
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.confirmButtonText,
                  { color: colors.buttonTextOnTint },
                ]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
    borderRadius: 8,
  },
  body: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cancelButton: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    // backgroundColor handled inline
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
