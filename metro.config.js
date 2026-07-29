const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'mjs' to sourceExts so Metro can resolve .mjs files
config.resolver.sourceExts.push('mjs');

module.exports = config;