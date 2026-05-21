# Nevermore App

Expo / React Native mobile app (iOS + Android) with secondary web preview via React Native Web. Built on Expo SDK 54 with React Navigation, Appwrite backend, Zustand state, and react-native-iap subscriptions.

## Running on Replit

- Workflow `Start application` runs `npx expo start --web --port 5000 --clear` and serves the web preview on port 5000.
- The primary target is mobile (dev client / native build); the Replit web preview is a best-effort preview.

## Replit-specific setup notes

- `react-native-iap` is not web-compatible. `metro.config.js` aliases it to `src/services/iap.web.ts` (a stub) when `platform === 'web'`.
- `react-native-worklets` was pinned to `^0.6` to match the version range required by `react-native-reanimated`.
- Zustand 5 ships `import.meta.env` references in `zustand/esm/middleware.mjs` which break classic-script bundles. `scripts/patch-zustand.js` rewrites those references to a plain object literal and is wired up as a `postinstall` script so it re-runs after every install.

## Deployment

- Configured as `static`. Build: `node scripts/patch-zustand.js && npx expo export --platform web`. Publish dir: `dist`.

## User preferences

(none yet)
