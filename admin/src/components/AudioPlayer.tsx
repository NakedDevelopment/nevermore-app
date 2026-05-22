import { useState, useRef, useEffect, useId } from 'react';
import PlayIcon from '../assets/icons/play';
import PauseIcon from '../assets/icons/pause';
import VolumeIcon from '../assets/icons/volume';
import VolumeOffIcon from '../assets/icons/volume-off';
import CloseIcon from '../assets/icons/close';
import { audioManager } from '../lib/audioManager';

export interface AudioPlayerProps {
  label: string;
  file?: File;
  url?: string;
  onRemove?: () => void;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  label,
  file,
  url,
  onRemove,
  className = '',
}) => {
  const playerId = useId();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastNonZeroVolumeRef = useRef<number>(1);

  // Create object URL when file changes, or use provided URL
  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setAudioUrl(objectUrl);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setIsLoading(true);
      setError(null);

      return () => {
        URL.revokeObjectURL(objectUrl);
        audioManager.unregister(playerId);
      };
    } else if (url) {
      setAudioUrl(url);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setIsLoading(true);
      setError(null);

      return () => {
        audioManager.unregister(playerId);
      };
    } else {
      setAudioUrl(null);
      return () => {
        audioManager.unregister(playerId);
      };
    }
  }, [file, url, playerId]);

  // Register audio element with manager and set up listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    // Register with audio manager
    audioManager.register(playerId, audio);

    const updateTime = () => {
      if (audio && !isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const updateDuration = () => {
      if (audio && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setIsLoading(false);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
      audioManager.pause(playerId);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
      setError(null);
      // Start time update interval for more reliable updates
      if (timeUpdateIntervalRef.current === null) {
        timeUpdateIntervalRef.current = window.setInterval(() => {
          const currentAudio = audioRef.current;
          if (currentAudio && !currentAudio.paused) {
            setCurrentTime(currentAudio.currentTime);
          }
        }, 100);
      }
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      // Clear time update interval
      if (timeUpdateIntervalRef.current !== null) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };

    const handleError = (e: Event) => {
      const audioElement = e.target as HTMLAudioElement;
      setError('Failed to load audio file');
      setIsPlaying(false);
      setIsLoading(false);
      if (audioElement.error) {
        console.error('Audio error:', audioElement.error.code, audioElement.error.message);
      }
    };

    const handleLoadedMetadata = () => {
      updateDuration();
    };

    const handleCanPlay = () => {
      updateDuration();
      setError(null);
      setIsLoading(false);
    };

    const handleLoadedData = () => {
      updateDuration();
    };

    const handleVolumeChange = () => {
      // Keep UI state synced with the actual <audio> element
      const muted = audio.muted || audio.volume === 0;
      setIsMuted(muted);
      if (!muted && audio.volume > 0) {
        lastNonZeroVolumeRef.current = audio.volume;
      }
    };

    // Set up event listeners
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('volumechange', handleVolumeChange);

    // Ensure audio is loaded (React sets src via JSX)
    // Use requestAnimationFrame to ensure React has updated the DOM
    requestAnimationFrame(() => {
      if (audio && audioUrl) {
        // Double-check the src matches (React should have set it)
        const shouldReload = !audio.src || audio.getAttribute('src') !== audioUrl;
        if (shouldReload) {
          audio.src = audioUrl;
          audio.load();
        }
        // Apply current mute state (must NOT reload audio)
        audio.muted = isMuted;
      }
    });

    // Cleanup
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('volumechange', handleVolumeChange);
      
      if (timeUpdateIntervalRef.current !== null) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      
      audioManager.unregister(playerId);
    };
  }, [audioUrl, playerId]);

  // Apply mute state without reloading or seeking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
  }, [isMuted]);

  // Sync playing state with actual audio state and manager
  useEffect(() => {
    const syncState = () => {
      const audio = audioRef.current;
      if (!audio) return;
      
      const currentPlayerId = audioManager.getCurrentPlayerId();
      const isCurrentPlayer = currentPlayerId === playerId;
      const actuallyPlaying = !audio.paused && !audio.ended;
      
      // Update state based on actual audio state
      if (actuallyPlaying !== isPlaying) {
        if (actuallyPlaying && isCurrentPlayer) {
          setIsPlaying(true);
        } else if (!actuallyPlaying) {
          setIsPlaying(false);
        }
      }
      
      // If this is not the current player but it's playing, pause it
      if (!isCurrentPlayer && actuallyPlaying) {
        audio.pause();
        setIsPlaying(false);
      }
    };

    const interval = setInterval(syncState, 100);
    return () => clearInterval(interval);
  }, [playerId, isPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      setError('Audio not ready');
      return;
    }

    try {
      if (isPlaying) {
        // Pause this audio
        audio.pause();
        audioManager.pause(playerId);
        setIsPlaying(false);
      } else {
        // Tell manager we want to play - it will pause others
        audioManager.play(playerId);
        
        // Wait for audio to be ready if needed
        if (audio.readyState < 2) {
          setIsLoading(true);
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Audio load timeout'));
            }, 10000);
            
            const handleCanPlay = () => {
              clearTimeout(timeout);
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('canplaythrough', handleCanPlay);
              audio.removeEventListener('error', handleError);
              resolve();
            };
            
            const handleError = () => {
              clearTimeout(timeout);
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('canplaythrough', handleCanPlay);
              audio.removeEventListener('error', handleError);
              reject(new Error('Audio failed to load'));
            };
            
            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('canplaythrough', handleCanPlay);
            audio.addEventListener('error', handleError);
          });
        }
        
        // Play the audio
        try {
          await audio.play();
          setIsPlaying(true);
          setError(null);
        } catch (playError: unknown) {
          console.error('Play error:', playError);
          audioManager.pause(playerId);
          const name =
            playError && typeof playError === 'object' && 'name' in playError
              ? String((playError as { name?: unknown }).name)
              : '';
          if (name === 'NotAllowedError') {
            setError('Autoplay blocked. Please click play again.');
          } else {
            setError('Failed to play audio.');
          }
          setIsPlaying(false);
        }
      }
    } catch (error: unknown) {
      console.error('Error in togglePlay:', error);
      audioManager.pause(playerId);
      setError('Failed to play audio. Please try again.');
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTime = isSeeking ? seekTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextMuted = !(audio.muted || audio.volume === 0);
    if (nextMuted) {
      if (audio.volume > 0) {
        lastNonZeroVolumeRef.current = audio.volume;
      }
      audio.muted = true;
      setIsMuted(true);
      return;
    }

    // Unmute
    audio.muted = false;
    if (audio.volume === 0) {
      audio.volume = Math.max(0.1, Math.min(1, lastNonZeroVolumeRef.current || 1));
    }
    setIsMuted(false);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar || duration === 0) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekTime(newTime);
  };

  const calculateSeekTime = (clientX: number): number => {
    const progressBar = progressBarRef.current;
    if (!progressBar || duration === 0) return 0;

    const rect = progressBar.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    return percentage * duration;
  };

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSeeking(true);
    const newTime = calculateSeekTime(e.clientX);
    setSeekTime(newTime);
  };

  // Handle mouse move and up events on document level for better dragging
  useEffect(() => {
    if (!isSeeking) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newTime = calculateSeekTime(e.clientX);
      setSeekTime(newTime);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const audio = audioRef.current;
      if (audio && duration > 0) {
        const newTime = calculateSeekTime(e.clientX);
        audio.currentTime = newTime;
        setCurrentTime(newTime);
        setSeekTime(newTime);
      }
      setIsSeeking(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSeeking, duration]);

  if (!file && !url) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p
        className="text-white text-[14px] leading-[24px]"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        {label}
      </p>
      {error && (
        <p className="text-red-400 text-[12px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
          {error}
        </p>
      )}
      <div className="flex gap-4 items-center w-full">
        <div className="backdrop-blur-[20px] bg-[rgba(255,255,255,0.07)] rounded-4 px-4 py-2 flex flex-1 gap-4 items-center min-w-0">
          <button
            onClick={togglePlay}
            disabled={!audioUrl || !!error}
            className="shrink-0 w-8 h-8 flex items-center justify-center cursor-pointer hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <PauseIcon width={32} height={32} color="#fff" />
            ) : (
              <PlayIcon width={32} height={32} color="#fff" />
            )}
          </button>
          <p
            className="text-white text-[12px] leading-4 shrink-0 font-roboto font-normal"
          >
            {isLoading ? 'Loading…' : `${formatTime(displayTime)} / ${formatTime(duration)}`}
          </p>
          <div className="flex-1 min-w-0 relative py-2 -my-2">
            <div
              ref={progressBarRef}
              className="bg-white opacity-20 h-[5px] w-full rounded-[10px] relative cursor-pointer"
              onClick={(e) => {
                if (!isSeeking) {
                  handleProgressBarClick(e);
                }
              }}
              onMouseDown={handleProgressBarMouseDown}
            >
              {/* Progress Fill - Pink when playing */}
              <div
                className={`h-full transition-all rounded-[10px] ${
                  isPlaying ? 'bg-[#965cdf]' : 'bg-white'
                }`}
                style={{ 
                  width: `${Math.max(0, Math.min(100, progress))}%`, 
                  transitionDuration: isSeeking ? '0ms' : '100ms' 
                }}
              />
              {/* Seek Indicator/Handle - Always visible, pink when playing */}
              <div
                className={`absolute top-1/2 w-4 h-4 rounded-full shadow-lg transition-all pointer-events-none z-10 ${
                  isPlaying ? 'bg-[#965cdf]' : 'bg-white opacity-60'
                }`}
                style={{ 
                  left: `${Math.max(0, Math.min(100, progress))}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="shrink-0 w-6 h-6 flex items-center justify-center cursor-pointer hover:opacity-80 transition"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeOffIcon width={24} height={24} color="#fff" />
            ) : (
              <VolumeIcon width={24} height={24} color="#fff" />
            )}
          </button>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="shrink-0 w-6 h-6 flex items-center justify-center cursor-pointer hover:opacity-80 transition"
            aria-label="Remove audio"
          >
            <CloseIcon width={24} height={24} color="#8f8f8f" />
          </button>
        )}
      </div>
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="metadata"
        />
      )}
    </div>
  );
};
