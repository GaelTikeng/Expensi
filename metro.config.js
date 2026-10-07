// NativeWind 4: compiles global.css (Tailwind) for native and web.
// inlineRem 16 keeps rem-based sizes identical to the web (React Native Reusables expects it).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
