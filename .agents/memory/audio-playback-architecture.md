---
name: Audio playback architecture
description: How the Nevermore app manages single-track audio playback and the convention all play handlers must follow
---

# Audio playback session management

All audio runs through a single central provider (`src/contexts/AudioPlayerProvider.tsx`)
that owns persistent expo-audio players as named **channels** (main, reflection, fortyday).
Channels live above navigation so playback survives screen transitions. A global
**one-stream guard** (`onPlayStart` -> `pauseOthers`) ensures starting any channel pauses
the others, so cross-channel exclusivity is handled centrally — screens should not need
to manually coordinate it.

## Convention: primary single-track play handlers

Every screen's play/pause button for a primary single audio track (e.g. FortyDay challenge,
TemptationDetails main content) must follow the SAME pattern:

1. If channel `isLoading` -> return (ignore tap).
2. If channel `isPlaying` -> `pause()` and return.
3. Else -> `loadAndPlay(uri)`.

**Why:** `loadAndPlay` is atomic and robust — it resumes from position when the same URI is
already loaded/paused (fast path), loads-and-plays when not, and fires the global one-stream
guard. Using `togglePlayPause()` instead is fragile: it early-returns when `currentUri` is
unset, so a tap can silently no-op if a separate eager `loadAudio` effect hasn't completed.
Mixing the two mechanisms across screens is exactly what caused the challenge-vs-temptation
inconsistency bug.

**How to apply:** When adding/editing any screen that plays a primary track, mirror this
handler. An eager `loadAudio` effect (for duration preview before play) is fine and matches
FortyDay's `prepareAudio` — it does not replace the `loadAndPlay` button handler.

Note: explicit `pause()` of a sibling channel before `loadAndPlay` (as in TemptationDetails
pausing reflection) is redundant with the global guard but kept as belt-and-suspenders so the
sibling stops immediately during the load window rather than after caching finishes.

The playlist channel (reflection, via `useAudioPlaylist`) is the intentional exception: it
auto-plays on selection. Single tracks never auto-play.

## Convention: clear `isLoading` as soon as playback starts — no post-play verification

In `loadAndPlay`, `setIsLoading(false)`/`setLoadingUri(null)` is cleared immediately after
`playResolvedSource` returns (which already calls `player.play()` and sets `isPlaying(true)`).
That's it — do NOT add a post-play "verify the stream is healthy, then pause/redownload/replace
the source" step here.

**Why:** an earlier version of this file did exactly that (`waitForPlaybackProgress` +
`fallBackToCachedPlayback`, gating "success" on `player.duration` resolving within ~6s). Many
legitimately-fine tracks never resolve `duration` while streaming (the container's duration atom
can sit at the end of the file), so the "verify" step routinely decided a healthy stream had
failed, paused it, downloaded the entire file, and swapped the source out from under the user —
producing audio that plays, silently stalls for the length of a full download, then resumes.
Users experienced this as playback "not starting," ±10s/stop controls going unresponsive during
the stall window, and the progress bar disappearing. Reverted in July 2026 (see git history
around commits `c144036`..`0ad0285` on `codex-fix-subscription-40-day-regressions` for the
removed code, if you need the archaeology). Missing duration is now treated as a purely cosmetic
condition (see below), never a reason to interrupt playback that's already underway.

## Extension-less Appwrite URLs → non-finite duration (dead progress bar, but NOT dead seek)

Appwrite Storage "view" URLs carry NO file extension. `audioCache.service.ts`
caches downloads under a guessed extension (URL-based, default `.mp3`). If the
real container isn't mp3 (m4a/wav/ogg/etc.), the file **plays and currentTime
advances**, but the native decoder can't parse `player.duration`/seek metadata.
Total time shows `--:--` and the progress bar fill stays at 0 — that part is an
accepted cosmetic gap, not something to chase with re-downloads or re-streams.

