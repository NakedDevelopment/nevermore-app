import { useEffect, useState, useCallback, useRef } from 'react';
import { useAudioChannelContext, AudioChannel } from '../contexts/AudioPlayerProvider';

interface UseAudioPlaylistReturn {
  selectedAudioIndex: number;
  audioPlayer: AudioChannel;
  handleAudioSelect: (index: number) => Promise<void>;
  loadPlaylist: (audioUrls: string[]) => void;
}

/**
 * Hook to manage audio playlist with selection and auto-play functionality.
 * Backed by the global `reflection` audio channel so playback persists across
 * navigation; only the playlist selection state is local to the screen.
 */
export function useAudioPlaylist(autoPlay: boolean = true): UseAudioPlaylistReturn {
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number>(0);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);
  const prevIsLoadingRef = useRef(false);
  const audioPlayer = useAudioChannelContext('reflection');

  // Load audio when selectedAudioIndex changes
  useEffect(() => {
    const loadAudio = async () => {
      if (audioUrls.length === 0) {
        return;
      }

      // If the persistent reflection player is already on one of these tracks
      // (e.g. we navigated away and back), adopt that selection instead of
      // forcing a reload of the first item — this preserves playback.
      const loadedIndex = audioPlayer.currentUri
        ? audioUrls.indexOf(audioPlayer.currentUri)
        : -1;
      if (loadedIndex !== -1) {
        if (loadedIndex !== selectedAudioIndex) {
          setSelectedAudioIndex(loadedIndex);
        }
        return;
      }

      if (audioUrls[selectedAudioIndex]) {
        const audioUrl = audioUrls[selectedAudioIndex];
        console.log('Loading audio from:', audioUrl);
        await audioPlayer.loadAudio(audioUrl);
      }
    };

    loadAudio();
    // No unmount teardown: the global reflection player persists across
    // navigation so audio keeps playing when leaving the screen.
  }, [selectedAudioIndex, audioUrls]);

  // Auto-play when loading completes (transitions from loading to not loading)
  useEffect(() => {
    const loadingJustFinished = prevIsLoadingRef.current && !audioPlayer.isLoading;
    prevIsLoadingRef.current = audioPlayer.isLoading;
    
    if (pendingAutoPlay && loadingJustFinished) {
      setPendingAutoPlay(false);
      audioPlayer.play();
    }
  }, [pendingAutoPlay, audioPlayer.isLoading]);

  /**
   * Handle audio selection with toggle play/pause or auto-play
   */
  const handleAudioSelect = useCallback(async (index: number) => {
    if (!audioUrls[index]) {
      console.warn('Audio not found at index:', index);
      return;
    }

    // If selecting the same audio that's already playing, toggle play/pause
    if (index === selectedAudioIndex) {
      if (audioPlayer.isPlaying) {
        await audioPlayer.pause();
      } else {
        await audioPlayer.play();
      }
    } else {
      // Stop current audio before switching to prevent overlap
      await audioPlayer.stop();
      
      // Select new audio - useEffect will handle loading
      setSelectedAudioIndex(index);
      
      // Set pending auto-play - will trigger when loading completes
      if (autoPlay) {
        setPendingAutoPlay(true);
      }
    }
  }, [audioUrls, selectedAudioIndex, audioPlayer, autoPlay]);

  /**
   * Load playlist with audio URLs
   */
  const loadPlaylist = useCallback((urls: string[]) => {
    setAudioUrls(urls);
  }, []);

  return {
    selectedAudioIndex,
    audioPlayer,
    handleAudioSelect,
    loadPlaylist,
  };
}

