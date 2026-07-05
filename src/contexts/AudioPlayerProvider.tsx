import { useAudioPlayer as useExpoAudioPlayer, AudioPlayer, AudioSource, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
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
 */
function useAudioChannel(
  player: AudioPlayer,
  onPlayStart: () => void
): InternalAudioChannel {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUri, setLoadingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('--:--');
  const [remainingTime, setRemainingTime] = useState('--:--');
  const [progress, setProgress] = useState(0);
  const previousVolumeRef = useRef<number>(1.0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const operationIdRef = useRef(0);
  // A duration computed ahead of time and stored on the content record (see
  // `knownDurationSec` on loadAudio/loadAndPlay). Used whenever the native
  // player hasn't (or never does) resolve its own `duration` from the stream.
  const knownDurationRef = useRef<number | null>(null);

  const getEffectiveDuration = (): number | null => {
    if (isFinite(player.duration) && player.duration > 0) return player.duration;
    return knownDurationRef.current;
  };

  const syncDurationWhenAvailable = async (operationId: number, maxAttempts = 30) => {
    let attempts = 0;
    while ((!isFinite(player.duration) || player.duration === 0) && attempts < maxAttempts) {
      if (operationId !== operationIdRef.current) return;
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (operationId !== operationIdRef.current) return;

    const effectiveDuration = getEffectiveDuration();
    const durationKnown = effectiveDuration != null;
    setTotalTime(durationKnown ? formatTime(effectiveDuration * 1000) : '--:--');
    setRemainingTime(durationKnown ? formatTime(Math.max(0, effectiveDuration * 1000 - player.currentTime * 1000)) : '--:--');
    setProgress(durationKnown ? player.currentTime / effectiveDuration : 0);
  };

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
    setCurrentTime('00:00');

    const effectiveDuration = getEffectiveDuration();
    setTotalTime(effectiveDuration != null ? formatTime(effectiveDuration * 1000) : '--:--');
    setRemainingTime(effectiveDuration != null ? formatTime(effectiveDuration * 1000) : '--:--');
    setProgress(0);
    setCurrentUri(uri);

    await setIsAudioActiveAsync(true);
    await player.play();
    setIsPlaying(true);
    void syncDurationWhenAvailable(operationId);
  };

  // Sync player state with React state
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (currentUri) {
      intervalRef.current = setInterval(() => {
        try {
          setIsPlaying(player.playing);
          const currentTimeMs = player.currentTime * 1000;
          const effectiveDuration = getEffectiveDuration();
          const durationValid = effectiveDuration != null;
          const durationMs = durationValid ? effectiveDuration * 1000 : 0;
          setCurrentTime(formatTime(currentTimeMs));
          setTotalTime(durationValid ? formatTime(durationMs) : '--:--');
          setRemainingTime(durationValid ? formatTime(Math.max(0, durationMs - currentTimeMs)) : '--:--');
          setProgress(durationValid ? player.currentTime / effectiveDuration : 0);
          if (isPlayerAtEnd(player) && !player.playing) {
            setIsPlaying(false);
            setProgress(1);
          }
        } catch (error) {
          // Native player became unreadable (e.g. released). Log it instead
          // of silently swallowing, since this previously left the UI frozen
          // on stale time/progress with no diagnostic trail.
          console.warn('AudioPlayerProvider: failed to read player state', error);
        }
      }, 250);
    } else {
      setIsPlaying(false);
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setRemainingTime('--:--');
      setProgress(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUri]);

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
      setIsPlaying(false);

      // Always pause before loading new audio to prevent overlap
      player.pause();

      const cachedUri = await audioCacheService.getAudioUri(uri);
      if (operationId !== operationIdRef.current) return;

      const audioSource: AudioSource = { uri: cachedUri };
      await player.replace(audioSource);
      if (operationId !== operationIdRef.current) return;

      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      player.volume = 1.0;

      setCurrentTime('00:00');
      const effectiveDuration = getEffectiveDuration();
      setTotalTime(effectiveDuration != null ? formatTime(effectiveDuration * 1000) : '--:--');
      setRemainingTime(effectiveDuration != null ? formatTime(effectiveDuration * 1000) : '--:--');
      setProgress(0);

      setCurrentUri(uri);
      void syncDurationWhenAvailable(operationId);
    } catch (error) {
      if (operationId !== null && operationId !== operationIdRef.current) return;
      console.error('Error loading audio:', error);
      setCurrentUri(null);
      setIsPlaying(false);
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setRemainingTime('--:--');
      setProgress(0);
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
      setIsLoading(true);
      setLoadingUri(uri);
      onPlayStart();

      // If same audio is already loaded, just play it
      if (currentUri === uri) {
        if (!player.playing) {
          if (isPlayerAtEnd(player)) {
            await player.seekTo(0);
            setCurrentTime('00:00');
            setProgress(0);
          }
          await setIsAudioActiveAsync(true);
          await player.play();
          setIsPlaying(true);
        }
        return;
      }

      setIsPlaying(false);

      if (player.playing) {
        player.pause();
      }

      const playableUri = await audioCacheService.getPlayableUri(uri);
      if (operationId !== operationIdRef.current) return;

      await playResolvedSource(uri, playableUri, operationId);
      if (operationId !== operationIdRef.current) return;

      setIsLoading(false);
      setLoadingUri(null);

      // Playing a not-yet-cached remote track directly: warm the cache in the
      // background (this is also what gives the file its correct extension
      // via magic-byte sniffing, so a future play gets working duration/seek
      // metadata) without blocking or interrupting the playback that already
      // started.
      if (isRemoteUri(uri) && playableUri === uri) {
        audioCacheService.warmAudio(uri).catch((error) => {
          console.warn('Failed to warm streamed audio cache:', error);
        });
      }
    } catch (error) {
      if (operationId !== operationIdRef.current) return;
      console.error('Error loading and playing audio:', error);
      setCurrentUri(null);
      setIsPlaying(false);
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setRemainingTime('--:--');
      setProgress(0);
    } finally {
      if (operationId === operationIdRef.current) {
        setIsLoading(false);
        setLoadingUri(null);
      }
    }
  };

  const unloadAudio = async () => {
    operationIdRef.current++;
    knownDurationRef.current = null;
    try {
      if (player.playing) {
        player.pause();
      }

      setIsPlaying(false);
      setIsLoading(false);
      // Don't call replace(null) - it's not supported
      // Just clear our state and let the player keep the last audio loaded

      setCurrentUri(null);
      setLoadingUri(null);
      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setRemainingTime('--:--');
      setProgress(0);
    } catch (error) {
      setCurrentUri(null);
      setLoadingUri(null);
      setIsPlaying(false);
      setIsLoading(false);
      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setRemainingTime('--:--');
      setProgress(0);
    }
  };

  const play = async () => {
    const operationId = ++operationIdRef.current;
    try {
      if (!currentUri) {
        return;
      }

      if (!player.playing) {
        setIsLoading(true);
        setLoadingUri(currentUri);
        if (isPlayerAtEnd(player)) {
          await player.seekTo(0);
          if (operationId !== operationIdRef.current) return;
          setCurrentTime('00:00');
          setProgress(0);
        }
        await setIsAudioActiveAsync(true);
        if (operationId !== operationIdRef.current) return;
        onPlayStart();
        await player.play();
        if (operationId !== operationIdRef.current) return;
        setIsPlaying(true);
      }
    } catch (error) {
      if (operationId !== operationIdRef.current) return;
      setIsPlaying(false);
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
    setIsLoading(false);
    setLoadingUri(null);
    try {
      if (!currentUri) {
        return;
      }

      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      }
    } catch (error) {
    }
  };

  const pauseFromCoordinator = useCallback(() => {
    operationIdRef.current++;
    try {
      player.pause();
    } catch {}
    setIsPlaying(false);
    setIsLoading(false);
    setLoadingUri(null);
  }, [player]);

  const stop = async () => {
    operationIdRef.current++;
    try {
      // Always try to pause, regardless of currentUri state
      player.pause();
      setIsPlaying(false);
      setIsLoading(false);
      setLoadingUri(null);

      if (currentUri) {
        await player.seekTo(0);
        setCurrentTime('00:00');
        setProgress(0);
      }
    } catch (error) {
    }
  };

  const seekForward = async (seconds: number) => {
    try {
      if (!currentUri) {
        return;
      }

      const effectiveDuration = getEffectiveDuration();
      const newPosition = effectiveDuration != null
        ? Math.min(player.currentTime + seconds, effectiveDuration)
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
      const effectiveDuration = getEffectiveDuration();
      if (!currentUri || effectiveDuration == null) {
        return;
      }

      const clampedProgress = Math.max(0, Math.min(1, progressValue));
      const newPosition = clampedProgress * effectiveDuration;
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
      const effectiveDuration = getEffectiveDuration();
      return {
        positionSec: isFinite(pos) && pos >= 0 ? pos : 0,
        durationSec: effectiveDuration ?? 0,
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
  const mainPlayer = useExpoAudioPlayer();
  const reflectionPlayer = useExpoAudioPlayer();
  const fortydayPlayer = useExpoAudioPlayer();
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
