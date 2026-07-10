import { useAudioPlayerStatus, createAudioPlayer, AudioPlayer, AudioSource, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
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

const normalizeKnownDuration = (value?: number): number | null =>
  typeof value === 'number' && isFinite(value) && value > 0 ? value : null;

// Options for every player instance. keepAudioSessionActive:true stops
// expo-audio from deactivating the shared AVAudioSession on pause() — that
// delayed setActive(false) is what killed a large file mid-buffer on cellular
// (see .agents/memory/audio-playback-architecture.md). Each track gets its own
// fresh player built with these options.
const PLAYER_OPTIONS = { keepAudioSessionActive: true };

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
  onPlayStart: () => void
): InternalAudioChannel {
  // Fresh player per track — NOT one reused player + replace(). A long-lived
  // AVPlayer that has had several items swapped into it via replace() gets
  // stuck in `.waitingToPlayAtSpecifiedRate` on cellular for large files,
  // worst on a return visit; a brand-new player has no accumulated state and
  // starts cleanly. The player lives in state so `useAudioPlayerStatus`
  // re-subscribes whenever we swap it; `playerRef` mirrors it for imperative
  // calls (which may run right after a swap, before the re-render).
  const [player, setPlayer] = useState<AudioPlayer>(() => createAudioPlayer(null, PLAYER_OPTIONS));
  const playerRef = useRef<AudioPlayer>(player);
  // The actual URI handed to the current player (a local file:// path for a
  // cached track, or the remote http(s) URL when streaming). Lets the
  // same-track "second play" branch tell a cheap local resume from a streamed
  // one that needs a fresh player — see loadAndPlay.
  const resolvedSourceUriRef = useRef<string | null>(null);
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

  // Dispose the previous player after a swap. `createAudioPlayer` instances are
  // NOT auto-released (unlike the useAudioPlayer hook), so we must remove() the
  // old one or leak native resources. Runs as a post-render effect, so
  // `useAudioPlayerStatus` has already moved its subscription to the new player
  // before the old one is torn down.
  const prevPlayerRef = useRef<AudioPlayer>(player);
  useEffect(() => {
    const prev = prevPlayerRef.current;
    if (prev !== player) {
      try { prev.remove(); } catch {}
      prevPlayerRef.current = player;
    }
  }, [player]);

  // Best-effort release of the last player on teardown (app exit).
  useEffect(() => {
    return () => { try { playerRef.current?.remove(); } catch {} };
  }, []);

  // Build a brand-new player for `resolvedUri`, make it the current player, and
  // return it. Sets `playerRef` synchronously so the imperative caller can act
  // on the new player immediately; `setPlayer` triggers the re-render that
  // re-subscribes status and disposes the old player (effect above).
  const swapToFreshPlayer = (resolvedUri: string): AudioPlayer => {
    const source: AudioSource = { uri: resolvedUri };
    const next = createAudioPlayer(source, PLAYER_OPTIONS);
    playerRef.current = next;
    resolvedSourceUriRef.current = resolvedUri;
    setPlayer(next);
    return next;
  };

  const getEffectiveDuration = (): number | null => {
    const p = playerRef.current;
    if (isFinite(p.duration) && p.duration > 0) return p.duration;
    return knownDurationRef.current;
  };

  const clearPendingPlayConfirmation = () => {
    pendingPlayConfirmationRef.current = null;
    if (playConfirmationTimeoutRef.current) {
      clearTimeout(playConfirmationTimeoutRef.current);
      playConfirmationTimeoutRef.current = null;
    }
  };

  // Marks a fresh-load operation as waiting for the native player to confirm
  // playback (status.playing) before the loading spinner clears. The actual
  // wait logic lives in the status-watching effect below, which reads the
  // native `status.isBuffering` signal instead of guessing off a fixed
  // timeout — see that effect for why.
  const armPlayConfirmation = (operationId: number) => {
    pendingPlayConfirmationRef.current = operationId;
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
    // Fresh player for this track — never reuse/replace the previous one.
    const p = swapToFreshPlayer(resolvedUri);
    if (operationId !== operationIdRef.current) return;

    setIsMuted(false);
    previousVolumeRef.current = 1.0;
    p.volume = 1.0;
    setCurrentUri(uri);

    await setIsAudioActiveAsync(true);
    if (operationId !== operationIdRef.current) return;
    p.play();
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

      // Pause the outgoing player before swapping in the new one.
      try { playerRef.current.pause(); } catch {}

      const cachedUri = await audioCacheService.getAudioUri(uri);
      if (operationId !== operationIdRef.current) return;

      // Fresh player for the preloaded track (no play() — this is a preload).
      const p = swapToFreshPlayer(cachedUri);
      if (operationId !== operationIdRef.current) return;

      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      p.volume = 1.0;

      setCurrentUri(uri);
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

      // Same audio already loaded — this is a "second play" (resume after a
      // pause, or replay after it finished).
      if (currentUri === uri) {
        const p = playerRef.current;
        if (p.playing) return;

        // A locally-cached track resumes in place: reusing its player is a
        // pure native operation (no fetch, no decode), instant and reliable,
        // so it never shows the loading spinner.
        const sourceIsRemoteStream = isRemoteUri(resolvedSourceUriRef.current ?? '');
        if (!sourceIsRemoteStream) {
          if (isPlayerAtEnd(p)) {
            await p.seekTo(0);
            if (operationId !== operationIdRef.current) return;
          }
          await setIsAudioActiveAsync(true);
          if (operationId !== operationIdRef.current) return;
          p.play();
          return;
        }

        // Streamed track (e.g. the heavy files on cellular, which never cache
        // — warmAudio is WiFi-only): do NOT reuse this player. An AVPlayer that
        // has already streamed a large remote file accumulates state and gets
        // stuck in `.waitingToPlayAtSpecifiedRate` when replayed/resumed on
        // cellular — the exact reused-player stall the per-track fresh-player
        // fix removed, which also applies to a *second play of the same*
        // streamed track. Rebuild a fresh player (re-resolving in case it has
        // since cached), preserving position for a mid-stream resume.
        const resumePositionSec = isPlayerAtEnd(p) ? 0 : Math.max(0, p.currentTime);
        setIsLoading(true);
        setLoadingUri(uri);
        try { p.pause(); } catch {}

        const playableUri = await audioCacheService.getPlayableUri(uri);
        if (operationId !== operationIdRef.current) return;

        const fresh = swapToFreshPlayer(playableUri);
        if (operationId !== operationIdRef.current) return;

        setIsMuted(false);
        previousVolumeRef.current = 1.0;
        fresh.volume = 1.0;

        await setIsAudioActiveAsync(true);
        if (operationId !== operationIdRef.current) return;
        if (resumePositionSec > 0) {
          try { await fresh.seekTo(resumePositionSec); } catch {}
          if (operationId !== operationIdRef.current) return;
        }
        fresh.play();
        armPlayConfirmation(operationId);
        return;
      }

      setIsLoading(true);
      setLoadingUri(uri);

      try { playerRef.current.pause(); } catch {}

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
        audioCacheService.warmAudio(uri).catch((error) => {
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
      if (playerRef.current.playing) {
        playerRef.current.pause();
      }

      setIsLoading(false);
      // Leave the current player loaded; state cleared below.

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
      const p = playerRef.current;
      if (!p.playing) {
        if (isPlayerAtEnd(p)) {
          await p.seekTo(0);
          if (operationId !== operationIdRef.current) return;
        }
        await setIsAudioActiveAsync(true);
        if (operationId !== operationIdRef.current) return;
        onPlayStart();
        p.play();
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

      if (playerRef.current.playing) {
        playerRef.current.pause();
      }
    } catch (error) {
    }
  };

  const pauseFromCoordinator = useCallback(() => {
    operationIdRef.current++;
    try {
      playerRef.current.pause();
    } catch {}
    clearPendingPlayConfirmation();
    setIsLoading(false);
    setLoadingUri(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = async () => {
    operationIdRef.current++;
    clearPendingPlayConfirmation();
    try {
      // Always try to pause, regardless of currentUri state
      playerRef.current.pause();
      setIsLoading(false);
      setLoadingUri(null);

      if (currentUri) {
        await playerRef.current.seekTo(0);
      }
    } catch (error) {
    }
  };

  const seekForward = async (seconds: number) => {
    try {
      if (!currentUri) {
        return;
      }

      const p = playerRef.current;
      const effectiveDurationSec = getEffectiveDuration();
      const newPosition = effectiveDurationSec != null
        ? Math.min(p.currentTime + seconds, effectiveDurationSec)
        : p.currentTime + seconds;
      await p.seekTo(newPosition);
    } catch (error) {
    }
  };

  const seekBackward = async (seconds: number) => {
    try {
      if (!currentUri) {
        return;
      }

      const p = playerRef.current;
      const newPosition = Math.max(p.currentTime - seconds, 0);
      await p.seekTo(newPosition);
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
      await playerRef.current.seekTo(newPosition);
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
        playerRef.current.volume = previousVolumeRef.current;
        setIsMuted(false);
      } else {
        previousVolumeRef.current = playerRef.current.volume;
        playerRef.current.volume = 0;
        setIsMuted(true);
      }
    } catch (error) {
    }
  };

  const getPlaybackSnapshot = useCallback((): PlaybackSnapshot => {
    try {
      const p = playerRef.current;
      const pos = p.currentTime;
      const effectiveDurationSec = getEffectiveDuration();
      return {
        positionSec: isFinite(pos) && pos >= 0 ? pos : 0,
        durationSec: effectiveDurationSec ?? 0,
        isPlaying: p.playing,
      };
    } catch {
      return { positionSec: 0, durationSec: 0, isPlaying: false };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Each channel owns its player internally (a fresh instance per track — see
  // useAudioChannel). The channels themselves live for the lifetime of the app
  // (provider mounted above navigation), so playback survives screen changes.
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

  const main = useAudioChannel(useCallback(() => pauseOthers('main'), [pauseOthers]));
  const reflection = useAudioChannel(useCallback(() => pauseOthers('reflection'), [pauseOthers]));
  const fortyday = useAudioChannel(useCallback(() => pauseOthers('fortyday'), [pauseOthers]));
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
