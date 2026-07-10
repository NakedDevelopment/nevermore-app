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
}) => {
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
});

MediaControls.displayName = 'MediaControls';