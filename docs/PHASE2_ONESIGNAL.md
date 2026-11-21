# Phase 2 — OneSignal & daily local messages

## Flow

1. User completes trial purchase on `TrialWelcome`.
2. `NotificationOptIn` shows the raven loop and explains the 40-message sequence.
3. **Turn on notifications** requests OS permission via `expo-notifications` (the 40 local messages depend on this). When `ONESIGNAL_APP_ID` is set, OneSignal init/permission runs best-effort for future remote push; failures (e.g. APNs/FCM not wired in OneSignal yet) are logged and never block local scheduling.
4. On grant, the app schedules 40 date-triggered local notifications via `expo-notifications` at **6:30 PM device-local time** (day 1 = today at 18:30 if opt-in is before 18:30, else tomorrow at 18:30).
5. Messages fire in strict order 1→40, then scheduling stops.

Louis Murray’s copy is in `src/constants/dailyPushMessages.ts` (sourced from the **Nevermore Optimization Phase 2** client deck, Nov 2026). The deck is not committed to git.

## Configuration

```bash
ONESIGNAL_APP_ID=<OneSignal app id>
```

Create one OneSignal app with both **iOS** (`com.nevermore.app`) and **Android** (`com.nevermoreapp`) platforms.

## Android small icon

`app.json` references `./src/assets/notification_icon_android.png` (raven). Play Store builds expect a **white silhouette on transparent** asset—replace with production art if OEMs tint poorly.

## Raven loop video

`RavenLoopAnimation` uses an animated `raven.png` placeholder until Louis ships the 6s seamless loop video from Final Cut.

## Operations

- OneSignal (optional): device registration, external user id = Appwrite user id, tags `daily_push_active` / `daily_push_next_day`. Email is not uploaded to OneSignal from the client.
- Delivery: client-scheduled local notifications (no server cron required for Phase 2).
- On sign-out: scheduled notifications are cancelled and push state resets.