# TestFlight — Build 100 (iOS)

**Date:** 2026-07-16
**Branch:** `master`
**App version:** see `app.json` (`expo.version`) · **iOS build number:** `100`
**Bundle ID:** `com.nevermore.app` · **ASC App ID:** `6754863979` · **Apple Team:** `C5DF3CP9LJ`

Build kicked off with:

```bash
eas build --platform ios --profile production --non-interactive --auto-submit
```

`production` profile has `autoIncrement: true`, so EAS bumps the iOS build number
`99 → 100` automatically at build time and `--auto-submit` sends it to TestFlight
after the cloud build finishes.

---

## What's in this build

All changes extend the build-99 heavy-audio-on-cellular fix to the places the same
root cause (a paused `keepAudioSessionActive` player keeps its network fetch alive,
starving a fresh stream on a weak cellular pipe) was still live.
Details: `.agents/memory/audio-playback-architecture.md`.

### 1. Cross-channel pipe contention (the main fix)
`src/contexts/AudioPlayerProvider.tsx`

Build 99 freed the pipe *within* a channel, but there are three channels (main,
reflection, fortyday), each with its own player — and the one-stream coordinator only
*paused* the others. Playing a heavy streamed track (e.g. "Internal Thoughts") on one
channel and then starting audio on another left the first channel's paused player
still fetching the heavy file, fighting the new stream over the pipe → hang.

`pauseFromCoordinator` now **detaches** a streamed player instead of pausing it:
snapshots the position (and duration) → `remove()`s the player → swaps in a dormant
one. The UI keeps showing the track at its paused position; resuming rebuilds a fresh
player from the snapshot. Local cached playback keeps the plain in-place pause.

### 2. `play()`/`togglePlayPause` no longer resume a streamed player in place
Delegates to `loadAndPlay`'s fresh-player path when the source is remote (or
detached) — closes the documented `.waitingToPlayAtSpecifiedRate` reused-player stall
on the Transcript screen and reflection-playlist same-track resume.

### 3. Preloads never download on cellular
`loadAudio` resolves via `getPlayableUri` (cached-or-stream) instead of `getAudioUri`,
which silently downloaded the entire file with no WiFi gate and no progress UI (e.g.
opening a Transcript on cellular). `getAudioUri` removed from
`src/services/audioCache.service.ts` — the only full-download paths left are
`warmAudio` (WiFi-gated) and `downloadForPlayback` (user-initiated, with progress).

### 4. No more unbounded seek awaits
- `stop()`'s reset `seekTo(0)` is fire-and-forget — a hang there blocked
  `useAudioPlaylist` from ever switching to the next exercise.
- `seekTo`/`seekForward`/`seekBackward` await through `seekWithCap` (3s cap; the
  native seek still lands in the background) — an unbounded remote seek await could
  silently kill Transcript's resume-at-position flow.

**Unchanged, per standing convention:** the 45s slow-connection prompt and the
user-initiated download button; no automatic downloads were added anywhere.

---

## Commits in this build

- `5e8c45c` Free the cellular pipe across channels; fix streamed resume, preload, and seek hangs

---

## Testing checklist (real device on cellular — cannot be verified in simulator/WiFi)

Regression (build-99 fixes, must still pass):
- [ ] First play of "Internal Thoughts" on cellular starts.
- [ ] Pause, then play again → resumes (may re-buffer, but does NOT hang).
- [ ] Play heavy audio → switch to another track on the SAME screen → return → plays.

New in this build:
- [ ] Play "Internal Thoughts" (TemptationDetails) → start a FortyDay day audio →
      it starts (previously could hang: cross-channel contention).
- [ ] …then go back and resume "Internal Thoughts" → resumes from its paused position.
- [ ] Play a streamed reflection exercise → pause via the exercise row → tap it again
      → resumes without hanging.
- [ ] Open Transcript for a streamed track on cellular → opens instantly (no silent
      full download), resumes at position; play/pause from the transcript works.
- [ ] Switching between reflection exercises is never blocked (stop-seek fix).

---

## Status

- [x] Code committed and pushed to `master`
- [x] `eas build --platform ios --profile production --auto-submit` started
- [ ] Cloud build finished
- [ ] Submitted to TestFlight / processing in App Store Connect
- [ ] Verified on device (see checklist above)
