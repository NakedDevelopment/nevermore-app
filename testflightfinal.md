# TestFlight — Build 99 (iOS)

**Date:** 2026-07-10
**Branch:** `master`
**App version:** see `app.json` (`expo.version`) · **iOS build number:** `99`
**Bundle ID:** `com.nevermore.app` · **ASC App ID:** `6754863979` · **Apple Team:** `C5DF3CP9LJ`

Build kicked off with:

```bash
eas build --platform ios --profile production --non-interactive --auto-submit
```

`production` profile has `autoIncrement: true`, so EAS bumped the iOS build number
`98 → 99` automatically at build time and `--auto-submit` sends it to TestFlight
after the cloud build finishes.

---

## What's in this build

### 1. Onboarding: trial screen goes straight to home (no paywall)
`src/navigation/screens/TrialWelcome.tsx`
- Removed the **"Not now"** secondary button.
- **"Start my 3 free days"** now navigates directly to `HOME_TABS` — the paywall
  (Subscription screen) is no longer shown during onboarding.
- The trial still starts server-side (`startTrial`) and `completeOnboarding()` still runs.
- Monetization is not dead-ended: the Subscription screen is still reachable from the
  **Drawer menu** and is force-shown by the **TrialExpired** hard-block when the trial ends.

### 2. Audio fix: heavy streamed track resume/return hang (cellular)
`src/contexts/AudioPlayerProvider.tsx`

**Reported bug:** First play of a heavy streamed track (e.g. "Internal Thoughts") on
cellular works, but (a) pausing then playing again, or (b) switching to other audio and
coming back, hangs on the loading spinner forever and never starts.

**Root cause:** A `keepAudioSessionActive` player keeps its `AVPlayerItem` and the live
network fetch of its remote URL alive even after `pause()`. The outgoing player was only
paused and removed later in a post-render effect, so it was still fetching the same heavy
file when the fresh player called `play()` — the two streams fought over the weak cellular
pipe and the fresh one never buffered. The return-to-track case (no seek, plays from 0,
still hung) confirmed contention — not the seek — is the cause.

**Fix:**
- `swapToFreshPlayer` now `remove()`s the outgoing player **synchronously, before** creating
  the fresh one, and keeps `prevPlayerRef` in sync (the post-render disposal effect becomes
  a safety-net no-op).
- The pause→resume branch calls `play()` **first**, then does a best-effort non-awaited
  `seekTo(pos)`, so an unbufferable cold-remote seek can no longer hang playback either.

**Intentionally NOT changed:** the slow-connection warning and the download button were left
as-is (not expanded) — per request, they are not the fix for this.

### Difference from the abandoned build-97 attempt
Build 97 also freed the pipe but *kept* the awaited cold-seek before `play()`, so it would
still have hung on pause→resume (likely why "95 felt better"). This build adds the
non-awaited-seek fix that attempt lacked.

---

## Commits in this build

- `e55dfbb` Fix heavy-audio resume/return hang: free the pipe before the fresh player's play()
- `900147a` Onboarding trial screen goes straight to home; revert build-97 audio changes

---

## Testing checklist (real device on cellular — cannot be verified in simulator/WiFi)

- [ ] First play of "Internal Thoughts" on cellular starts.
- [ ] Pause, then play again → resumes (may re-buffer / restart from start, but does NOT hang).
- [ ] Play heavy audio → switch to another track → return to heavy audio → plays (no hang).
- [ ] Onboarding: "Start my 3 free days" lands on Home with no paywall; "Not now" is gone.
- [ ] Trial access works after onboarding; Subscription still reachable from Drawer menu.
- [ ] After trial expiry, TrialExpired hard-block routes to Subscription.

---

## Status

- [x] Code committed and pushed to `master`
- [x] `eas build --platform ios --profile production --auto-submit` started
- [ ] Cloud build finished
- [ ] Submitted to TestFlight / processing in App Store Connect
- [ ] Verified on device (see checklist above)
