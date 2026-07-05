import { useState, useCallback } from 'react';
import { useAudioChannelContext, AudioChannel } from '../contexts/AudioPlayerProvider';

interface UseAudioPlaylistReturn {
  selectedAudioIndex: number;
  audioPlayer: AudioChannel;
  handleAudioSelect: (index: number) => Promise<void>;
  loadPlaylist: (audioUrls: string[], audioDurations?: (number | null | undefined)[]) => void;
}

/**
 * Manages a role-specific exercise/question audio playlist.
 *
 * Playback uses the global `reflection` channel, but selection is local to the
 * current screen so tapping Exercise 2 always loads Exercise 2 instead of
 * re-adopting a previously loaded track.
 */
export function useAudioPlaylist(autoPlay: boolean = true): UseAudioPlaylistReturn {
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number>(-1);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [audioDurations, setAudioDurations] = useState<(number | null | undefined)[]>([]);
  const audioPlayer = useAudioChannelContext('reflection');

  const handleAudioSelect = useCallback(async (index: number) => {
    const audioUrl = audioUrls[index];

    if (!audioUrl) {
      console.warn('Audio not found at index:', index);
      return;
    }

    const knownDurationSec = audioDurations[index] ?? undefined;

    if (index === selectedAudioIndex && audioPlayer.currentUri === audioUrl) {
      if (audioPlayer.isPlaying) {
        await audioPlayer.pause();
      } else {
        await audioPlayer.play();
      }
      return;
    }

    setSelectedAudioIndex(index);
    await audioPlayer.stop();

    if (autoPlay) {
      await audioPlayer.loadAndPlay(audioUrl, knownDurationSec);
    } else {
      await audioPlayer.loadAudio(audioUrl, knownDurationSec);
    }
  }, [audioUrls, audioDurations, selectedAudioIndex, audioPlayer, autoPlay]);

  const loadPlaylist = useCallback((urls: string[], durations: (number | null | undefined)[] = []) => {
    setAudioUrls(urls);
    setAudioDurations(durations);
    const loadedIndex = audioPlayer.currentUri ? urls.indexOf(audioPlayer.currentUri) : -1;
    setSelectedAudioIndex(loadedIndex);
  }, [audioPlayer.currentUri]);

  return {
    selectedAudioIndex,
    audioPlayer,
    handleAudioSelect,
    loadPlaylist,
  };
}
