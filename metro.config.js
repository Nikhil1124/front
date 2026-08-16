const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('jpg', 'jpeg', 'png');

module.exports = config;
