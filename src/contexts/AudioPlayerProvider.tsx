import { useAudioPlayer as useExpoAudioPlayer, useAudioPlayerStatus, AudioPlayer, AudioSource, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { audioCacheService } from '../services/audioCache.service';

export type PlaybackSnapshot = {
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
};

export interface AudioChannel {
  isPlaying: boolean;
  isLoading: boolean;
  loadingUri: string | null;
  currentTime: string;
  totalTime: string;
  remainingTime: string;
  progress: number;
  isMuted: boolean;
  currentUri: string | null;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  /**
   * Restart the current track "from scratch": re-resolve its source and play
   * from position 0. Unlike `stop` (a plain halt), this re-`replace()`s the
   * native item, which also recovers a wedged/never-confirming load. Backs the
   * square/Stop button in the UI. No-op when nothing is loaded.
   */
  restart: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  toggleMute: () => Promise<void>;
  seekForward: (seconds: number) => Promise<void>;
  seekBackward: (seconds: number) => Promise<void>;
  seekTo: (progress: number) => Promise<void>;
  rewind: () => Promise<void>;
  forward: () => Promise<void>;
  /**
   * `knownDurationSec` is a duration computed ahead of time (e.g. by the admin
   * at upload time) and stored on the content record. When provided, it backs
   * total time/progress/seek immediately and as a fallback if the native
   * player never resolves its own `duration` while streaming — see
   * .agents/memory/audio-playback-architecture.md.
   */
  loadAudio: (uri: string, knownDurationSec?: number) => Promise<void>;
  loadAndPlay: (uri: string, knownDurationSec?: number) => Promise<void>;
  unloadAudio: () => Promise<void>;
  getPlaybackSnapshot: () => PlaybackSnapshot;
}

export type ChannelName = 'main' | 'reflection' | 'fortyday';

interface AudioPlayerContextValue {
  main: AudioChannel;
  reflection: AudioChannel;
  fortyday: AudioChannel;
}

type InternalAudioChannel = AudioChannel & {
  pauseFromCoordinator: () => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);
let registeredStopAllAudio: (() => Promise<void>) | null = null;

export async function stopAllAudioPlayback(): Promise<void> {
  await registeredStopAllAudio?.();
}

const formatTime = (milliseconds: number): string => {
  if (!isFinite(milliseconds) || milliseconds < 0 || isNaN(milliseconds)) {
    return '00:00';
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const isPlayerAtEnd = (player: AudioPlayer): boolean => {
  try {
    return (
      isFinite(player.duration) &&
      player.duration > 0 &&
      player.currentTime >= player.duration - 0.25
    );
  } catch {
    return false;
  }
};

const isRemoteUri = (uri: string): boolean => /^https?:\/\//i.test(uri);

// How often, during a pending fresh-load, we poll the imperative
// `player.playing` property as a backstop to the status-event effect below.
// `player.playing` reads the live AVPlayer `timeControlStatus` directly (it is
// NOT event-driven), so it stays correct even when the native player stops
// emitting PLAYBACK_STATUS_UPDATE events — the exact condition (a reused
// AVPlayer stuck in `.waitingToPlayAtSpecifiedRate`) that otherwise leaves the
// spinner armed forever waiting for an event that never arrives. See
// .agents/memory/audio-playback-architecture.md.
const PLAY_CONFIRMATION_POLL_MS = 250;

const normalizeKnownDuration = (value?: number): number | null =>
  typeof value === 'number' && isFinite(value) && value > 0 ? value : null;

const configureBackgroundAudioSession = async () => {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    interruptionModeAndroid: 'doNotMix',
  });
  await setIsAudioActiveAsync(true);
};

/**
 * Builds an audio channel backed by a persistent expo-audio player instance.
 * The player lives for the lifetime of the provider (mounted above navigation),
 * so playback survives screen transitions instead of being torn down on unmount.
 *
 * `onPlayStart` lets the provider enforce a single audible channel at a time.
 *
 * Playback/progress state (isPlaying/currentTime/duration/etc.) is derived
 * every render from expo-audio's own `useAudioPlayerStatus(player)` — a
 * reactive subscription to the native player's status-update events — rather
 * than hand-polling `player.playing`/`player.currentTime` on a setInterval.
 * The previous polling approach had two independent writers racing on the
 * same `isPlaying` state (an optimistic write right after `player.play()`,
 * and the poll itself), which is what produced the play/pause button
 * flickering Pause -> Play -> Pause on tap. With a single reactive source of
 * truth there's nothing left to race.
 */
function useAudioChannel(
  player: AudioPlayer,
  onPlayStart: () => void
): InternalAudioChannel {
  const status = useAudioPlayerStatus(player);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUri, setLoadingUri] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const previousVolumeRef = useRef<number>(1.0);
  const operationIdRef = useRef(0);
  // A duration computed ahead of time and stored on the content record (see
  // `knownDurationSec` on loadAudio/loadAndPlay). Used whenever the native
  // player hasn't (or never does) resolve its own `duration` from the
  // stream. Kept as a ref (not state): every call site that sets it also
  // sets other state in the same breath, which already triggers the
  // re-render that picks up the new value — a ref just avoids the get-stale-
  // value-from-an-old-render trap that state would create for the memoized
  // `getPlaybackSnapshot` callback below.
  const knownDurationRef = useRef<number | null>(null);
  // Tracks a fresh-load operation waiting for the native player to actually
  // confirm playback (status.playing) before the loading spinner clears —
  // see the effect below and armPlayConfirmation. Resume/pause paths never
  // set this; only a genuine loadAndPlay fetch does.
  const pendingPlayConfirmationRef = useRef<number | null>(null);
  const playConfirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Backstop poll + absolute ceiling for a pending fresh-load — see the
  // PLAY_CONFIRMATION_POLL_MS / PLAY_CONFIRMATION_CEILING_MS notes above.
  const playConfirmationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getEffectiveDuration = (): number | null => {
    if (isFinite(player.duration) && player.duration > 0) return player.duration;
    return knownDurationRef.current;
  };

  const clearPendingPlayConfirmation = () => {
    pendingPlayConfirmationRef.current = null;
    if (playConfirmationTimeoutRef.current) {
      clearTimeout(playConfirmationTimeoutRef.current);
      playConfirmationTimeoutRef.current = null;
    }
    if (playConfirmationPollRef.current) {
      clearInterval(playConfirmationPollRef.current);
      playConfirmationPollRef.current = null;
    }
  };

  // Clears the loading spinner for a pending fresh-load and tears down its
  // confirmation timers. UI-only: never touches the native player.
  const confirmPlayAndClearSpinner = () => {
    clearPendingPlayConfirmation();
    setIsLoading(false);
    setLoadingUri(null);
  };

  // Marks a fresh-load operation as waiting for the native player to confirm
  // playback (status.playing) before the loading spinner clears. The actual
  // wait logic lives in the status-watching effect below, which reads the
  // native `status.isBuffering` signal instead of guessing off a fixed
  // timeout — see that effect for why.
  const armPlayConfirmation = (operationId: number) => {
    clearPendingPlayConfirmation();
    pendingPlayConfirmationRef.current = operationId;

    // Backstop the status-event effect below with a poll of the imperative
    // `player.playing` property. The effect only re-runs when a native status
    // event lands, but a reused AVPlayer that wedges in
    // `.waitingToPlayAtSpecifiedRate` stops emitting events entirely — so the
    // effect would wait forever even though audio may actually be playing.
    // `player.playing` is read live from the native player on every tick, so
    // this clears the spinner the instant playback truly starts, regardless of
    // whether an event arrived. It deliberately has NO time ceiling: while a
    // track is genuinely still loading the spinner shows as long as it takes;
    // recovery from a stuck load is the square/restart button, not a timeout.
    // Never touches playback.
    playConfirmationPollRef.current = setInterval(() => {
      if (
        pendingPlayConfirmationRef.current !== operationId ||
        operationIdRef.current !== operationId
      ) {
        // Superseded by a newer operation, which owns the spinner now.
        if (playConfirmationPollRef.current) {
          clearInterval(playConfirmationPollRef.current);
          playConfirmationPollRef.current = null;
        }
        return;
      }

      let playing = false;
      try {
        playing = player.playing;
      } catch {
        // Reading the native property can throw on a torn-down player; treat
        // as "not yet playing" and keep waiting.
      }

      if (playing) {
        confirmPlayAndClearSpinner();
      }
    }, PLAY_CONFIRMATION_POLL_MS);
  };

  // Everything below is derived straight from `status` (and the small bits
  // of app-level bookkeeping above) — no separate state to keep in sync.
  const isPlaying = currentUri != null && status.playing && !status.didJustFinish;
  const effectiveDuration = (isFinite(status.duration) && status.duration > 0)
    ? status.duration
    : knownDurationRef.current;
  const durationKnown = currentUri != null && effectiveDuration != null;
  const currentTimeSec = currentUri != null && isFinite(status.currentTime) ? status.currentTime : 0;
  const currentTime = formatTime(currentTimeSec * 1000);
  const totalTime = durationKnown ? formatTime(effectiveDuration * 1000) : '--:--';
  const remainingTime = durationKnown
    ? formatTime(Math.max(0, effectiveDuration * 1000 - currentTimeSec * 1000))
    : '--:--';
  const progress = currentUri == null
    ? 0
    : status.didJustFinish
      ? 1
      : (durationKnown ? currentTimeSec / effectiveDuration : 0);

  // Confirms a pending fresh-load play (armed by armPlayConfirmation), then
  // clears the spinner. Keyed on the whole `status` object rather than
  // `status.playing` — expo-audio's useEvent hands back a new object on
  // every native emission, so keying on the object guarantees this re-checks
  // on every event instead of only when a single field's value differs from
  // last render.
  //
  // status.playing is checked first and unconditionally clears the spinner
  // — that's the one thing that can never leave the spinner stuck up over
  // audio that's actually playing (unlike an earlier, reverted approach that
  // gated success on `duration` resolving, which many legitimately-streaming
  // tracks never do — see .agents/memory/audio-playback-architecture.md).
  //
  // Below that, status.isBuffering is a real native signal (not a guess):
  // while the player reports it's still buffering, the spinner stays up no
  // matter how long that genuinely takes (tens of seconds on slow cellular)
  // — the grace timer is never armed during that window. Only once
  // buffering has genuinely finished but `playing` still hasn't flipped do
  // we give it a short, bounded grace period (covering the ~500ms iOS
  // status-event lag, or a truly stalled player) before giving up on the
  // spinner. The timer only ever touches the isLoading UI boolean, never
  // playback itself.
  const PLAY_CONFIRMATION_GRACE_MS = 3000;
  useEffect(() => {
    const pendingId = pendingPlayConfirmationRef.current;
    if (pendingId === null || pendingId !== operationIdRef.current) return;

    if (status.playing) {
      clearPendingPlayConfirmation();
      setIsLoading(false);
      setLoadingUri(null);
      return;
    }

    if (status.isBuffering) {
      if (playConfirmationTimeoutRef.current) {
        clearTimeout(playConfirmationTimeoutRef.current);
        playConfirmationTimeoutRef.current = null;
      }
      return;
    }

    if (!playConfirmationTimeoutRef.current) {
      playConfirmationTimeoutRef.current = setTimeout(() => {
        playConfirmationTimeoutRef.current = null;
        if (pendingPlayConfirmationRef.current === pendingId && operationIdRef.current === pendingId) {
          clearPendingPlayConfirmation();
          setIsLoading(false);
          setLoadingUri(null);
        }
      }, PLAY_CONFIRMATION_GRACE_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const playResolvedSource = async (
    uri: string,
    resolvedUri: string,
    operationId: number
  ): Promise<void> => {
    const audioSource: AudioSource = { uri: resolvedUri };
    await player.replace(audioSource);
    if (operationId !== operationIdRef.current) return;

    setIsMuted(false);
    previousVolumeRef.current = 1.0;
    player.volume = 1.0;
    setCurrentUri(uri);

    await setIsAudioActiveAsync(true);
    await player.play();
  };

  const loadAudio = async (uri: string, knownDurationSec?: number) => {
    let operationId: number | null = null;
    try {
      if (!uri || uri.trim() === '') {
        return;
      }

      // Don't reload if it's the same audio
      if (currentUri === uri) {
        return;
      }

      knownDurationRef.current = normalizeKnownDuration(knownDurationSec);
      operationId = ++operationIdRef.current;
      setIsLoading(true);
      setLoadingUri(uri);

      // Always pause before loading new audio to prevent overlap
      player.pause();

      // Stream-first, mirroring loadAndPlay: resolve to the cached file when
      // it exists, otherwise the remote URL so the source is ready in ~1s
      // instead of blocking on a full multi-MB download (the old getAudioUri
      // path). This is a preload (no play() here), so the source just needs to
      // be set for the player to pull metadata/duration; the full file is
      // fetched in the background below for a future warm play.
      const playableUri = await audioCacheService.getPlayableUri(uri);
      if (operationId !== operationIdRef.current) return;

      const audioSource: AudioSource = { uri: playableUri };
      await player.replace(audioSource);
      if (operationId !== operationIdRef.current) return;

      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      player.volume = 1.0;

      setCurrentUri(uri);

      if (isRemoteUri(uri) && playableUri === uri) {
        // Not-yet-cached remote track: warm the full file in the background
        // (self-gates to unmetered connections) so the eventual play is served
        // from disk and gets a correct extension for duration/seek metadata.
        // Does not block or interrupt this preload — same pattern as
        // loadAndPlay. See .agents/memory/audio-playback-architecture.md.
        audioCacheService.warmAudio(uri, { knownDurationSec: knownDurationRef.current }).catch((error) => {
          console.warn('Failed to warm preloaded audio cache:', error);
        });
      }
    } catch (error) {
      if (operationId !== null && operationId !== operationIdRef.current) return;
      console.error('Error loading audio:', error);
      setCurrentUri(null);
    } finally {
      if (operationId !== null && operationId === operationIdRef.current) {
        setIsLoading(false);
        setLoadingUri(null);
      }
    }
  };

  const loadAndPlay = async (uri: string, knownDurationSec?: number) => {
    const operationId = ++operationIdRef.current;
    try {
      if (!uri || uri.trim() === '') {
        return;
      }

      knownDurationRef.current = normalizeKnownDuration(knownDurationSec);
      onPlayStart();

      // If same audio is already loaded, just resume it. This is a pure
      // native operation (no fetch, no decode) so it never shows the
      // loading spinner.
      if (currentUri === uri) {
        if (!player.playing) {
          if (isPlayerAtEnd(player)) {
            await player.seekTo(0);
            if (operationId !== operationIdRef.current) return;
          }
          await setIsAudioActiveAsync(true);
          if (operationId !== operationIdRef.current) return;
          await player.play();
        }
        return;
      }

      setIsLoading(true);
      setLoadingUri(uri);

      if (player.playing) {
        player.pause();
      }

      const playableUri = await audioCacheService.getPlayableUri(uri);
      if (operationId !== operationIdRef.current) return;

      await playResolvedSource(uri, playableUri, operationId);
      if (operationId !== operationIdRef.current) return;

      armPlayConfirmation(operationId);

      if (isRemoteUri(uri) && playableUri === uri) {
        // Playing a not-yet-cached remote track directly: warm the cache in
        // the background (this is also what gives the file its correct
        // extension via magic-byte sniffing, so a future play gets working
        // duration/seek metadata) without blocking or interrupting the
        // playback that already started. warmAudio self-gates to unmetered
        // connections, so on cellular this is a no-op and the streaming fetch
        // keeps the whole pipe (crucial for the heaviest files on a weak link).
        // Do NOT add a "verify the stream is healthy, else redownload and swap
        // the source" step here — see
        // .agents/memory/audio-playback-architecture.md for why that was
        // already tried and reverted (it misdiagnoses a slow-but-healthy
        // stream as stalled and interrupts it).
        audioCacheService.warmAudio(uri, { knownDurationSec: knownDurationRef.current }).catch((error) => {
          console.warn('Failed to warm streamed audio cache:', error);
        });
      }
    } catch (error) {
      clearPendingPlayConfirmation();
      if (operationId !== operationIdRef.current) return;
      console.error('Error loading and playing audio:', error);
      setCurrentUri(null);
    } finally {
      // Skip the clear when a confirmation was just armed for this exact
      // operation — armPlayConfirmation/the status effect own clearing
      // isLoading in that case. Still fires for early returns (empty uri)
      // and thrown errors, which never reach armPlayConfirmation.
      if (operationId === operationIdRef.current && pendingPlayConfirmationRef.current !== operationId) {
        setIsLoading(false);
        setLoadingUri(null);
      }
    }
  };

  const unloadAudio = async () => {
    operationIdRef.current++;
    knownDurationRef.current = null;
    clearPendingPlayConfirmation();
    try {
      if (player.playing) {
        player.pause();
      }

      setIsLoading(false);
      // Don't call replace(null) - it's not supported
      // Just clear our state and let the player keep the last audio loaded

      setCurrentUri(null);
      setLoadingUri(null);
      setIsMuted(false);
      previousVolumeRef.current = 1.0;
    } catch (error) {
      setCurrentUri(null);
      setLoadingUri(null);
      setIsLoading(false);
      setIsMuted(false);
      previousVolumeRef.current = 1.0;
    }
  };

  const play = async () => {
    const operationId = ++operationIdRef.current;
    try {
      if (!currentUri) {
        return;
      }

      // Resuming an already-loaded track is a pure native operation (no
      // fetch, no decode) — never show the loading spinner for it.
      if (!player.playing) {
        if (isPlayerAtEnd(player)) {
          await player.seekTo(0);
          if (operationId !== operationIdRef.current) return;
        }
        await setIsAudioActiveAsync(true);
        if (operationId !== operationIdRef.current) return;
        onPlayStart();
        await player.play();
        if (operationId !== operationIdRef.current) return;
      }
    } catch (error) {
      if (operationId !== operationIdRef.current) return;
    } finally {
      if (operationId === operationIdRef.current) {
        setIsLoading(false);
        setLoadingUri(null);
      }
    }
  };

  const pause = async () => {
    operationIdRef.current++;
    // Bumping operationIdRef cancels any in-flight play()/loadAndPlay(), but
    // play()'s own loading-state cleanup is gated on that same id and won't
    // run once cancelled — so pause() must clear it here itself, same as
    // stop()/pauseFromCoordinator() already do, or the play button gets
    // stuck on its loading spinner after a fast pause during a play attempt.
    clearPendingPlayConfirmation();
    setIsLoading(false);
    setLoadingUri(null);
    try {
      if (!currentUri) {
        return;
      }

      if (player.playing) {
        player.pause();
      }
    } catch (error) {
    }
  };

  const pauseFromCoordinator = useCallback(() => {
    operationIdRef.current++;
    try {
      player.pause();
    } catch {}
    clearPendingPlayConfirmation();
    setIsLoading(false);
    setLoadingUri(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const stop = async () => {
    operationIdRef.current++;
    clearPendingPlayConfirmation();
    try {
      // Always try to pause, regardless of currentUri state
      player.pause();
      setIsLoading(false);
      setLoadingUri(null);

      if (currentUri) {
        await player.seekTo(0);
      }
    } catch (error) {
    }
  };

  // Square button: restart the current track from scratch. Re-resolves the
  // source and plays from 0 via the same fresh-load path as loadAndPlay, so a
  // fresh native item is created — this both restarts playback and recovers a
  // wedged player that stopped emitting status events. Works during loading
  // too (the escape hatch): falls back to `loadingUri` when `currentUri` isn't
  // set yet (mid-load, before the source was replaced).
  const restart = async () => {
    const uri = currentUri ?? loadingUri;
    if (!uri) {
      return;
    }

    const operationId = ++operationIdRef.current;
    clearPendingPlayConfirmation();
    try {
      onPlayStart();
      setIsLoading(true);
      setLoadingUri(uri);

      if (player.playing) {
        player.pause();
      }

      const playableUri = await audioCacheService.getPlayableUri(uri);
      if (operationId !== operationIdRef.current) return;

      await playResolvedSource(uri, playableUri, operationId);
      if (operationId !== operationIdRef.current) return;

      armPlayConfirmation(operationId);

      if (isRemoteUri(uri) && playableUri === uri) {
        audioCacheService.warmAudio(uri, { knownDurationSec: knownDurationRef.current }).catch((error) => {
          console.warn('Failed to warm restarted audio cache:', error);
        });
      }
    } catch (error) {
      clearPendingPlayConfirmation();
      if (operationId !== operationIdRef.current) return;
      console.error('Error restarting audio:', error);
    } finally {
      if (operationId === operationIdRef.current && pendingPlayConfirmationRef.current !== operationId) {
        setIsLoading(false);
        setLoadingUri(null);
      }
    }
  };

  const seekForward = async (seconds: number) => {
    try {
      if (!currentUri) {
        return;
      }

      const effectiveDurationSec = getEffectiveDuration();
      const newPosition = effectiveDurationSec != null
        ? Math.min(player.currentTime + seconds, effectiveDurationSec)
        : player.currentTime + seconds;
      await player.seekTo(newPosition);
    } catch (error) {
    }
  };

  const seekBackward = async (seconds: number) => {
    try {
      if (!currentUri) {
        return;
      }

      const newPosition = Math.max(player.currentTime - seconds, 0);
      await player.seekTo(newPosition);
    } catch (error) {
    }
  };

  const seekTo = async (progressValue: number) => {
    try {
      const effectiveDurationSec = getEffectiveDuration();
      if (!currentUri || effectiveDurationSec == null) {
        return;
      }

      const clampedProgress = Math.max(0, Math.min(1, progressValue));
      const newPosition = clampedProgress * effectiveDurationSec;
      await player.seekTo(newPosition);
    } catch (error) {
    }
  };

  const togglePlayPause = async () => {
    try {
      if (!currentUri) {
        return;
      }

      if (isPlaying) {
        await pause();
      } else {
        await play();
      }
    } catch (error) {
    }
  };

  const rewind = async () => {
    await seekBackward(10);
  };

  const forward = async () => {
    await seekForward(10);
  };

  const toggleMute = async () => {
    try {
      if (!currentUri) {
        return;
      }

      if (isMuted) {
        player.volume = previousVolumeRef.current;
        setIsMuted(false);
      } else {
        previousVolumeRef.current = player.volume;
        player.volume = 0;
        setIsMuted(true);
      }
    } catch (error) {
    }
  };

  const getPlaybackSnapshot = useCallback((): PlaybackSnapshot => {
    try {
      const pos = player.currentTime;
      const effectiveDurationSec = getEffectiveDuration();
      return {
        positionSec: isFinite(pos) && pos >= 0 ? pos : 0,
        durationSec: effectiveDurationSec ?? 0,
        isPlaying: player.playing,
      };
    } catch {
      return { positionSec: 0, durationSec: 0, isPlaying: false };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return {
    isPlaying,
    isLoading,
    loadingUri,
    currentTime,
    totalTime,
    remainingTime,
    progress,
    isMuted,
    currentUri,
    play,
    pause,
    stop,
    restart,
    togglePlayPause,
    toggleMute,
    seekForward,
    seekBackward,
    seekTo,
    rewind,
    forward,
    loadAudio,
    loadAndPlay,
    unloadAudio,
    getPlaybackSnapshot,
    pauseFromCoordinator,
  };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  // One persistent native player per logical channel. These live for the
  // lifetime of the app, so audio keeps playing as the user navigates.
  //
  // keepAudioSessionActive: true is critical. By default expo-audio calls
  // AVAudioSession.setActive(false) 100ms after every pause() if no player has
  // yet reached timeControlStatus == .playing. When a large audio streams over
  // cellular (the only case not served from the WiFi-warmed cache), it sits in
  // .waitingToPlayAtSpecifiedRate for well over 100ms while buffering — so that
  // delayed deactivation tears the audio session down mid-buffer and the player
  // wedges in .waitingToPlayAtSpecifiedRate forever (no audio, no status
  // events, spinner never clears). Small/cached files reach .playing inside the
  // 100ms window and are unaffected — which is exactly why only the big files,
  // and only on cellular, failed. Keeping the session active removes that
  // deactivate-on-pause entirely; the app already owns the session lifecycle
  // globally via setAudioModeAsync/setIsAudioActiveAsync and never deactivates
  // it, so this is consistent. See .agents/memory/audio-playback-architecture.md.
  const keepSessionActive = { keepAudioSessionActive: true };
  const mainPlayer = useExpoAudioPlayer(null, keepSessionActive);
  const reflectionPlayer = useExpoAudioPlayer(null, keepSessionActive);
  const fortydayPlayer = useExpoAudioPlayer(null, keepSessionActive);
  const channelsRef = useRef<Partial<Record<ChannelName, InternalAudioChannel>>>({});

  // Configure the audio session once so playback continues when the app is
  // backgrounded or the device is locked (and iOS surfaces lock-screen
  // transport controls for the active playback session).
  useEffect(() => {
    configureBackgroundAudioSession().catch((error) => {
      console.warn('Failed to configure audio mode:', error);
    });

    // Only re-arm on return to foreground. Re-running this on every
    // transition (including going to background/inactive) risked fighting
    // the OS's own interruption handling, e.g. re-activating the session
    // right as a phone call or Siri interruption was taking it over.
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active') return;
      configureBackgroundAudioSession().catch((error) => {
        console.warn('Failed to keep audio session active:', error);
      });
    });

    return () => subscription.remove();
  }, []);

  // Pause the other channels' native players so only one stream is audible
  // at a time, mirroring the in-screen behavior but enforced globally.
  const pauseOthers = useCallback((keep: ChannelName) => {
    if (keep !== 'main') channelsRef.current.main?.pauseFromCoordinator();
    if (keep !== 'reflection') channelsRef.current.reflection?.pauseFromCoordinator();
    if (keep !== 'fortyday') channelsRef.current.fortyday?.pauseFromCoordinator();
  }, []);

  const main = useAudioChannel(mainPlayer, useCallback(() => pauseOthers('main'), [pauseOthers]));
  const reflection = useAudioChannel(reflectionPlayer, useCallback(() => pauseOthers('reflection'), [pauseOthers]));
  const fortyday = useAudioChannel(fortydayPlayer, useCallback(() => pauseOthers('fortyday'), [pauseOthers]));
  channelsRef.current = { main, reflection, fortyday };

  useEffect(() => {
    registeredStopAllAudio = async () => {
      await Promise.all([
        channelsRef.current.main?.unloadAudio(),
        channelsRef.current.reflection?.unloadAudio(),
        channelsRef.current.fortyday?.unloadAudio(),
      ]);
    };

    return () => {
      if (registeredStopAllAudio) {
        registeredStopAllAudio = null;
      }
    };
  }, []);

  return (
    <AudioPlayerContext.Provider value={{ main, reflection, fortyday }}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioChannelContext(channel: ChannelName): AudioChannel {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error('useAudioChannelContext must be used within an AudioPlayerProvider');
  }
  return ctx[channel];
}
