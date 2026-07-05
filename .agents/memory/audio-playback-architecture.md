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

## Convention: clear `isLoading` as soon as playback is audible

In `loadAndPlay`, clear `setIsLoading(false)`/`setLoadingUri(null)` immediately after
`playResolvedSource` starts playback — BEFORE the streaming-health verification
(`waitForPlaybackProgress`, up to ~6s) that runs for remote streaming tracks
(`isRemoteUri(uri) && playableUri === uri`).

**Why:** `playResolvedSource` already sets `isPlaying(true)` and `currentUri`, so audio is
audible the moment it returns. If `isLoading` stays true through the verification window, a
cleanly-streaming remote track (e.g. a not-yet-warmed FortyDay day) leaves the play/pause
button stuck on a spinner for several seconds while the user already hears the track. A cached
track (`playableUri !== uri`) skips the wait, which is why the bug only shows on the first,
un-warmed play of a track.

**How to apply:** The corrupted-stream path is unaffected — `fallBackToCachedPlayback`
re-arms its own loading state for the genuine reload. Keep the early clear gated by the
`operationId === operationIdRef.current` check so a superseded load can't clobber a newer one.
