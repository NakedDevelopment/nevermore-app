import { useAudioPlayer as useExpoAudioPlayer, AudioPlayer, AudioSource, setAudioModeAsync } from 'expo-audio';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { audioCacheService } from '../services/audioCache.service';

export type PlaybackSnapshot = {
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
};

export interface AudioChannel {
  isPlaying: boolean;
  isLoading: boolean;
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

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const formatTime = (milliseconds: number): string => {
  if (!isFinite(milliseconds) || milliseconds < 0 || isNaN(milliseconds)) {
    return '00:00';
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
): AudioChannel {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('--:--');
  const [progress, setProgress] = useState(0);
  const previousVolumeRef = useRef<number>(1.0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        } catch {
          // native player already released
        }
      }, 100);
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
    try {
      if (!uri || uri.trim() === '') {
        return;
      }

      // Don't reload if it's the same audio
      if (currentUri === uri) {
        return;
      }

      setIsLoading(true);
      setIsPlaying(false);

      // Always pause before loading new audio to prevent overlap
      player.pause();

      // Get cached audio URI (downloads if not cached)
      const cachedUri = await audioCacheService.getAudioUri(uri);

      const audioSource: AudioSource = { uri: cachedUri };
      await player.replace(audioSource);

      // Wait for duration to be available
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      while ((!isFinite(player.duration) || player.duration === 0) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      player.volume = 1.0;

      // Initialize time values
      const durationMs = player.duration * 1000;
      setCurrentTime('00:00');
      setTotalTime(isFinite(player.duration) && player.duration > 0 ? formatTime(durationMs) : '--:--');
      setProgress(0);

      setCurrentUri(uri);
    } catch (error) {
      console.error('Error loading audio:', error);
      setCurrentUri(null);
      setIsPlaying(false);
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAndPlay = async (uri: string) => {
    try {
      if (!uri || uri.trim() === '') {
        return;
      }

      // If same audio is already loaded, just play it
      if (currentUri === uri) {
        if (!player.playing) {
          onPlayStart();
          await player.play();
          setIsPlaying(true);
        }
        return;
      }

      setIsLoading(true);
      setIsPlaying(false);

      if (player.playing) {
        player.pause();
      }

      const cachedUri = await audioCacheService.getAudioUri(uri);

      const audioSource: AudioSource = { uri: cachedUri };
      await player.replace(audioSource);

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max
      while ((!isFinite(player.duration) || player.duration === 0) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      player.volume = 1.0;

      const durationMs = player.duration * 1000;
      setCurrentTime('00:00');
      setTotalTime(isFinite(player.duration) && player.duration > 0 ? formatTime(durationMs) : '--:--');
      setProgress(0);

      setCurrentUri(uri);

      // Play immediately after loading - don't wait for state update
      onPlayStart();
      await player.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error loading and playing audio:', error);
      setCurrentUri(null);
      setIsPlaying(false);
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const unloadAudio = async () => {
    try {
      if (player.playing) {
        player.pause();
      }

      setIsPlaying(false);
      // Don't call replace(null) - it's not supported
      // Just clear our state and let the player keep the last audio loaded

      setCurrentUri(null);
      setIsMuted(false);
      previousVolumeRef.current = 1.0;
      setCurrentTime('00:00');
      setTotalTime('--:--');
      setProgress(0);
    } catch (error) {
      setCurrentUri(null);
      setIsPlaying(false);
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
        onPlayStart();
        await player.play();
        setIsPlaying(true);
      }
    } catch (error) {
      setIsPlaying(false);
    }
  };

  const pause = async () => {
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

  const stop = async () => {
    try {
      // Always try to pause, regardless of currentUri state
      player.pause();
      setIsPlaying(false);

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
  };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  // One persistent native player per logical channel. These live for the
  // lifetime of the app, so audio keeps playing as the user navigates.
  const mainPlayer = useExpoAudioPlayer();
  const reflectionPlayer = useExpoAudioPlayer();
  const fortydayPlayer = useExpoAudioPlayer();

  // Configure the audio session once so playback continues when the app is
  // backgrounded or the device is locked (and iOS surfaces lock-screen
  // transport controls for the active playback session).
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      interruptionModeAndroid: 'doNotMix',
    }).catch((error) => {
      console.warn('Failed to configure audio mode:', error);
    });
  }, []);

  // Pause the other channels' native players so only one stream is audible
  // at a time, mirroring the in-screen behavior but enforced globally.
  const pauseOthers = useCallback((keep: ChannelName) => {
    try {
      if (keep !== 'main' && mainPlayer.playing) mainPlayer.pause();
    } catch {}
    try {
      if (keep !== 'reflection' && reflectionPlayer.playing) reflectionPlayer.pause();
    } catch {}
    try {
      if (keep !== 'fortyday' && fortydayPlayer.playing) fortydayPlayer.pause();
    } catch {}
  }, [mainPlayer, reflectionPlayer, fortydayPlayer]);

  const main = useAudioChannel(mainPlayer, useCallback(() => pauseOthers('main'), [pauseOthers]));
  const reflection = useAudioChannel(reflectionPlayer, useCallback(() => pauseOthers('reflection'), [pauseOthers]));
  const fortyday = useAudioChannel(fortydayPlayer, useCallback(() => pauseOthers('fortyday'), [pauseOthers]));

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
