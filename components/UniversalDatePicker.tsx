/**
 * UniversalDatePicker - Componente de selección de fecha compatible con Web y Mobile
 * 
 * En Web: usa un input HTML tipo date
 * En Mobile: usa @react-native-community/datetimepicker
 */

import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';

// Importar DateTimePicker solo en plataformas móviles
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

export interface UniversalDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'compact' | 'inline';
  locale?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  textColor?: string;
  themeVariant?: 'light' | 'dark';
  style?: any;
}

export function UniversalDatePicker({
  value,
  onChange,
  mode = 'date',
  display,
  locale,
  minimumDate,
  maximumDate,
  textColor,
  themeVariant,
  style,
}: UniversalDatePickerProps) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  if (Platform.OS === 'web') {
    // En Web, usar un input HTML nativo tipo date
    const dateString = value.toISOString().split('T')[0];
    
    // Usar React.createElement para crear un input HTML nativo
    return React.createElement('input', {
      type: 'date',
      value: dateString,
      onChange: (e: any) => {
        if (e.target.value) {
          onChange(new Date(e.target.value));
        }
      },
      min: minimumDate?.toISOString().split('T')[0],
      max: maximumDate?.toISOString().split('T')[0],
      style: {
        height: '50px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        fontSize: '16px',
        backgroundColor: colors.inputBackground || colors.background,
        color: colors.text,
        borderColor: colors.border || colors.icon,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      },
    });
  }

  // En Mobile, usar DateTimePicker nativo
  if (!DateTimePicker) {
    return null;
  }

  return (
    <DateTimePicker
      value={value}
      mode={mode}
      display={display || (Platform.OS === 'ios' ? 'spinner' : 'default')}
      locale={locale}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      textColor={textColor || (theme === 'dark' ? '#FFFFFF' : '#000000')}
      themeVariant={themeVariant || theme}
      onChange={(event: any, selectedDate?: Date) => {
        if (selectedDate) {
          onChange(selectedDate);
        }
      }}
      style={style}
    />
  );
}
