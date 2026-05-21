const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Avoid Metro watching transient Replit agent dirs that may disappear mid-run.
config.resolver.blockList = [
  /\/\.local\/.*/,
  /\/\.cache\/.*/,
  /\/\.git\/.*/,
];
config.watchFolders = [
  path.resolve(__dirname, 'src'),
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, 'assets'),
].filter((p) => fs.existsSync(p));

// Add Skia support
config.resolver.alias = {
  ...config.resolver.alias,
  'react-native-skia': '@shopify/react-native-skia',
};

// Stub out native-only modules on web so Expo web preview can boot.
const webStubs = {
  'react-native-iap': path.resolve(__dirname, 'src/services/iap.web.ts'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webStubs[moduleName]) {
    return {
      filePath: webStubs[moduleName],
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
