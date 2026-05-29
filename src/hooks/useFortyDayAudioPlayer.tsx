import { useAudioChannelContext, AudioChannel } from '../contexts/AudioPlayerProvider';

type UseFortyDayAudioPlayerReturn = AudioChannel;

/**
 * Consumes the global `fortyday` audio channel from AudioPlayerProvider.
 * The underlying player lives above navigation, so playback persists
 * across screen transitions.
 */
export function useFortyDayAudioPlayer(): UseFortyDayAudioPlayerReturn {
  return useAudioChannelContext('fortyday');
}
