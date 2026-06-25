import { Roboto_400Regular } from '@expo-google-fonts/roboto';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Canvas,
  Image as SkiaImage,
  Text as SkiaText,
  useFont,
  useImage
} from '@shopify/react-native-skia';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowLeftIcon from '../../assets/icons/arrow-left';
import BookmarkIcon from '../../assets/icons/bookmark';
import BookmarkActiveIcon from '../../assets/icons/bookmark-active';
import { MediaControls } from '../../components/MediaControls';
import { ReflectionQuestionItem } from '../../components/ReflectionQuestionItem';
import { ScreenNames } from '../../constants/ScreenNames';
import { useTabSwitcher } from '../../hooks/useTabSwitcher';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { Image } from 'expo-image';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useContentDetails } from '../../hooks/useContent';
import { useEntranceAnimations } from '../../hooks/useEntranceAnimations';
import { useAudioPlaylist } from '../../hooks/useAudioPlaylist';
import { useContentPresentation } from '../../hooks/useContentPresentation';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { audioCacheService } from '../../services/audioCache.service';
import { getContentCategoryId } from '../../services/content.service';
import { RootStackParamList } from '../../hooks/useAppNavigation';

type TemptationDetailsRouteProp = RouteProp<RootStackParamList, ScreenNames.TEMPTATION_DETAILS>;
type TemptationDetailsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  ScreenNames.TEMPTATION_DETAILS
>;

