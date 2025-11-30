const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Make Metro aware of the shared package that lives outside the React Native app
config.watchFolders = [
  path.resolve(__dirname, '..', 'shared'),
];

module.exports = withNativeWind(config, { input: './global.css' });

