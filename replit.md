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

## User preferences

(none yet)
