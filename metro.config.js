const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('jpg', 'jpeg', 'png');

// Alias MapLibre to JS mock so Expo Go bundles cleanly without native codegen errors
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@maplibre/maplibre-react-native': path.resolve(__dirname, 'src/components/maplibreMock.tsx'),
};

module.exports = config;
