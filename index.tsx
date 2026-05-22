import '@expo/metro-runtime';
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

async function start() {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.40.0/bin/full/${file}`,
    });
  }
  const { App } = await import('./src/App');
  registerRootComponent(App);
}

start();
