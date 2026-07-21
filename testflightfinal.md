# TestFlight — Build 103 (iOS) + Android build (versionCode 9)

**Date:** 2026-07-20
**Branch:** `master`
**App version:** see `app.json` (`expo.version`, 1.0.2) · **iOS build number:** `103` · **Android versionCode:** `9`
**Bundle ID:** `com.nevermore.app` · **ASC App ID:** `6754863979` · **Apple Team:** `C5DF3CP9LJ`

Builds kicked off with:

```bash
eas build --platform ios --profile production --non-interactive --auto-submit --no-wait
eas build --platform android --profile production --non-interactive --no-wait
```

`production` profile has `autoIncrement: true`, so EAS bumps the iOS build number
`102 → 103` and the Android versionCode `8 → 9` automatically at build time.
`--auto-submit` sends the iOS build to TestFlight after the cloud build finishes.
**Android is built WITHOUT auto-submit**: `./play-service-account.json` (referenced by
`eas.json`'s submit profile) is not present in the repo, so the AAB must be uploaded
to the Play Console manually.

---

## Why this build

Client-reported bug (screen recording): audio plays normally until ~2:24, then
audibly restarts from the beginning while the progress bar keeps counting up
(2:25, 2:26, …).

## Root cause

NOT the trailing-moov m4a bug (commit `b3f7dc5`) — all production audio was
re-verified as genuine, correctly-labeled mp3.

**Appwrite Cloud Storage intermittently ignores HTTP Range requests on a "cold"
file**: reproduced live on 2026-07-20 by requesting `Range: bytes=3456000-3456999`
against a production `/view` URL and receiving **HTTP 200 + the entire file from
byte 0** (`x-debug-fallback: true` in the response) while the server still
advertised `accept-ranges: bytes`. The identical request moments later returned a
correct 206. Reproduced on two different files (both stored encrypted+chunked).

When the native player's mid-stream range request hits that bad response, it
decodes start-of-file audio at a mid-track position — heard as the track
restarting while `currentTime` (and the progress bar) keeps advancing.

---

## What's in this build

### Download-first playback

`loadAndPlay` (both fresh load and same-track resume) now resolves through
`resolveToLocalFile` in `src/contexts/AudioPlayerProvider.tsx`: an uncached track
is **fully downloaded before playing** (via `downloadForPlayback`, which works on
cellular — user-initiated, same bytes streaming would have pulled), showing the
existing "Downloading… X%" UI, then plays from local disk. A local file never
issues range requests, so the Appwrite bug can't touch it.

- Streaming now happens ONLY as a graceful fallback when the download itself
  fails (slow-connection prompt still covers that path).
- This also improves the old "on weak cellular it never even starts" complaint:
  instead of an opaque spinner waiting on a streaming buffer (and a 45s wait for
  the manual download prompt), the download starts immediately with visible
  progress, and the track is cached for instant replays afterwards.
- `pause`/`stop`/channel-switch clear a stale download indicator.
- Preloads (`loadAudio`) still never download.

### Follow-up (outside this build)

- File an Appwrite support ticket with the range-request reproduction.

---

## Commits in this build

- `95e6570` Download uncached audio in full before playback to dodge Appwrite range bug

---

## Testing checklist (real device; the restart bug needs an UNCACHED track)

New in this build:
- [ ] Fresh install (or clear app data) → play a long track (e.g. "Internal
      Thoughts", ~8:34) → "Downloading… X%" shows, then playback starts and plays
      PAST 2:24 to the end with no restart.
- [ ] Same on cellular: tap play → download progress shows immediately (no 45s
      dead spinner), track plays through after download.
- [ ] Pause mid-track → play → resumes from position instantly (local file).
- [ ] Play a downloaded track again later → starts instantly, no re-download.
- [ ] Airplane-mode after a track was played once → replays fine from cache.

Regression (previous builds' fixes, must still pass):
- [ ] Play heavy audio → start a FortyDay day audio → it starts; return to the
      first track → resumes from its paused position.
- [ ] Reflection playlist: switching between exercises is never blocked.
- [ ] Transcript for a loaded track opens at position; play/pause works there.

---

## Status

- [x] Code committed and pushed to `master`
- [x] `eas build --platform ios --profile production --auto-submit` started
- [x] `eas build --platform android --profile production` started
- [x] iOS cloud build finished (build 103, finished 2026-07-20 ~23:52 UTC, ~6 min) —
      TestFlight submission auto-scheduled:
      https://expo.dev/accounts/vardvered/projects/nevermore-app/submissions/233c58f2-8246-4d0b-839f-34a81326d39e
- [x] Android cloud build finished (versionCode 9) — AAB:
      https://expo.dev/artifacts/eas/2y3-XrG9P4LYkRSpFYol_CD3kSvU4jm4lq_COrZwBMs.aab
- [ ] AAB uploaded to Play Console manually (no service-account key in repo)
- [ ] Verified on device (see checklist above)
