// babel.config.js
module.exports = function (api) {
    api.cache(true);
    return {
      presets: [
        [
          'babel-preset-expo',
          {
            // Asegura que las transformaciones sean compatibles con Hermes
            jsxRuntime: 'automatic',
          },
        ],
      ],
      plugins: [],
    };
  };