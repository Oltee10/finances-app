/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 * 
 * IMPORTANT: Light mode colors MUST match the current design exactly. Do not change them.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#0a7ea4'; // Keep same tint in dark mode but ensure contrast

export const Colors = {
  light: {
    // Text colors - PRESERVE EXACTLY AS IS
    text: '#11181C',
    textSecondary: '#687076',
    textMuted: '#687076',
    
    // Background colors - PRESERVE EXACTLY AS IS
    background: '#fff',
    card: '#fff',
    cardElevated: '#fff',
    
    // Border colors
    border: 'rgba(128, 128, 128, 0.1)',
    borderLight: 'rgba(128, 128, 128, 0.05)',
    borderDark: 'rgba(128, 128, 128, 0.2)',
    
    // Input colors
    inputBackground: '#fff',
    inputText: '#11181C',
    inputBorder: '#687076',
    inputPlaceholder: '#687076',
    
    // Primary colors
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    
    // Button colors - Text on tint background (always white)
    buttonTextOnTint: '#FFFFFF',
    
    // Status colors (preserve for income/expense)
    success: '#34C759',
    error: '#FF3B30',
    warning: '#FF9500',
    
    // Shadow
    shadow: '#000',
  },
  dark: {
    // Text colors - High contrast for readability
    text: '#FFFFFF',
    textSecondary: '#E0E0E0',
    textMuted: '#B0B0B0',
    
    // Background colors - Material Dark
    background: '#121212',
    card: '#1E1E1E',
    cardElevated: '#2C2C2C',
    
    // Border colors
    border: '#333333',
    borderLight: '#2A2A2A',
    borderDark: '#404040',
    
    // Input colors - Critical for visibility
    inputBackground: '#2C2C2C',
    inputText: '#FFFFFF',
    inputBorder: '#404040',
    inputPlaceholder: '#888888',
    
    // Primary colors
    tint: tintColorDark,
    icon: '#B0B0B0',
    tabIconDefault: '#B0B0B0',
    tabIconSelected: tintColorDark,
    
    // Button colors - Text on tint background (always white)
    buttonTextOnTint: '#FFFFFF',
    
    // Status colors (same as light for consistency)
    success: '#34C759',
    error: '#FF3B30',
    warning: '#FF9500',
    
    // Shadow
    shadow: '#000',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
