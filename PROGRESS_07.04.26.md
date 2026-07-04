# Progress notes — 2026-07-04 (audio bugs + pre-launch audit)

Branch: `codex-fix-subscription-40-day-regressions`. Point a future Claude Code
session at this file to pick up exactly where this session left off.

## What this session did

1. Full read-through audit of the audio player (`AudioPlayerProvider.tsx`,
   `audioCache.service.ts`, and every screen that consumes it) plus a
   broader pre-launch readiness audit (subscriptions/IAP, navigation gating,
   build config, env/secrets, crash safety, native permissions).
2. Fixed the environment: `node_modules` was stale from before the
   RevenueCat migration (commit `5f72387`) and didn't have
   `react-native-purchases`/`react-native-purchases-ui` installed, so nothing
   could build in this sandbox. Ran `npm install` — lock files already had
   the right versions, this was just a local sync issue. **Confirm your own
   machine/CI has run `npm install` since that commit too.**
3. Fixed 5 audio bugs, 4 subscription/navigation bugs, added a crash safety
   net, and restyled the Trial Expired screen's sign-out flow. Details below.
4. Verified everything with `npx tsc --noEmit` (no new errors — the ones
   that remain are pre-existing and unrelated, listed below) and
   `npx expo export --platform android` (full JS bundle, 2893 modules,
   builds clean).
5. **Could not do on-device testing** — this sandbox has no iOS
   simulator/Android emulator. Everything below is verified by code
   reading + type-checking + successful bundling, not by actually pressing
   play on a device. Test the audio flows for real before shipping.

## Fixes made

### Audio player (`src/contexts/AudioPlayerProvider.tsx`)

- **NaN seek crash**: `seekForward`/`seekTo` guarded against
  `player.duration === 0` but not `NaN`. During the ~seconds-long window
  after playback starts while duration is still resolving, `duration` is
  `NaN`, not `0` — tapping forward/seek in that window called
  `player.seekTo(NaN)`. Now checks `!isFinite(duration) || duration <= 0`.
