import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import BackwardIcon from '../assets/icons/backward10';
import Forward10Icon from '../assets/icons/forward10';
import PlayIcon from '../assets/icons/play';
import PauseIcon from '../assets/icons/pause';
import StopButtonIcon from '../assets/icons/stop-button';

type MediaControlsProps = {
  isPlaying: boolean;
  isLoading?: boolean;
  currentTime: string;
  totalTime: string;
  progress?: number; // Progress as a decimal (0-1)
  onPlayPause: () => void;
  onRewind: () => void;
  onForward: () => void;
  onStop: () => void;
  onSeek?: (progress: number) => void;
  /** True when the stream has been buffering too long — show the download offer. */
  isSlowConnection?: boolean;
  /** 0-1 while a user-initiated download runs, or null/undefined when idle. */
  downloadProgress?: number | null;
  /** Tapped from the slow-connection prompt to download + play locally. */
  onDownload?: () => void;
};

export const MediaControls: React.FC<MediaControlsProps> = ({
  isPlaying,
  isLoading = false,
  currentTime,
  totalTime,
  progress = 0,
  onPlayPause,
  onRewind,
  onForward,
  onStop,
  onSeek,
  isSlowConnection = false,
  downloadProgress = null,
  onDownload,
}) => {
  const isDownloading = downloadProgress != null;
  const downloadPct = isDownloading ? Math.round((downloadProgress ?? 0) * 100) : 0;
  const progressWidth = Math.min(Math.max(progress * 100, 0), 100);
  
  // Store width from layout
  const barWidth = useSharedValue(0);
  
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    barWidth.value = event.nativeEvent.layout.width;
  }, [barWidth]);
  
  // Stable callback ref for seek
  const handleSeek = React.useCallback((newProgress: number) => {
    if (onSeek && !isLoading) {
      onSeek(newProgress);
    }
  }, [onSeek, isLoading]);
  
  // Pan gesture for slider - works reliably on iOS inside ScrollView
  const panGesture = React.useMemo(() => 
    Gesture.Pan()
      .onStart((event) => {
        'worklet';
        if (barWidth.value <= 0) return;
        const newProgress = Math.max(0, Math.min(1, event.x / barWidth.value));
        runOnJS(handleSeek)(newProgress);
      })
      .onUpdate((event) => {
        'worklet';
        if (barWidth.value <= 0) return;
        const newProgress = Math.max(0, Math.min(1, event.x / barWidth.value));
        runOnJS(handleSeek)(newProgress);
      })
      .onEnd((event) => {
        'worklet';
        if (barWidth.value <= 0) return;
        const newProgress = Math.max(0, Math.min(1, event.x / barWidth.value));
        runOnJS(handleSeek)(newProgress);
      })
      .minDistance(0)
      .activeOffsetX([-5, 5]) // Activate gesture quickly for horizontal movement
      .failOffsetY([-20, 20]) // Fail if vertical movement detected (let scroll handle it)
      .enabled(!isLoading && !!onSeek),
    [barWidth, handleSeek, isLoading, onSeek]
  );
  
  // Tap gesture for direct seeking
  const tapGesture = React.useMemo(() =>
    Gesture.Tap()
      .onEnd((event) => {
        'worklet';
        if (barWidth.value <= 0) return;
        const newProgress = Math.max(0, Math.min(1, event.x / barWidth.value));
        runOnJS(handleSeek)(newProgress);
      })
      .enabled(!isLoading && !!onSeek),
    [barWidth, handleSeek, isLoading, onSeek]
  );
  
  // Combine tap and pan gestures
  const composedGesture = Gesture.Race(tapGesture, panGesture);
  
  return (
    <View style={styles.mediaPlayerCard}>
      <View style={styles.mediaControls}>
        <TouchableOpacity style={styles.mediaControl} onPress={onRewind} disabled={isLoading}>
          <BackwardIcon width={36} height={36} color={isLoading ? "#666666" : "#FFFFFF"} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playButtonMain} onPress={onPlayPause} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#8B5CF6" />
          ) : isPlaying ? (
            <PauseIcon width={36} height={36} color="#FFFFFF" />
          ) : (
            <PlayIcon width={36} height={36} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.stopButton} onPress={onStop} disabled={isLoading}>
          <StopButtonIcon width={36} height={36} color={isLoading ? "#666666" : "#FFFFFF"} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.mediaControl} onPress={onForward} disabled={isLoading}>
          <Forward10Icon width={36} height={36} color={isLoading ? "#666666" : "#FFFFFF"} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={styles.progressBarTouchArea}
            onLayout={handleLayout}
          >
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
            </View>
          </Animated.View>
        </GestureDetector>
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{currentTime}</Text>
          <Text style={styles.timeText}>{totalTime}</Text>
        </View>
      </View>

      {isDownloading ? (
        <View style={styles.downloadNotice}>
          <ActivityIndicator size="small" color="#8B5CF6" />
          <Text style={styles.downloadNoticeText}>Downloading… {downloadPct}%</Text>
        </View>
      ) : isSlowConnection && onDownload ? (
        <View style={styles.slowNotice}>
          <Text style={styles.slowNoticeText}>
            Slow connection — this audio is taking a while to start.
          </Text>
          <TouchableOpacity style={styles.downloadButton} onPress={onDownload}>
            <Text style={styles.downloadButtonText}>Download to play</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  mediaPlayerCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 20,
  },
  mediaControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  mediaControl: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonMain: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBarTouchArea: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Roboto_400Regular',
  },
  slowNotice: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333333',
    alignItems: 'center',
  },
  slowNoticeText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
    marginBottom: 10,
  },
  downloadButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Roboto_500Medium',
  },
  downloadNotice: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadNoticeText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontFamily: 'Roboto_400Regular',
    marginLeft: 10,
  },
});

MediaControls.displayName = 'MediaControls';