export default function TemptationDetails() {
  const navigation = useNavigation<TemptationDetailsNavigationProp>();
  const route = useRoute<TemptationDetailsRouteProp>();
  const insets = useSafeAreaInsets();

  const { contentId, temptationTitle, categoryId: routeCategoryId } = route.params;

  const { 
    content, 
    loading 
  } = useContentDetails(contentId);
  
  // Extract categoryId from content if not provided in route params
  const extractedCategoryId = React.useMemo(() => {
    if (routeCategoryId && routeCategoryId.length > 0) return routeCategoryId;
    if (content) {
      return getContentCategoryId(content);
    }
    return null;
  }, [routeCategoryId, content]);
  
  // Default to recovery
  const [activeButton, setActiveButton] = useState<'recovery' | 'support'>('recovery');
  
  const scrollY = useSharedValue(0);
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  
  const { headerAnimatedStyle, canvasAnimatedStyle, contentAnimatedStyle } = useEntranceAnimations();
  
  // Main content audio player (for mainContentRecoveryURL/mainContentSupportURL)
  const mainContentAudioPlayer = useAudioPlayer();
  
  // Reflection questions audio player (for files array)
  const { selectedAudioIndex, audioPlayer: reflectionAudioPlayer, handleAudioSelect, loadPlaylist } = useAudioPlaylist();
  
  // Get role-specific content presentation data
  const {
    mainContentURL,
    transcriptTextFromFields,
    images,
    displayImage,
    audioFiles,
  } = useContentPresentation(content, activeButton);
  const imagePrefetchKey = React.useMemo(() => images.join('|'), [images]);
  const audioPrefetchKey = React.useMemo(() => audioFiles.join('|'), [audioFiles]);
  
  const isActiveMainTrack = !!mainContentURL && mainContentAudioPlayer.currentUri === mainContentURL;
  const isMainTrackBuffering = !!mainContentURL && mainContentAudioPlayer.loadingUri === mainContentURL;
  const isMainTrackActiveOrBuffering = isActiveMainTrack || isMainTrackBuffering;

  React.useEffect(() => {
    images.slice(0, 2).forEach((imageUrl) => {
      Image.prefetch(imageUrl).catch(() => {});
    });

    const audioWarmTimer = setTimeout(() => {
      if (mainContentURL) {
        audioCacheService.warmAudio(mainContentURL).catch(() => {});
      }

      audioFiles.slice(0, 2).forEach((audioUrl) => {
        audioCacheService.warmAudio(audioUrl).catch(() => {});
      });
    }, 1200);

    return () => clearTimeout(audioWarmTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainContentURL, audioPrefetchKey, imagePrefetchKey]);
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Reset carousel when content or Recovery/Support tab changes (images list is role-specific)
  React.useEffect(() => {
    setCurrentImageIndex(0);
  }, [content?.$id, activeButton]);
  
  const headerBackgroundStyle = useAnimatedStyle(() => {
    const backgroundColorOpacity = interpolate(
      scrollY.value,
      [0, 150],
      [0.22, 0.5],
      Extrapolate.CLAMP
    );

    return {
      backgroundColor: `rgba(0, 0, 0, ${backgroundColorOpacity})`,
    };
  });
  
  const { toggleBookmark, isBookmarked } = useBookmarkStore();
  const currentRole = activeButton === 'recovery' ? 'Recovery' : 'Support';
  const isCurrentlyBookmarked = content ? isBookmarked(content.$id, currentRole) : false;

  const effectiveTranscriptText = transcriptTextFromFields || '';
  const hasReadableTranscript = effectiveTranscriptText.length > 0;

  const audioFilesRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    const hasChanged = audioFiles.length !== audioFilesRef.current.length || 
                       audioFiles.some((file, idx) => file !== audioFilesRef.current[idx]);
    
    if (hasChanged) {
      audioFilesRef.current = audioFiles;
      loadPlaylist(audioFiles);
    }
  }, [audioFiles, loadPlaylist]);

  const handleOpenFullTranscript = React.useCallback(() => {
    if (!content || !hasReadableTranscript) {
      return;
    }
    const snap = mainContentAudioPlayer.getPlaybackSnapshot();
    navigation.navigate(ScreenNames.TRANSCRIPT, {
      title: content.title || temptationTitle,
      transcript: effectiveTranscriptText,
      audioUrl: mainContentURL ?? undefined,
      initialPositionSec: snap.positionSec,
      resumePlaying: snap.isPlaying,
    });
  }, [
    content,
    hasReadableTranscript,
    effectiveTranscriptText,
    temptationTitle,
    mainContentURL,
    mainContentAudioPlayer,
    navigation,
  ]);

  // Mirror the 40-Day Challenge's play handler so playback behaves identically
  // across content types: ignore taps while loading, pause if already playing,
  // otherwise load-and-play in a single call (which also pauses other channels
  // via the provider's global one-stream guard). Pausing reflection up front
  // keeps the local one-stream behavior even before loadAndPlay resolves.
  const handleMainPlayPause = React.useCallback(async () => {
    if (isMainTrackActiveOrBuffering && mainContentAudioPlayer.isLoading) {
      return;
    }
    if (isActiveMainTrack && mainContentAudioPlayer.isPlaying) {
      await mainContentAudioPlayer.pause();
      return;
    }
    if (!mainContentURL) {
      return;
    }
    await reflectionAudioPlayer.pause();
    await mainContentAudioPlayer.loadAndPlay(mainContentURL);
  }, [isActiveMainTrack, isMainTrackActiveOrBuffering, mainContentAudioPlayer, reflectionAudioPlayer, mainContentURL]);

  const handleQuestionSelect = React.useCallback(
    async (index: number) => {
      await mainContentAudioPlayer.pause();
      await handleAudioSelect(index);
    },
    [mainContentAudioPlayer, handleAudioSelect]
  );

  const width = Dimensions.get('window').width;
  const bg = useImage(require('../../assets/gradient.png'));

  const handleBack = () => {
    navigation.goBack();
  };

  const handleButtonPress = (buttonId: 'recovery' | 'support') => {
    setActiveButton(buttonId);
  };

  const tabSwitcher = useTabSwitcher({
    tabs: ['Recovery', 'Support'],
    activeTab: activeButton === 'recovery' ? 'Recovery' : 'Support',
    onTabChange: (tab) => {
      const newButton = tab.toLowerCase() as 'recovery' | 'support';
      handleButtonPress(newButton);
    },
    y: 0,
    enabled: !!extractedCategoryId,
  });

  const handleBookmarkToggle = () => {
    if (!content) return;
    const role = activeButton === 'recovery' ? 'Recovery' : 'Support';
    toggleBookmark(content.$id, content.title || temptationTitle, role);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!content) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Content not found</Text>
        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <Canvas style={styles.backgroundCanvas}>
          <SkiaImage image={bg} x={0} y={0} width={width} height={300} fit="cover" />
        </Canvas>
      </View>

      <Animated.View style={[styles.headerBackground, headerBackgroundStyle]}>
        <Animated.View style={[styles.header, { paddingTop: insets.top }, headerAnimatedStyle]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeftIcon />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nevermore</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        style={[styles.content, contentAnimatedStyle]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 82 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        {extractedCategoryId && (
          <Animated.View style={[styles.canvasContainer, canvasAnimatedStyle]}>
            <Canvas style={styles.canvas}>
{tabSwitcher.containerElement}
              {tabSwitcher.indicatorElement}
              {tabSwitcher.textElements}
            </Canvas>
            {tabSwitcher.touchableElements}
          </Animated.View>
        )}

        {extractedCategoryId && !mainContentURL && (
          <View style={styles.noContentMessage}>
            <Text style={styles.noContentText}>
              No {activeButton === 'recovery' ? 'Recovery' : 'Support'} content available for this category.
            </Text>
          </View>
        )}

        <View style={styles.mainTitleContainer}>
          <Text style={styles.mainTitle} numberOfLines={3} ellipsizeMode="tail">
            {content.title}
          </Text>
          <TouchableOpacity style={styles.bookmarkButton} onPress={handleBookmarkToggle}>
            {isCurrentlyBookmarked ? (
              <BookmarkActiveIcon width={18} height={20} color="#965CDF" />
            ) : (
              <BookmarkIcon width={18} height={20} />
            )}
          </TouchableOpacity>
        </View>

        {mainContentURL && (
          <MediaControls
            isPlaying={isActiveMainTrack && mainContentAudioPlayer.isPlaying}
            isLoading={isMainTrackActiveOrBuffering && mainContentAudioPlayer.isLoading}
            currentTime={isActiveMainTrack ? mainContentAudioPlayer.currentTime : '00:00'}
            totalTime={isActiveMainTrack ? mainContentAudioPlayer.totalTime : '--:--'}
            progress={isActiveMainTrack ? mainContentAudioPlayer.progress : 0}
            onPlayPause={handleMainPlayPause}
            onRewind={mainContentAudioPlayer.rewind}
            onForward={mainContentAudioPlayer.forward}
            onStop={mainContentAudioPlayer.stop}
            onSeek={mainContentAudioPlayer.seekTo}
          />
        )}

        {images.length > 0 && (
          <View style={styles.imageContainer}>
            <FlatList
              key={`${content.$id}-images-${activeButton}`}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `${activeButton}-${index}-${item}`}
              onMomentumScrollEnd={(event) => {
                const imageWidth = width - 40; // Account for padding (20px each side)
                const index = Math.round(event.nativeEvent.contentOffset.x / imageWidth);
                setCurrentImageIndex(index);
              }}
              renderItem={({ item, index }) => (
                <Image
                  source={{ uri: item }}
                  style={styles.imagePlaceholder}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority={index === 0 ? 'high' : 'normal'}
                />
              )}
              contentContainerStyle={styles.imageListContainer}
            />
            {images.length > 1 && (
              <View style={styles.paginationContainer}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentImageIndex && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {hasReadableTranscript && (
          <View style={styles.transcriptSection}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.sectionTitle}>Transcript</Text>
              <TouchableOpacity
                onPress={handleOpenFullTranscript}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.transcriptViewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.transcriptPreviewBox}>
              <Text
                style={styles.transcriptPreview}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {effectiveTranscriptText}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.reflectionSection}>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Exercises & Questions</Text>
          {audioFiles.length > 0 && (
            <FlatList
              data={audioFiles}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <ReflectionQuestionItem
                  isPlaying={index === selectedAudioIndex && reflectionAudioPlayer.isPlaying}
                  isLoading={index === selectedAudioIndex && reflectionAudioPlayer.isLoading}
                  onPress={() => handleQuestionSelect(index)}
                  questionNumber={index + 1}
                  isSelected={index === selectedAudioIndex}
                />
              )}
              contentContainerStyle={styles.reflectionContainer}
              scrollEnabled={false}
            />
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 0,
  },
  backgroundCanvas: {
    height: 300,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Roboto_400Regular',
    marginBottom: 20,
  },
  backLink: {
    color: '#8B5CF6',
    fontSize: 16,
    fontFamily: 'Roboto_400Regular',
  },
  noContentMessage: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  noContentText: {
    color: '#A78BFA',
    fontSize: 14,
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  headerSpacer: {
    width: 40,
  },
  bookmarkButton: {
    padding: 5,
  },
  canvasContainer: {
    height: 72,
    position: 'relative',
    overflow: 'visible',
  },
  canvas: {
    width: '100%',
    height: 72,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  mainTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
    fontFamily: 'Cinzel_400Regular',
    textAlign: 'left',
    flex: 1,
    minWidth: 0,
  },
  imageContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
  },
  imageListContainer: {
    paddingHorizontal: 0,
  },
  imagePlaceholder: {
    width: Dimensions.get('window').width - 40,
    height: 200,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginRight: 0,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  paginationDotActive: {
    backgroundColor: '#8B5CF6',
    width: 24,
  },
  transcriptSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  transcriptViewAll: {
    color: '#8B5CF6',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Roboto_400Regular',
  },
  transcriptPreviewBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  transcriptPreview: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Roboto_400Regular',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Cinzel_400Regular',
    letterSpacing: 1.5,
  },
  reflectionSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  reflectionContainer: {
    marginTop: 8,
  },
});
