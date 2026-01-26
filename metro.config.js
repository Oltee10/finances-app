// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Priorizar archivos .cjs (CommonJS) para evitar problemas con yield import
// Los archivos .cjs de Firebase NO tienen el error del "yield import"
config.resolver.sourceExts = ['cjs', ...config.resolver.sourceExts];

// Configurar transformer para transformar todas las dependencias
// Esto asegura que el código problemático se transforme antes de llegar a Hermes
config.transformer = {
  ...config.transformer,
  // Transformar todas las dependencias, incluyendo node_modules
  unstable_allowRequireContext: true, // Habilitado para expo-router
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Configurar resolver para transformar dependencias problemáticas
config.resolver = {
  ...config.resolver,
  sourceExts: ['cjs', ...config.resolver.sourceExts],
};

module.exports = config;