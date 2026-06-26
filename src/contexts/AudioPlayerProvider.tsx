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
  loadAudio: (uri: string) => Promise<void>;
  loadAndPlay: (uri: string) => Promise<void>;
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
  const [progress, setProgress] = useState(0);
  const previousVolumeRef = useRef<number>(1.0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const operationIdRef = useRef(0);

  const syncDurationWhenAvailable = async (operationId: number, maxAttempts = 30) => {
    let attempts = 0;
    while ((!isFinite(player.duration) || player.duration === 0) && attempts < maxAttempts) {
      if (operationId !== operationIdRef.current) return;
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (operationId !== operationIdRef.current) return;

    const durationMs = player.duration * 1000;
    setTotalTime(isFinite(player.duration) && player.duration > 0 ? formatTime(durationMs) : '--:--');
    setProgress(player.duration > 0 && isFinite(player.duration) ? player.currentTime / player.duration : 0);
  };

  const waitForPlaybackProgress = async (
    operationId: number,
    maxAttempts = 14,
    intervalMs = 150
  ): Promise<boolean> => {
    let attempts = 0;
    while (attempts < maxAttempts) {
      if (operationId !== operationIdRef.current) return false;
      try {
        if (player.playing && player.currentTime > 0.05) {
          return true;
        }
      } catch {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }

    try {
      return player.playing && player.currentTime > 0.05;
    } catch {
      return false;
    }
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
    setTotalTime(isFinite(player.duration) && player.duration > 0 ? formatTime(player.duration * 1000) : '--:--');
    setProgress(0);
    setCurrentUri(uri);

    await setIsAudioActiveAsync(true);
    await player.play();
    setIsPlaying(true);
    void syncDurationWhenAvailable(operationId);
  };

  const fallBackToCachedPlayback = async (uri: string, operationId: number): Promise<void> => {
    try {
      if (operationId !== operationIdRef.current) return;

      setIsLoading(true);
      setLoadingUri(uri);
      player.pause();

      const cachedUri = await audioCacheService.getAudioUri(uri);
      if (operationId !== operationIdRef.current) return;

      await playResolvedSource(uri, cachedUri, operationId);
    } catch (error) {
      if (operationId !== operationIdRef.current) return;
      console.error('Error falling back to cached audio:', error);
      setCurrentUri(null);
      setIsPlaying(false);
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setProgress(0);
    } finally {
      if (operationId === operationIdRef.current) {
        setIsLoading(false);
        setLoadingUri(null);
      }
    }
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
          const durationMs = player.duration * 1000;
          setCurrentTime(formatTime(currentTimeMs));
          setTotalTime(isFinite(player.duration) && player.duration > 0 ? formatTime(durationMs) : '--:--');
          setProgress(player.duration > 0 && isFinite(player.duration) ? player.currentTime / player.duration : 0);
          if (isPlayerAtEnd(player) && !player.playing) {
            setIsPlaying(false);
            setProgress(1);
          }
        } catch {
          // native player already released
        }
      }, 250);
    } else {
      setIsPlaying(false);
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setProgress(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUri]);

  const loadAudio = async (uri: string) => {
    let operationId: number | null = null;
    try {
      if (!uri || uri.trim() === '') {
        return;
      }

      // Don't reload if it's the same audio
      if (currentUri === uri) {
        return;
      }

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
      setTotalTime(isFinite(player.duration) && player.duration > 0 ? formatTime(player.duration * 1000) : '--:--');
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
      setProgress(0);
    } finally {
      if (operationId !== null && operationId === operationIdRef.current) {
        setIsLoading(false);
        setLoadingUri(null);
      }
    }
  };

  const loadAndPlay = async (uri: string) => {
    const operationId = ++operationIdRef.current;
    try {
      if (!uri || uri.trim() === '') {
        return;
      }

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
          onPlayStart();
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

      if (isRemoteUri(uri) && playableUri === uri) {
        const started = await waitForPlaybackProgress(operationId);
        if (!started && operationId === operationIdRef.current) {
          await fallBackToCachedPlayback(uri, operationId);
          return;
        }

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
      setProgress(0);
    }
  };

  const play = async () => {
    try {
      if (!currentUri) {
        return;
      }

      if (!player.playing) {
        setIsLoading(true);
        setLoadingUri(currentUri);
        if (isPlayerAtEnd(player)) {
          await player.seekTo(0);
          setCurrentTime('00:00');
          setProgress(0);
        }
        await setIsAudioActiveAsync(true);
        onPlayStart();
        await player.play();
        setIsPlaying(true);
      }
    } catch (error) {
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
      setLoadingUri(null);
    }
  };

  const pause = async () => {
    operationIdRef.current++;
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
      if (!currentUri || player.duration === 0) {
        return;
      }

      const newPosition = Math.min(
        player.currentTime + seconds,
        player.duration
      );
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
      if (!currentUri || player.duration === 0) {
        return;
      }

      const clampedProgress = Math.max(0, Math.min(1, progressValue));
      const newPosition = clampedProgress * player.duration;
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
      const dur = player.duration;
      const pos = player.currentTime;
      return {
        positionSec: isFinite(pos) && pos >= 0 ? pos : 0,
        durationSec: isFinite(dur) && dur > 0 ? dur : 0,
        isPlaying: player.playing,
      };
    } catch {
      return { positionSec: 0, durationSec: 0, isPlaying: false };
    }
  }, [player]);

  return {
    isPlaying,
    isLoading,
    loadingUri,
    currentTime,
    totalTime,
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

    const subscription = AppState.addEventListener('change', () => {
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
