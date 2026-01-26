// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Mantenemos tu configuración actual de JSX
          jsxRuntime: 'automatic',
        },
      ],
    ],
    plugins: [
      // ESTA LÍNEA ES LA QUE FALTA:
      'react-native-reanimated/plugin',
    ],
  };
};