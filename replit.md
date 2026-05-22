# Nevermore App

Expo / React Native mobile app (iOS + Android) with secondary web preview via React Native Web. Built on Expo SDK 54 with React Navigation, Appwrite backend, Zustand state, and react-native-iap subscriptions.

## Running on Replit

- Workflow `Start application` runs `npx expo start --web --port 5000 --clear` and serves the web preview on port 5000.
- The primary target is mobile (dev client / native build); the Replit web preview is a best-effort preview.

## Replit-specific setup notes

- `react-native-iap` is not web-compatible. `metro.config.js` aliases it to `src/services/iap.web.ts` (a stub) when `platform === 'web'`.
- `react-native-worklets` was pinned to `^0.6` to match the version range required by `react-native-reanimated`.
- Zustand 5 ships `import.meta.env` references in `zustand/esm/middleware.mjs` which break classic-script bundles. `scripts/patch-zustand.js` rewrites those references to a plain object literal and is wired up as a `postinstall` script so it re-runs after every install.

## Admin app (web-only)

A separate Vite + React + Tailwind admin SPA lives in `admin/` (cloned from
[NakedDevelopment/nevermore-admin-app](https://github.com/NakedDevelopment/nevermore-admin-app)).
It is web-only and is **not** bundled into the iOS/Android Expo builds.

- Workflow `Admin app` runs `cd admin && npm run dev` on port 5173.
- `admin/vite.config.ts` binds to `0.0.0.0:5173` with `allowedHosts: true` so the
  Replit proxy can serve it.
- `admin/.env` contains `VITE_APPWRITE_*` mirrors of the root `.env` Appwrite
  values. If you rotate any Appwrite ID / endpoint at the root, update
  `admin/.env` too.
- Admin access is gated by `prefs.role === 'admin'` on the Appwrite user.

## Deployment

- Configured as `static`. Build: `node scripts/patch-zustand.js && npx expo export --platform web`. Publish dir: `dist`.
- The admin app is **not** part of the mobile-app deployment. Deploy it
  separately (e.g. its own Replit deployment / Vercel) with build
  `cd admin && npm install && npm run build` and publish dir `admin/dist`.

## Running on a physical phone (EAS development build)

This app uses native modules (`react-native-iap`, `@shopify/react-native-skia`,
`react-native-reanimated`) so it **cannot run in stock Expo Go**. Use an EAS
development build — a one-time custom client you install on your phone that
includes the native modules, then JS reloads live via `npx expo start --dev-client`.

`eas.json` is committed at the project root with `development`, `preview`,
`production` profiles. Build steps run on your laptop, not in Replit, because
EAS uploads to Apple/Google and Replit's sandbox can't sign binaries.

### One-time setup (laptop)
1. `git clone` this repo to your laptop and `npm install`
2. `npm install -g eas-cli`
3. `eas login` (free Expo account — https://expo.dev)
4. `eas init` — links the local project to an Expo project ID (writes `extra.eas.projectId` into `app.json`)
5. iOS only: have an Apple Developer Program membership ($99/yr). EAS will auto-manage certs.

### Build the dev client
- iOS device: `eas build --profile development --platform ios`
- iOS simulator: `eas build --profile development-simulator --platform ios`
- Android: `eas build --profile development --platform android`

Each build takes ~15-25 min in Expo's cloud. You'll get a download link:
- iOS → install via TestFlight or direct device install (ad-hoc)
- Android → download the `.apk` and install

### Daily dev loop (after the client is on your phone)
1. Edit code in Replit (or your laptop)
2. Start Metro: `npx expo start --dev-client --tunnel`
   (use `--tunnel` when Metro and phone aren't on the same WiFi — required when running Metro from Replit)
3. Open the installed dev client on your phone → scan the QR
4. JS reloads live on save. Rebuild the client only when you add/remove native modules.

### Production builds for the stores
1. Bump `expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode` in `app.json`
2. `eas build --profile production --platform ios`
3. `eas build --profile production --platform android`
4. `eas submit --profile production --platform ios --latest`
5. `eas submit --profile production --platform android --latest` (requires `play-service-account.json` from Google Play Console, gitignored)
6. Finish review submission in App Store Connect / Play Console

### `eas.json` placeholders to fill in before first `eas submit`
- `submit.production.ios.appleId` — your Apple ID email
- `submit.production.ios.ascAppId` — App Store Connect app ID (visible in App Store Connect URL)
- `appleTeamId` is already set to `C5DF3CP9LJ`

## User preferences

(none yet)
