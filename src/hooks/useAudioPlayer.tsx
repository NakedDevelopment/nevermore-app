import { useAudioChannelContext, AudioChannel, PlaybackSnapshot } from '../contexts/AudioPlayerProvider';

export type { PlaybackSnapshot };

type UseAudioPlayerReturn = AudioChannel;

/**
 * Consumes the global `main` audio channel from AudioPlayerProvider.
 * The underlying player lives above navigation, so playback persists
 * across screen transitions.
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  return useAudioChannelContext('main');
}
