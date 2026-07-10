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

## Fresh player per track — including a second play of the *same* streamed track

Each channel does NOT keep one long-lived `AudioPlayer` and swap tracks into it via
`replace()`. A reused iOS `AVPlayer` that has had a large remote file streamed through it
accumulates state and gets stuck in `.waitingToPlayAtSpecifiedRate` on cellular — worst on
a return visit — while a brand-new player always starts cleanly (confirmed against
expo-audio's iOS source + Apple docs). So `useAudioChannel` builds a fresh player
(`createAudioPlayer`) per track: it lives in state so `useAudioPlayerStatus` re-subscribes on
swap, `playerRef` mirrors it for imperative calls, and the previous player is `remove()`d in a
post-render effect (createAudioPlayer instances are not auto-released). Keeps
`keepAudioSessionActive: true`. Do NOT reintroduce the imperative `player.playing` poll — it
caused a "paused while playing" desync; spinner and icon both derive from the one
`useAudioPlayerStatus.status`.

**The same fresh-player rule applies to a *second play of the same track*, not just track
switches (July 2026).** The original fresh-player fix only rebuilt when `currentUri !== uri`.
But on cellular the heavy files never cache (`warmAudio` is WiFi-only), so they always stream,
and playing the same one twice (replay after it finished, or resume after a pause) hit
`loadAndPlay`'s `currentUri === uri` branch, which reused the first play's player via
`p.play()` — the exact stale-AVPlayer stall, just via the resume path. Fix: that branch now
checks `resolvedSourceUriRef` (the URI actually handed to the current player — `file://` when
cached, `http(s)` when streaming). A **local** cached track still resumes in place (pure native,
no spinner). A **streamed** track rebuilds a fresh player (re-resolving via `getPlayableUri` in
case it has since cached), preserves position for a mid-stream resume via `seekTo`, and arms the
normal play-confirmation spinner. Do NOT revert this branch to an unconditional `p.play()` reuse.

## Free the pipe: release the outgoing player BEFORE the fresh one's play() (July 2026)

Symptom (build 95, heavy streamed audio like "Internal Thoughts" on cellular): **first play
works, but (a) pause then play again, or (b) switch to other audio and come back, hangs on the
loading spinner forever and never starts.** Case (b) is the key tell — it goes through the
fresh-load path and plays from position 0 with *no* `seekTo`, yet still hangs, which rules the
seek out as the root cause and points at player/connection contention.

Root cause: an expo-audio player built with `keepAudioSessionActive: true` keeps its
`AVPlayerItem` and the live network fetch of its (heavy) remote URL alive even after `pause()`.
The fresh-per-track logic rebuilds a new player, but the outgoing one was only *paused* and only
`remove()`d later in a post-render effect. Callers call `play()` on the fresh player the instant
`swapToFreshPlayer` returns — before React re-renders — so the old fetch was still open during
that `play()`, and the two streams fought over the weak cellular pipe; the fresh one never filled
its buffer.

Fix: `swapToFreshPlayer` now `remove()`s the outgoing player **synchronously, first**, before
`createAudioPlayer` for the new one, and sets `prevPlayerRef.current = next` so the post-render
disposal effect (now a safety-net no-op) doesn't double-remove. Removing synchronously is safe
even though `useAudioPlayerStatus` is still subscribed to the old player for that tick: the swap
runs from an event handler (not render), `remove()` just stops further status events (last status
stays readable, no throw), and `setPlayer` schedules the re-render that moves the subscription to
`next`. **Do NOT move this teardown back into the post-render effect** — teardown-before-the-fresh-
`play()` is the whole point.

Second, independent hang in the pause→resume branch only: it used to `await fresh.seekTo(pos)`
BEFORE `fresh.play()`. Awaiting a seek into a not-yet-buffered remote offset can itself hang
forever (the server may not honor the byte-range request). That branch now calls `fresh.play()`
first, then `fresh.seekTo(pos).catch(() => {})` best-effort (not awaited): playback is guaranteed
to resume; if the seek can't buffer, audio just keeps playing from where it started instead of
hanging. **Do NOT re-await a seek before play() on a fresh remote stream.**

Note this reintroduces the eager-teardown idea from an earlier abandoned attempt, but adds the
non-awaited-seek fix that attempt lacked (which is why that attempt still left pause→resume
hanging). The slow-connection prompt / user-download button stay as they are — they are NOT the
fix for this and were intentionally not expanded here.

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

## Slow-connection prompt + user-initiated download (July 2026)

For heavy content on weak cellular the file simply streams (it never background-caches —
`warmAudio` is WiFi-only), and a weak pipe sometimes never fills the buffer, so playback
"doesn't start." Rather than fight this automatically, we surface it to the user:

- Each channel arms a **45s slow-connection timer** (`SLOW_CONNECTION_PROMPT_MS`) whenever a
  *fresh streamed* load starts (only when `isRemoteUri(playableUri)` — a local/cached load
  plays instantly and never arms it). If playback hasn't confirmed (`status.playing`) within
  45s and the op is still current, `isSlowConnection` flips true. The screen shows a "Slow
  connection — download to play" prompt (`MediaControls` for TemptationDetails main content;
  a compact chip on the current FortyDay day).