- **Streaming-failure false positives**: the fallback-to-cache check
  (`isStreamingCleanly`/`waitForPlaybackProgress`, added in the previous
  session's `4c23f18` fix for corrupted Support-tab audio metadata) only
  waited ~2.1s for duration to resolve before assuming the stream was
  broken and forcing a full re-download. Widened to ~6s so a legitimately
  slow connection doesn't get misdiagnosed and forced through an
  unnecessary re-download mid-playback. **This is a judgment-call tradeoff,
  not a proof — please verify on a throttled connection.**
- **`play()` didn't cancel in-flight operations**: every other mutator
  (`pause`, `stop`, `loadAudio`, `loadAndPlay`, `unloadAudio`) bumps
  `operationIdRef` to invalidate stale async work; `play()` didn't, so a
  fast double-tap could double-fire `player.play()`/`onPlayStart()`. Now
  matches the same operation-id pattern as the rest of the file.
- **Audio session reconfigured on every AppState change**, including
  going to background/inactive — risked fighting the OS's own interruption
  handling (e.g. a phone call). Now only reconfigures on return to
  `'active'`.

### Cross-tab control leakage (`src/navigation/screens/TemptationDetails.tsx`)

Recovery and Support tabs share the same global `main` audio channel.
`onPlayPause` already checked `isActiveMainTrack` before acting, but
`onRewind`/`onForward`/`onStop`/`onSeek` didn't — so playing Recovery audio,
switching to the Support tab (which shows paused/00:00 since the URL
differs), then tapping Stop/Rewind/Forward/Seek would silently act on the
Recovery track still playing in the background. Added
`handleMainRewind/Forward/Stop/Seek` wrappers that no-op unless
`isActiveMainTrack` is true, matching the pattern Play/Pause already used.

### Subscription / RevenueCat (`src/services/iap.service.ts`)

- **Fragile entitlement matching**: `hasActiveEntitlement` matched against a
  hardcoded list of guessed entitlement-name strings
  (`'Lou Knows LLC Pro'`, `'lou_knows_llc_pro'`, `'lou-knows-llc-pro'`,
  `'pro'`). If the real RevenueCat entitlement identifier configured in the
  dashboard doesn't match any of those exactly, **every** subscription
  check/restore silently fails for **every** user — this is your "restore
  purchase logic" fix. Since the app has exactly one paid tier, it now
  checks for **any** active entitlement instead of matching a name. This
  can't produce a false negative regardless of what the dashboard names the
  entitlement.
  - I did **not** apply the same "just accept anything" fix to product-id
    matching (`REVENUECAT_PRODUCT_IDS`) — I initially tried wiring in the
    `IAP_PRODUCT_ID_MONTHLY`/`YEARLY` env vars but caught that those are
    leftover **App Store/Play Store** product ids from the old
    `react-native-iap` integration (`com.nevermore.app.subscriptions.monthly`),
    not RevenueCat's product ids. Per `REVENUECAT_SETUP.md`, RevenueCat's own
    product ids are literally `monthly`/`yearly` — left that hardcoded as-is,
    it's correct per your own setup doc.
- **Duplicate init race**: `App.tsx` fires `iapService.init()` and
  `checkAuth()` (which internally triggers a subscription check) without
  awaiting each other, so `ensureConfigured()` could be entered twice
  concurrently, each calling `Purchases.configure()` and registering its own
  duplicate `customerInfoListener`. Added an in-flight-promise lock so
  concurrent callers share one configure attempt.
- Updated `REVENUECAT_SETUP.md`'s entitlement-fallback paragraph to match
  the new "any active entitlement" behavior.

### Trial-expired hard lock (`src/navigation/index.tsx`)

The existing `maybeBlockExpiredTrial` effect only ever navigated **to**
`TrialExpired`, never away from it. A subscriber who landed there from a
slow/stale subscription check — or whose entitlement gets granted while
sitting on the screen (e.g. restored on another device) — had no way out
except manually tapping Restore Purchase successfully. Added a
complementary effect: once `isSubscribed` (or shared access) becomes true
while on `TrialExpired`, it auto-resets to `HOME_TABS`.

### Trial Expired screen (`src/navigation/screens/TrialExpired.tsx`)

Replaced the plain unstyled "Log out" text link with a proper bordered
button (icon + label, matching the app's button language) gated behind the
same `ConfirmationModal` component `DrawerMenu.tsx` already uses for sign-out,
so it's not a stray unconfirmed destructive action and looks intentional
next to Subscribe/Restore Purchase.

### Crash safety net (`src/components/ErrorBoundary.tsx`, `src/App.tsx`)

There was **no error boundary or crash reporting anywhere in the app** — any
render-time exception white-screened with zero recovery path and zero
telemetry. Added a minimal `ErrorBoundary` (no new dependency) wrapping the
whole app root, with a "Try Again" fallback screen. This is **not** a
replacement for real crash reporting (Sentry/Bugsnag) — see Outstanding
items below.

## Verified but NOT fixed (needs your input first)

- **RevenueCat API keys are missing from every EAS environment.** Confirmed
  directly via `eas env:list --environment production/preview/development`
  — none of the three have `REVENUECAT_API_KEY`/`_IOS`/`_ANDROID` set, and
  the local `.env` doesn't have them either. Right now, in every build
  profile, `iap.service.ts`'s `ensureConfigured()` will warn and return
  false, silently disabling all purchasing. **This is the top priority
  before any real build** — you'll add these once you're in the RevenueCat
  dashboard (see "Android build + RevenueCat" below).
- `react-native-iap` (old library, pre-RevenueCat) is still a dependency and
  an Expo config plugin in `app.json`, but zero code references it anymore.
  Left it in place since removing a native config plugin changes native
  linking on next prebuild and I can't verify a native build in this
  sandbox — recommend removing it once you've confirmed a build works fine
  without it.
- No real crash reporting (Sentry/Bugsnag/etc.) — the ErrorBoundary above is
  a safety net, not telemetry. Needs you to pick a service and add an
  account/DSN.
- `.env` (Appwrite project/database/collection IDs, no actual secrets) is
  committed to git history since `68b0916`. Not a live credential leak, but
  worth a conscious decision if this repo is ever made public.
- iOS bundle id `com.nevermore.app` vs Android package `com.nevermoreapp` —
  inconsistent, but changing either now has store-listing implications
  (Android package name especially can't change after first upload) —
  flagging only, not touching.
- Lower-priority audio items not touched: 32-bit non-cryptographic cache-key
  hash in `audioCache.service.ts` (collision risk, low at current catalog
  size); no cache eviction policy (audio cache grows unbounded on-device);
  `fallBackToCachedPlayback` doesn't re-verify the fallback itself
  succeeded.
- Pre-existing `tsc --noEmit` errors, untouched (none are new, none block
  Metro bundling — confirmed via the successful `expo export` above):
  `Button.tsx`/`SecondaryButton.tsx` style-indexing type errors,
  `TemptationBottomSheet.tsx`'s `card-bg.png` import (type-checker quirk
  only — bundling proved it resolves fine), `useAppNavigation.tsx`/
  `Welcome.tsx` navigation typing, and `storage.service.ts` (dead file, not
  imported anywhere, references `expo-file-system/legacy`).

## Files touched this session

`src/contexts/AudioPlayerProvider.tsx`, `src/navigation/screens/TemptationDetails.tsx`,
`src/navigation/screens/TrialExpired.tsx`, `src/navigation/index.tsx`,
`src/services/iap.service.ts`, `src/App.tsx`, `src/components/ErrorBoundary.tsx` (new),
`REVENUECAT_SETUP.md`.

## Next steps (in order)

1. You: go through RevenueCat dashboard setup per `REVENUECAT_SETUP.md`,
   grab the real API keys, add them to EAS env (production at minimum) —
   I'll guide this when you're ready.
2. On-device test: play/pause/rewind/seek across Recovery ↔ Support tab
   switches, a slow-network stream, backgrounding during playback, and a
   phone-call interruption.
3. On-device test: trial-expired screen — sign out button, restore purchase
   with a real sandbox subscriber, and confirm the auto-recovery navigation
   fires if you grant an entitlement while sitting on that screen.
4. Decide on `react-native-iap` removal and a crash reporting service.
5. Push an Android build — see below.

## How to push an Android build

Prereqs already in place: `eas.json` has `production`/`preview`/`development`
build profiles, and a `submit.production.android` config pointing at
`./play-service-account.json` (a Google Play service-account key file — not
in this repo, you'll need to supply it locally or as an EAS credential
before running `eas submit`). `eas whoami` shows this environment is already
authenticated as `vardvered`.

**1. Fix the RevenueCat blocker first** (see above) — an Android build
without those EAS env vars ships with subscriptions silently disabled.

**2. Build:**
```bash
eas build --platform android --profile production
```
This runs Continuous Native Generation (no committed `android/` folder),
pulls in the `production` profile's env vars from EAS, and produces an
`.aab` (app bundle) per `eas.json`'s `"buildType": "app-bundle"`. Use
`--profile preview` first for an internal `.apk` if you want to test on a
real device before the store-bound build (preview builds an APK, easier to
sideload).

**3. Bump the version before building** — `app.json`'s
`android.versionCode`/`ios.buildNumber` should be incremented (production
profile has `"autoIncrement": true` for the build number, but double check
`android.versionCode` policy matches what Play Console expects).

**4. Submit to Play Console:**
```bash
eas submit --platform android --profile production
```
Needs `play-service-account.json` (Google Cloud service account with Play
Android Developer API access) present at the repo root or wherever
`eas.json`'s `serviceAccountKeyPath` points. Current config uses
`track: "internal"` and `releaseStatus: "draft"` — so this uploads to the
**internal testing track as a draft**, not straight to production. You
review and promote the release manually in Play Console from there.

**5. First-time Play Console setup** (if this is the first submission ever):
you'll need the app already created in Play Console with a package name
matching `com.nevermoreapp`, at least one manually-uploaded build to
establish the app before `eas submit` can push subsequent ones via API, and
the data-safety form / content rating / store listing filled in — none of
that is scriptable, it's manual Play Console work.

**6. Sanity check before submitting**: run `npx expo-doctor` — it currently
flags duplicate lock files (`yarn.lock` + `package-lock.json`, pick one) and
duplicate native `react-native`/`expo-file-system` versions pulled in via
`react-native-appwrite`. Neither is fatal but worth resolving so EAS Build
doesn't pick the wrong lockfile.

## Update — same day, later session: build status + Android signing blocker

### Build status checked

Latest EAS builds at time of check, both from commit `4c23f18` (the last
**committed** commit — does **not** include this file's uncommitted audio/
subscription fixes):

- iOS build `2f777d74` — build #78, app v1.0.2 — **FINISHED**
  (2026-07-03 23:36→23:43 UTC).
- Android build `5bdce421` — build #3, app v1.0.2 — **FINISHED**
  (2026-07-03 23:39→00:09 UTC).

### iOS submitted to App Store Connect

Ran `eas submit --platform ios --profile production --latest --non-interactive`
— succeeded. Build #78 uploaded to App Store Connect
(https://appstoreconnect.apple.com/apps/6754863979/testflight/ios), Apple
processing takes ~5-10 min, email notification on completion. This used the
ASC API Key already stored on EAS servers (`[Expo] EAS Submit l_guoNAUpI`,
Key ID `23UNZT8YGW`) — no local Apple credentials needed.

**Caveat carried over from the RevenueCat blocker above: this build does not
have RevenueCat API keys in EAS env, so purchasing is silently disabled in
whatever Apple reviews/ships from build #78.**

### Android: NEW blocker — upload key mismatch, can't submit via `eas submit` OR manual upload

User doesn't yet have Play Console permissions to manage app-signing keys /
create the `play-service-account.json` needed for automated `eas submit`, so
the plan was to hand them the raw `.aab` (from build #3,
`https://expo.dev/artifacts/eas/85GrsUaaxZRiLyyv1sff8dGw6lNjsVMDkubURZEGdK8.aab`,
expires 2026-08-02) to upload manually in Play Console.

That manual upload was **rejected** by Play Console:

> Набор Android App Bundle подписан с помощью неправильного ключа... должен
> быть подписан сертификатом с цифровым отпечатком
> **SHA1: 8B:2B:F6:50:25:CE:0B:4D:76:6A:11:60:57:BF:A0:D6:E4:90:41:14**
> Однако для загруженного набора используется сертификат с отпечатком
> **SHA1: 00:84:4B:D0:E2:31:41:72:BF:F9:85:05:EF:26:F0:11:AC:22:2F:1B**

This is an **upload-key certificate mismatch**, not an app-signing-key issue.
Play Console already has an upload key registered
(`8B:2B:F6:50:...`) from an earlier release of this app, and EAS's
auto-generated Android keystore for this project produces
`00:84:4B:D0:...` — every EAS Android build (including #2 and #3 above) is
signed with the wrong key and will be rejected the same way, whether
submitted via `eas submit` or uploaded by hand.

Confirmed with the user: **yes, this app was uploaded to Play Console before**
by someone else (possibly under the `Lou Knows LLC` branding that still shows
up in the RevenueCat entitlement name — see `REVENUECAT_SETUP.md`) — so the
original keystore exists somewhere, just not in this repo or in EAS's stored
credentials. Searched the repo for any `.jks`/`.keystore` file or reference —
none found. No `credentials.json` either. EAS's Android keystore is not
inspectable non-interactively (`eas credentials` is a TUI, doesn't support
`--non-interactive` or `--json`; couldn't get a fingerprint dump from this
sandbox — would need to run it in a real interactive terminal).

**Resolution path (in priority order), needs the user, not code changes:**

1. **Find the original keystore.** Ask whoever originally set up the Play
   Console listing / had upload access before EAS (the `Lou Knows LLC`
   connection is the lead) for the `.jks`/`.keystore` file plus its store
   password, key alias, and key password.
2. **Import it into EAS** once found:
   `eas credentials --platform android` → `production` profile → keystore
   management → "Set up a new keystore" → "I want to upload my own file".
   Then rebuild (`eas build --platform android --profile production`) — the
   new `.aab` will carry the matching `8B:2B:F6:50:...` fingerprint.
3. **If the original keystore is truly lost**, Google's recovery path is
   Play Console → app → Test and release → Setup → App integrity → App
   signing → "Request upload key reset". Requires Play Console **Account
   Owner** permissions (the user doesn't have this yet) and Google approval
   (typically a few days). After approval, a new upload key (EAS's existing
   auto-generated one is fine) becomes valid going forward.

**Still open — pick up here next session:** waiting on user to track down who
holds the original keystore, or to get Play Console Owner access to request
a key reset. Until one of those resolves, **no Android build can be
submitted**, manually or via `eas submit`.

## Update — client complaint confirms live audio regression on build #78

Client-reported symptom (iOS TestFlight build #78, which is commit `4c23f18`
— does **not** include this session's uncommitted fixes below):

- 40-Day Challenge: audio plays, but the time counter under the play button
  stays frozen (showing the full duration, e.g. `2:15`, instead of counting).
  Tapping play, audio is audible immediately, but the button shows a loading
  spinner; once the spinner resolves to the pause icon, **the audio restarts
  from the beginning**.
- 40 Temptations → Support tab: same pattern — audio audible, play button
  stuck in a loading spinner, restarts once it flips to pause.

**This is the "Streaming-failure false positives" bug already diagnosed
earlier in this same session** (see Fixes made → Audio player, above) — the
client report is real-world confirmation of it, not a new bug:

1. `loadAndPlay` starts playing the remote stream directly — that's the
   audio the client hears.
2. `waitForPlaybackProgress` then polls for `player.playing && currentTime
   > 0.05`. In the **shipped** build #78 code this window is only ~2.1s (14
   attempts × 150ms).
3. For some streamed tracks (extensionless Support-tab URLs especially),
   native duration/position metadata resolves slower than that even though
   audio is already audibly playing — so the 2.1s check times out and the
   code wrongly concludes the stream is broken.
4. `fallBackToCachedPlayback` then fires: shows the loading spinner, pauses
   the stream, downloads the file fresh into the cache, and replays it —
   **always from position 0, with no attempt to preserve where playback
   already was**. That forced restart-from-0 is exactly what the client is
   describing as "loading circle, then audio restarts."

**Status of the fix:** the uncommitted change to `AudioPlayerProvider.tsx`
in this session's working tree (`isStreamingCleanly` + widening the wait
from ~2.1s to ~6s, 30×200ms) directly targets step 3 and will make this far
less frequent. **It does not fully close the gap** — a genuinely slow
connection can still exceed 6s, and even then `fallBackToCachedPlayback`
will still restart from 0 rather than resuming at the position streaming
had already reached (step 4 is untouched). Given this is now a confirmed
live client complaint rather than a theoretical read-through finding, this
should be **treated as the top priority to ship**, ahead of the RevenueCat
env-key and Android signing items above:

1. Commit and build this fix (plus the rest of this session's audio/
   subscription fixes, already verified via `tsc`/`expo export` above) —
   get it in front of the client on a new TestFlight build as soon as
   possible.
2. **Done, same session:** `fallBackToCachedPlayback` now captures
   `player.currentTime` right before pausing the stream, and `playResolvedSource`
   (shared with the normal load path via a new optional `resumeFromSec` param)
   seeks the newly-loaded cached file to that position before calling `play()`,
   instead of always resetting to 0. A track that never got past `currentTime`
   0 (the genuine corrupted-metadata case) still resumes at 0 — no behavior
   change there — but a track that was already audibly streaming now resumes
   where the user heard it, removing the restart-from-scratch even on the
   cases where the timeout-based fallback still legitimately fires. Seek is
   wrapped in a try/catch since some platforms may reject a seek before the
   freshly-replaced source reports ready; on failure it silently falls back
   to playing from 0 rather than throwing. Verified with `tsc --noEmit` (no
   new errors). Still needs on-device verification — same caveat as the rest
   of this file's audio changes, this sandbox has no simulator/emulator.