**Fix in place (cosmetic only, safe):** `detectExtensionFromContent()` sniffs the
downloaded file's first 16 bytes (magic numbers) and is preferred over the HTTP
Content-Type when naming the cached file, so a warmed/cached play is more likely
to get a correct extension and therefore working duration. Bump `CACHE_INDEX_KEY`
when changing detection so old mislabeled entries are dropped and re-downloaded.
This only affects what extension a *newly downloaded* file is saved under — it
never interrupts or replaces an in-progress playback.

**`seekForward`/`seekBackward` must not require known duration.** `seekBackward`
never did. `seekForward` clamps to the effective duration (see below) only when
it's known; otherwise it just adds the seconds to `currentTime` unclamped. Do not
reintroduce an early-return on `!isFinite(player.duration)` here — that's what
made ±10s controls go unresponsive on tracks whose duration never resolves.

## Known-duration fallback (`knownDurationSec`)

Rather than only chasing the cosmetic gap above, `loadAudio`/`loadAndPlay` accept
an optional `knownDurationSec` — a duration computed once, ahead of time, by the
admin at upload time (browser-decoded via `HTMLAudioElement`, see
`admin/src/lib/audioDuration.ts`) and stored on the content record. Each channel
keeps it in `knownDurationRef` and a `getEffectiveDuration()` helper resolves to
`player.duration` when the native player has it, falling back to
`knownDurationRef.current` otherwise. Every place that used to gate on
`isFinite(player.duration)` (total/remaining time, progress, `seekForward`,
`seekTo`, `getPlaybackSnapshot`) goes through `getEffectiveDuration()` instead.

**Why:** this makes duration/seek/progress work correctly even when the native
player *never* resolves its own duration (common for streamed, extension-less
Appwrite audio) — no re-download, no re-stream, no waiting. It's strictly
additive: if `knownDurationSec` is omitted, behavior is unchanged.

**Schema (Appwrite `content` collection):** `fileDurations` (Float array, index-
aligned with `files`), `mainContentRecoveryDurationSec` (Float),
`mainContentSupportDurationSec` (Float), `recoveryQuestionFileDurations`/
`supportQuestionFileDurations` (Float arrays, index-aligned with
`recoveryQuestionFiles`/`supportQuestionFiles`) — all optional. Added July 2026.

**How to apply:** as of July 2026 this is wired everywhere audio plays:
- 40-Day journey day audio: `DayData.audioDurationSec` (from
  `content.fileDurations[0]`) → `loadAndPlay` in `FortyDay.tsx`.
- TemptationDetails main content: `useContentPresentation` exposes role-specific
  `mainContentDurationSec` (`mainContentRecoveryDurationSec`/
  `mainContentSupportDurationSec`), passed to `mainContentAudioPlayer.loadAndPlay`
  in `TemptationDetails.tsx`.
- TemptationDetails reflection/question audio: `useContentPresentation` exposes
  `audioFileDurations` (index-aligned with `audioFiles`, same recovery/support/
  legacy fallback branch as the URLs), passed to `useAudioPlaylist.loadPlaylist`,
  which threads `durations[index]` into `loadAndPlay`/`loadAudio` in
  `handleAudioSelect`.
- `Transcript.tsx` still calls `loadAudio` without a duration — it navigates from
  an already-loaded track (`initialPositionSec`/`resumePlaying` from a live
  `getPlaybackSnapshot()`), so the channel already has its duration from
  whichever screen loaded it originally; no gap here.

Admin-side (`admin/src/lib/content.ts`): `publishContent` (create) and
`updateTemptationContent` (edit) both compute durations client-side with
`getAudioDurationSec`/`getAudioDurationsSec` at upload time, exactly like
`Journey40Day.tsx`/`updateContentWithFiles`. On edit, `ExistingTemptationUrls`
carries forward `mainContentRecoveryDurationSec`/`mainContentSupportDurationSec`/
`questionRecoveryDurations`/`questionSupportDurations` for files that aren't
being re-uploaded, concatenated with newly-computed durations in the same order
existing+new URLs are concatenated — keep any future edits to the URL merge
logic and the duration merge logic in lockstep, or they'll drift out of index
alignment. `backfillDurations.ts` covers all four duration fields for legacy
content that predates this tracking.