- The timer is **UI-only** — it never calls `pause`/`replace`/`seekTo`/`play`. Playback keeps
  trying underneath; if the stream eventually buffers through, the status effect sees
  `status.playing` and clears `isSlowConnection` on its own. This is the crucial distinction
  from the reverted `waitForPlaybackProgress` auto-verify (see below): that mechanism
  *automatically interrupted* a slow-but-healthy stream. This one only *offers* an action.
- `downloadForOffline(uri)` runs only when the **user taps** the button. It pauses the stalled
  stream (freeing the pipe — the contention lesson, but here user-initiated, not a guess),
  calls `audioCacheService.downloadForPlayback(uri, onProgress)` — a foreground download that
  deliberately **bypasses the WiFi gate** (`downloadForPlayback` does NOT call
  `isBackgroundDownloadAllowed`, unlike `warmAudio`) — shows `downloadProgress` (0..1), then
  plays the downloaded local file on a fresh player.
- Once downloaded, the file is in the normal persistent cache, so **switching to other audio
  and returning replays it from disk** (via `getPlayableUri`'s cache hit) with no re-download
  and no slow-prompt — until iOS purges `cacheDirectory` under storage pressure. If that
  eviction ever needs to be prevented for heavy content, move these downloads to
  `documentDirectory`.

**Do NOT turn this into an automatic pause-and-download.** The 45s flag must never trigger a
download or touch the player by itself — only the user's tap may. Keeping it user-initiated is
exactly what keeps it clear of the reverted auto-verify trap.

## Convention: clear `isLoading` only once the native player confirms playing — still no post-play verification

In `loadAndPlay`'s fresh-load path, `setIsLoading(false)`/`setLoadingUri(null)` is no longer
cleared the instant `playResolvedSource` returns. expo-audio's `player.play()` is a synchronous
native call with no playback-confirming event of its own — `status.playing` (from
`useAudioPlayerStatus`) only flips once a subsequent status event lands, which on iOS can lag
up to ~500ms behind `play()` resolving (its periodic time observer, not push-on-play). Clearing
`isLoading` on promise-resolution therefore showed a "not loading, not playing" frame (reads as
Play) for a beat before the icon flipped to Pause — a real, if brief, button flicker.

Instead, `armPlayConfirmation(operationId)` records the operation as pending; a `useEffect` keyed
on the whole `status` object (not `status.playing` — `useEvent` hands back a new object per
native emission, so keying on the object guarantees a re-check on every event) clears `isLoading`
as soon as `status.playing` is true for that pending operation. Every place that already
unconditionally clears `isLoading` on cancellation (`pause`, `pauseFromCoordinator`, `stop`,
`unloadAudio`, `loadAndPlay`'s catch/early-return paths) also clears the pending confirmation, so
a superseded operation can never leave a stale one armed.

**No fixed timeout — read `status.isBuffering` instead of guessing (July 2026).** This used to be
a blind 3s safety-net timeout armed the instant a fresh load started, regardless of real network
conditions. On slow/weak cellular, real buffering can legitimately take 10s-60s+, so the blind
timeout fired *before* the native player actually confirmed playback — clearing the spinner while
audio was still genuinely loading underneath. Worse, because the spinner looked idle again, the
screen's own "if isLoading, ignore tap" convention no longer applied, so a frustrated user tapping
Play again re-triggered a brand new `loadAndPlay` → a brand new `player.replace()` on the same
audio — restarting the native buffer from scratch each time. Repeated taps could compound this
into the delay looking like a full minute or more.

The fix: `expo-audio`'s `AudioStatus` (from `useAudioPlayerStatus`) exposes a real, non-guessed
`isBuffering` boolean straight from the native player. The status-watching effect now checks
`status.playing` first and unconditionally — nothing else is a precondition for clearing the
spinner, so unlike the `duration`-gated approach below, there is no path where audio is confirmed
playing but the spinner stays stuck up. Only if `status.playing` is still false does the effect
look at `status.isBuffering`: while true, it does nothing and arms no timer, no matter how long
real buffering takes. Only once `isBuffering` goes false but `playing` still hasn't flipped does a
short (3s) grace timer arm, covering the ~500ms iOS status-event lag or a genuinely stalled player
— and it's re-armed/cancelled on every status event via the same effect, not a one-shot timer set
at call time.

**Do not resurrect a blind fixed-duration timeout here** ("just make it longer") — any fixed
duration is still a guess about how long a network *could* take, and either fires too early on
bad connections (the original bug) or leaves a truly-stuck case spinning too long. Read
`status.isBuffering` instead; it already knows.

Resuming an already-loaded, merely-paused track (`loadAndPlay`'s `currentUri === uri` branch,
and the standalone `play()`) never shows `isLoading` at all — it's a pure native resume with no
fetch or decode, so there's nothing to spin on.

This is still NOT a "verify the stream is healthy" step — do NOT add a post-play "verify, then
pause/redownload/replace the source" mechanism here. The confirmation wait/timeout only ever
touches the `isLoading` UI boolean; it never calls `pause()`/`replace()`/`seekTo()` and never
inspects `duration`. Even in the worst case (the confirming event never arrives), the timeout
just stops showing a spinner over audio that's already playing underneath — it does not
interrupt or re-evaluate playback.

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

## `warmAudio` self-gates to unmetered connections (cellular = no background download)

`audioCacheService.warmAudio()` — the ONLY path that triggers a *background*
full-file download (all three callers: the two mount prefetches below plus
`loadAndPlay`'s post-play warm) — checks `Network.getNetworkStateAsync()` via
`isBackgroundDownloadAllowed()` and **returns early on CELLULAR (or no
connection)**, before `downloadAndCache`. Already-cached files are served first
and are unaffected. `getAudioUri`/`loadAudio` (user-initiated foreground loads)
are intentionally NOT gated.

**Why (July 2026):** even after prefetch was scoped down, the single heaviest
file ("Internal Thoughts" recovery audio) still hung indefinitely on weak
cellular: its mount prefetch download raced the native player's streaming fetch
for the *same* huge file over one starved pipe, so neither filled the buffer.
Gating warm to WiFi/Ethernet means on cellular the file just streams on tap and
gets the whole pipe; it's warmed later once on WiFi. Fails OPEN (allows warming)
if the network type can't be probed, so a transient failure never permanently
disables caching. This also satisfies the client's ask to limit background
cellular data. Pairs with shrinking the file itself (low-bitrate mono re-encode)
— the two fixes are complementary: fewer bytes + no self-contention.

## Background prefetch is intentionally narrow: Day 1 + "Internal Thoughts" only

`TemptationDetails.tsx` and `FortyDay.tsx` each have a `useEffect` that calls
`audioCacheService.warmAudio()` ~1.2s after mount to pre-download audio in the
background before the user taps play, so the first play on that content is
served from local disk instead of streaming (subject to the connection gate
above — on cellular the warm is a no-op and playback streams instead). This used to run unconditionally
for every Temptation content screen (plus up to 2 reflection question audio
files) and for whichever FortyDay day + the next day were currently in view.

**Why scoped down (July 2026):** on weak/low-bandwidth cellular, running 2-3
concurrent background downloads competed for bandwidth with the native
player's own streaming fetch when the user tapped play on content that wasn't
fully cached yet — starving the actual playback stream and producing a ~20-30s
"nothing happens, then audio suddenly starts" bug. The client also
independently asked to limit background cellular data usage. Both are
addressed by only auto-downloading the two pieces of content a user is
virtually guaranteed to hit right after onboarding:

- **FortyDay Day 1**: `days.find(day => day.day === 1)?.audioUrl`, warmed once
  regardless of which day is currently active. Days 2-40 are no longer
  prefetched (not even "current + next day" as before) — they stream on tap
  and get cached afterward via `loadAndPlay`'s own post-play `warmAudio` call,
  same as everything else.
- **The "Internal Thoughts" content** (a specific `content` row, matched by
  `content.title.trim().toLowerCase() === 'internal thoughts'` — not a
  category; categories in this app are a flat list with no parent-grouping
  field, so "Internal Thoughts" the client refers to is a content item, not a
  category): only its `mainContentRecoveryURL`/`mainContentSupportURL` are
  warmed. Reflection question audio (`audioFiles`) is no longer eagerly
  prefetched for any content, including this one.

**How to apply:** do not reintroduce blanket eager prefetch for other
days/categories/reflection audio without revisiting this tradeoff — it's what
caused the contention bug. If the "Internal Thoughts" content is ever renamed
in the CMS, this title match silently stops matching (no error, prefetch just
no longer fires for it) — worth a periodic sanity check if this becomes hard
to notice.

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
