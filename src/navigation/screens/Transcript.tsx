import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import { MediaControls } from '../../components/MediaControls';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../hooks/useAppNavigation';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

type TranscriptRouteProp = RouteProp<RootStackParamList, ScreenNames.TRANSCRIPT>;
type TranscriptNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  ScreenNames.TRANSCRIPT
>;

export default function Transcript() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<TranscriptNavigationProp>();
  const route = useRoute<TranscriptRouteProp>();
  const { title, transcript, audioUrl, initialPositionSec = 0, resumePlaying = false } = route.params;

  const audioPlayer = useAudioPlayer();
  const resumeAppliedRef = useRef(false);

  useEffect(() => {
    resumeAppliedRef.current = false;
    if (audioUrl) {
      void audioPlayer.loadAudio(audioUrl);
    } else {
      void audioPlayer.unloadAudio();
    }
    // No unmount teardown: the global main player persists across navigation,
    // so leaving the transcript no longer stops playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when audioUrl identity changes
  }, [audioUrl]);

  // Re-sync playback position after `loadAudio` finishes (duration becomes available).
  useEffect(() => {
    if (!audioUrl) {
      return;
    }
    if (resumeAppliedRef.current || audioPlayer.isLoading) {
      return;
    }
    const snap = audioPlayer.getPlaybackSnapshot();
    if (snap.durationSec <= 0) {
      return;
    }
    resumeAppliedRef.current = true;

    const run = async () => {
      if (initialPositionSec > 0) {
        const progress = Math.min(1, Math.max(0, initialPositionSec / snap.durationSec));
        await audioPlayer.seekTo(progress);
      }
      if (resumePlaying) {
        await audioPlayer.play();
      }
    };
    void run();
  }, [
    audioUrl,
    audioPlayer.isLoading,
    audioPlayer.totalTime,
    initialPositionSec,
    resumePlaying,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <ImageBackground
          source={require('../../assets/raven.png')}
          style={StyleSheet.absoluteFillObject}
          imageStyle={{ opacity: 0.5 }}
          resizeMode="cover"
        />
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeftIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transcript</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: audioUrl ? 120 + insets.bottom : 24 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{transcript}</Text>
        </ScrollView>

        {audioUrl ? (
          <View style={[styles.playerBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <MediaControls
              isPlaying={audioPlayer.isPlaying}
              isLoading={audioPlayer.isLoading}
              currentTime={audioPlayer.currentTime}
              totalTime={audioPlayer.totalTime}
              progress={audioPlayer.progress}
              onPlayPause={audioPlayer.togglePlayPause}
              onRewind={audioPlayer.rewind}
              onForward={audioPlayer.forward}
              onStop={audioPlayer.restart}
              onSeek={audioPlayer.seekTo}
            />
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerSpacer: {
    width: 40,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Cinzel_600SemiBold',
    letterSpacing: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Cinzel_400Regular',
    fontSize: 24,
    marginBottom: 12,
  },
  body: {
    color: '#FFFFFF',
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  playerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
