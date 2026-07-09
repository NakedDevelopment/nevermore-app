import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { DrawerActions } from '@react-navigation/native';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { BlurView } from 'expo-blur';
import Carousel, { type ICarouselInstance } from 'react-native-reanimated-carousel';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withDelay,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFortyDayStore, Task } from '../../store/fortyDayStore';
import { useFortyDayAudioPlayer } from '../../hooks/useFortyDayAudioPlayer';
import { useHasFullAccess } from '../../hooks/useHasFullAccess';
import { SubscriptionPopup } from '../../components/SubscriptionPopup';
import { audioCacheService } from '../../services/audioCache.service';
import LockIcon from '../../assets/icons/lock';
import MenuIcon from '../../assets/icons/menu';
import FlagIcon from '../../assets/icons/flag';
import ChevronLeftIcon from '../../assets/icons/chevron-left';
import ChevronRightIcon from '../../assets/icons/chevron-right';
import PlayIcon from '../../assets/icons/play';
import PauseIcon from '../../assets/icons/pause';
import BackwardIcon from '../../assets/icons/backward10';
import Forward10Icon from '../../assets/icons/forward10';
import CheckmarkIcon from '../../assets/icons/checkmark';
import LinkIcon from '../../assets/icons/link';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.6;
const CARD_HEIGHT = 280;

const getDayTitleFontSize = (title: string): number => {
  if (title.length > 34) return 20;
  if (title.length > 22) return 23;
  return 28;
};

const getChallengeDayIndex = (days: { day: number }[], dayNumber: number): number => {
  if (days.length === 0) return 0;
  const exactIndex = days.findIndex((day) => day.day === dayNumber);
  if (exactIndex >= 0) return exactIndex;
  return Math.max(0, Math.min(dayNumber - 1, days.length - 1));
};

export const FortyDay = () => {
  const { raw: navigation, navigateToTemptationDetails } = useAppNavigation();
  const insets = useSafeAreaInsets();
  
  const { 
    currentDay, 
    days, 
    loading, 
    error, 
    setCurrentDay, 
    toggleTask, 
    loadFortyDayContent ,
  } = useFortyDayStore();

  const hasFullAccess = useHasFullAccess();
  const [subscriptionPopupVisible, setSubscriptionPopupVisible] = useState(false);

  const carouselRef = useRef<ICarouselInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(() => {
    if (days.length === 0) return 0;
    return getChallengeDayIndex(days, currentDay);
  });
  
  const audioPlayer = useFortyDayAudioPlayer();
  
  const contentTranslateY = useSharedValue(50);
  const contentOpacity = useSharedValue(0);
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-30);
  const scrollY = useSharedValue(0);
  const hasPlayedEntranceRef = useRef(false);

  useEffect(() => {
    loadFortyDayContent();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (hasPlayedEntranceRef.current) {
        headerOpacity.value = withTiming(1, { duration: 150 });
        headerTranslateY.value = withTiming(0, { duration: 150 });
        contentOpacity.value = withTiming(1, { duration: 150 });
        contentTranslateY.value = withTiming(0, { duration: 150 });
        return;
      }

      hasPlayedEntranceRef.current = true;

      headerOpacity.value = 0;
      headerTranslateY.value = -30;
      contentOpacity.value = 0;
      contentTranslateY.value = 50;
      
      headerOpacity.value = withTiming(1, { duration: 600 });
      headerTranslateY.value = withTiming(0, { duration: 600 });
      
      // Animate content in - background is always visible to prevent black screen
      contentOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));
      contentTranslateY.value = withDelay(200, withTiming(0, { duration: 800 }));
    }, [])
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColorOpacity = interpolate(
      scrollY.value,
      [0, 150],
      [0, 0.4],
      Extrapolate.CLAMP
    );

    return {
      opacity: headerOpacity.value,
      transform: [{ translateY: headerTranslateY.value }],
      backgroundColor: `rgba(0, 0, 0, ${backgroundColorOpacity})`,
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
    };
  });

  useEffect(() => {
    if (days.length > 0) {
      const safeIndex = getChallengeDayIndex(days, currentDay);
      if (safeIndex !== activeIndex) {
        setActiveIndex(safeIndex);
      }
    }
  }, [days, currentDay, activeIndex]);

  const currentDayData = days[activeIndex];

  useEffect(() => {
    const daysToPrepare = [days[activeIndex], days[activeIndex + 1]].filter(Boolean);

    daysToPrepare.forEach((day) => {
      day.tasks.forEach((task) => {
        if (task.icon) {
          Image.prefetch(task.icon).catch(() => {});
        }
      });
    });
  }, [activeIndex, days]);

  // Background audio downloading is intentionally limited to Day 1 only (the
  // very first thing a new user hits after onboarding) — everything else
  // streams on tap and caches afterward for next time via loadAndPlay's own
  // warmAudio call. This is a deliberate data-usage/bandwidth-contention
  // tradeoff, not an oversight: see .agents/memory/audio-playback-architecture.md.
  useEffect(() => {
    const day1AudioUrl = days.find((day) => day.day === 1)?.audioUrl;
    if (!day1AudioUrl) {
      return;
    }

    const warmTimer = setTimeout(() => {
      audioCacheService.warmAudio(day1AudioUrl).catch(() => {});
    }, 1200);

    return () => clearTimeout(warmTimer);
  }, [days]);

  useEffect(() => {
    if (days.length === 0) {
      return;
    }

    const prefetchTimer = setTimeout(() => {
      const uniqueIcons = new Set<string>();
      days.forEach((day) => {
        day.tasks.forEach((task) => {
          if (task.icon) {
            uniqueIcons.add(task.icon);
          }
        });
      });

      uniqueIcons.forEach((iconUrl) => {
        Image.prefetch(iconUrl).catch(() => {});
      });
    }, 3000);

    return () => clearTimeout(prefetchTimer);
  }, [days]);

  const selectDayIndex = (index: number) => {
    if (index < 0 || index >= days.length || index === activeIndex) {
      return;
    }

    setActiveIndex(index);
    setCurrentDay(days[index].day);
    (carouselRef.current as any)?.scrollTo?.({ index, animated: true });
  };

  const handlePrevious = () => {
    if (activeIndex > 0) {
      selectDayIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < days.length - 1) {
      selectDayIndex(activeIndex + 1);
    }
  };

  const handleTaskToggle = (taskId: string) => {
    if (
      currentDayData &&
      !hasFullAccess
    ) {
      setSubscriptionPopupVisible(true);
      return;
    }
    if (!currentDayData) {
      return;
    }
    toggleTask(currentDayData.day, taskId);
  };

  const handleTaskPress = (task: Task) => {
    if (task.contentId) {
      handleOpenTaskContent(task);
      return;
    }
    handleTaskToggle(task.id);
  };

  const handleOpenTaskContent = (task: Task) => {
    if (!task.contentId) {
      return;
    }
    if (!hasFullAccess) {
      setSubscriptionPopupVisible(true);
      return;
    }
    navigateToTemptationDetails({
      contentId: task.contentId,
      temptationTitle: task.title,
      audioUrl: task.audioUrl,
    });
  };

  const handlePlayPause = async (audioUrl: string, durationSec?: number) => {
    if (audioPlayer.loadingUri === audioUrl) {
      return;
    }

    if (audioPlayer.currentUri === audioUrl && audioPlayer.isPlaying) {
      await audioPlayer.pause();
      return;
    }

    await audioPlayer.loadAndPlay(audioUrl, durationSec);
  };

  const renderCarouselItem = ({ item }: { item: typeof days[0] }) => {
    const isCurrentItem = item.day === days[activeIndex]?.day;
    const isLocked = !hasFullAccess;
    const dayTitleFontSize = getDayTitleFontSize(item.title);
    const isItemLoading = isCurrentItem && !!item.audioUrl && audioPlayer.isLoading && audioPlayer.loadingUri === item.audioUrl;
    const isItemAudioLoaded = isCurrentItem && !!item.audioUrl && audioPlayer.currentUri === item.audioUrl;

    const cardContent = (
      <View style={styles.card}>
        <BlurView
          intensity={20}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.cardOverlay, isLocked && styles.cardOverlayLocked]} />
        <View style={styles.cardContentWrapper}>
          <View style={styles.cardHeader}>
            {!isLocked && (
              <View
                style={styles.flagButton}
              >
                <FlagIcon width={30} height={30} />
              </View>
            )}
            {isLocked && (
              <View style={styles.lockIconBadge}>
                <LockIcon width={24} height={24} color="#9CA3AF" />
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            <View style={styles.dayTitleArea}>
              <Text
                style={[
                  styles.dayLabel,
                  { fontSize: dayTitleFontSize, lineHeight: dayTitleFontSize * 1.12 },
                  isLocked && styles.dayTextLocked,
                ]}
                numberOfLines={3}
                ellipsizeMode="tail"
              >
                {item.title}
              </Text>
            </View>
            <Text style={[styles.dayNumber, isLocked && styles.dayTextLocked]}>{item.day}</Text>
            <Text style={styles.completionText}>
              Completed: <Text style={styles.completionPercentage}>{item.completionPercentage}%</Text>
            </Text>
          </View>

          <View style={styles.mediaControls}>
            {isLocked ? (
              <View style={styles.mediaControlsLocked}>
                <LockIcon width={20} height={20} color="#6B7280" />
                <Text style={styles.lockedHint}>Unlock to play</Text>
              </View>
            ) : (
              <View style={styles.audioControlsWrapper}>
                <View style={styles.audioControlsRow}>
                  <TouchableOpacity
                    style={[styles.audioControlBtn, !item.audioUrl && styles.mediaIconAreaDisabled]}
                    onPress={() => isCurrentItem && audioPlayer.seekBackward(10)}
                    disabled={!item.audioUrl || !isItemAudioLoaded || isItemLoading}
                  >
                    <BackwardIcon width={32} height={32} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.audioPlayBtn, !item.audioUrl && styles.mediaIconAreaDisabled]}
                    onPress={() => isCurrentItem && item.audioUrl && handlePlayPause(item.audioUrl, item.audioDurationSec)}
                    disabled={!item.audioUrl}
                  >
                    {isItemLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : isItemAudioLoaded && audioPlayer.isPlaying ? (
                      <PauseIcon width={36} height={36} />
                    ) : (
                      <PlayIcon width={36} height={36} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.audioControlBtn, !item.audioUrl && styles.mediaIconAreaDisabled]}
                    onPress={() => isCurrentItem && audioPlayer.seekForward(10)}
                    disabled={!item.audioUrl || !isItemAudioLoaded || isItemLoading}
                  >
                    <Forward10Icon width={32} height={32} />
                  </TouchableOpacity>
                </View>
                {isCurrentItem && item.audioUrl && (
                  <Text style={styles.audioDuration}>
                    {isItemAudioLoaded && !isItemLoading ? audioPlayer.remainingTime : '--:--'}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );

    return (
      <View style={styles.carouselItemContainer}>
        {isLocked ? (
          <TouchableOpacity
            style={styles.cardTouchable}
            activeOpacity={0.9}
            onPress={() => setSubscriptionPopupVisible(true)}
          >
            {cardContent}
          </TouchableOpacity>
        ) : (
          cardContent
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { paddingTop: insets.top }, headerAnimatedStyle]}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MenuIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nevermore</Text>
        <View style={styles.headerRight} />
      </Animated.View>

      <View style={styles.backgroundContainer}>
        <ImageBackground
          source={require('../../assets/main-bg.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </View>

      <Animated.View style={[styles.scrollContainer, contentAnimatedStyle]}>
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollViewContent, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
        <View style={[styles.headerSpacer, { height: insets.top + 100 }]} />
        <Text style={styles.mainTitle}>40 Day Challenge</Text>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading your challenge...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={loadFortyDayContent}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && days.length > 0 && (
          <>
            <View style={styles.carouselContainer}>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.navButtonLeft,
                  activeIndex === 0 && styles.navButtonDisabled,
                ]}
                onPress={handlePrevious}
                disabled={activeIndex === 0}
                activeOpacity={activeIndex === 0 ? 1 : 0.7}
              >
                <ChevronLeftIcon width={24} height={24} />
              </TouchableOpacity>

              <View style={styles.carouselWrapper}>
                <Carousel
                  ref={carouselRef}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  data={days}
                  renderItem={renderCarouselItem}
                  onSnapToItem={(index) => {
                    setActiveIndex(index);
                    setCurrentDay(days[index].day);
                  }}
                  defaultIndex={days.length > 0 ? getChallengeDayIndex(days, currentDay) : 0}
                  loop={false}
                  enabled={true}
                  style={styles.carousel}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.navButtonRight,
                  activeIndex >= days.length - 1 && styles.navButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={activeIndex >= days.length - 1}
                activeOpacity={activeIndex >= days.length - 1 ? 1 : 0.7}
              >
                <ChevronRightIcon width={24} height={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.tasksSection}>
              <Text style={styles.tasksTitle}>Tasks for today</Text>
              
              <View style={styles.tasksList}>
                {currentDayData?.tasks.map((task, index) => {
                  const isLinked = !!task.contentId;

                  const linkRow = isLinked ? (
                    <View
                      style={styles.taskLinkRow}
                    >
                      <LinkIcon width={14} height={14} color="#8B5CF6" />
                      <Text style={styles.taskLinkText}>Tap to open temptation</Text>
                    </View>
                  ) : null;

                  const chevron = isLinked ? (
                    <ChevronRightIcon
                      width={18}
                      height={18}
                      style={styles.taskLinkChevron}
                    />
                  ) : null;

                  const taskIconSource = task.icon
                    ? { uri: task.icon }
                    : require('../../assets/task.png');

                  return (
                    <Pressable
                      key={task.id}
                      style={styles.taskItemWrapper}
                      onPress={() => handleTaskPress(task)}
                    >
                      {task.completed ? (
                        <ImageBackground
                          source={require('../../assets/card-bg.png')}
                          style={[styles.taskItem, styles.taskItemCompleted]}
                          imageStyle={styles.taskItemImageStyle}
                        >
                          <View style={styles.taskLeft}>
                            <View style={styles.soundWaveContainer}>
                              <Image
                                source={taskIconSource}
                                style={styles.ravenIcon}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                priority="high"
                                transition={120}
                              />
                            </View>
                            <View style={styles.taskTextContainer}>
                              <Text style={styles.taskTitle} numberOfLines={2} ellipsizeMode="tail">
                                {task.title}
                              </Text>
                              {linkRow}
                            </View>
                          </View>

                          <View style={styles.taskRight}>
                            {chevron}
                            <Pressable
                              style={[
                                styles.checkbox,
                                styles.checkboxCompleted,
                              ]}
                              onPress={(event) => {
                                event.stopPropagation();
                                handleTaskToggle(task.id);
                              }}
                              hitSlop={10}
                            >
                              <CheckmarkIcon width={20} height={20} color="#FFFFFF" />
                            </Pressable>
                          </View>
                        </ImageBackground>
                      ) : (
                        <View style={styles.taskItem}>
                          <View style={styles.taskLeft}>
                            <View style={styles.soundWaveContainer}>
                              <Image
                                source={taskIconSource}
                                style={styles.ravenIcon}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                priority="high"
                                transition={120}
                              />
                            </View>
                            <View style={styles.taskTextContainer}>
                              <Text style={styles.taskTitle} numberOfLines={2} ellipsizeMode="tail">
                                {task.title}
                              </Text>
                              {linkRow}
                            </View>
                          </View>

                          <View style={styles.taskRight}>
                            {chevron}
                            <Pressable
                              style={styles.checkbox}
                              onPress={(event) => {
                                event.stopPropagation();
                                handleTaskToggle(task.id);
                              }}
                              hitSlop={10}
                            />
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}
        </Animated.ScrollView>
      </Animated.View>

      <SubscriptionPopup
        isVisible={subscriptionPopupVisible}
        onClose={() => setSubscriptionPopupVisible(false)}
        onSubscribeSuccess={() => setSubscriptionPopupVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  backgroundImage: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  headerSpacer: {
    height: 100,
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Cinzel_600SemiBold',
  },
  headerRight: {
    width: 40,
  },
  mainTitle: {
    fontFamily: 'Cinzel_400Regular',
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 30,
  },
  carouselContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    minHeight: CARD_HEIGHT + 20,
  },
  carouselWrapper: {
    width: CARD_WIDTH,
    minHeight: CARD_HEIGHT,
  },
  carousel: {
    width: CARD_WIDTH,
  },
  carouselItemContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  navButtonDisabled: {
    opacity: 0.35,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  navButtonLeft: {
    marginRight: 8,
  },
  navButtonRight: {
    marginLeft: 8,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
  cardOverlayLocked: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  cardTouchable: {
    flex: 1,
  },
  cardContentWrapper: {
    flex: 1,
    zIndex: 2,
    justifyContent: 'space-between',
  },
  cardHeader: {
    position: 'absolute',
    top: 12,
    right: 20,
    zIndex: 3,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  flagButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 22,
    paddingBottom: 2,
    paddingHorizontal: 20,
    paddingRight: 72,
  },
  dayTitleArea: {
    minHeight: 68,
    maxHeight: 68,
    justifyContent: 'flex-start',
  },
  dayLabel: {
    fontFamily: 'Cinzel_600SemiBold',
    fontSize: 28,
    color: '#fff',
  },
  dayNumber: {
    fontFamily: 'Cinzel_400Regular',
    fontSize: 66,
    color: '#fff',
    lineHeight: 72,
  },
  dayTextLocked: {
    color: '#9CA3AF',
  },
  completionText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  completionPercentage: {
    color: '#fff',
    fontFamily: 'Roboto_700Bold',
  },
  mediaControls: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 72,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  audioControlsWrapper: {
    alignItems: 'center',
  },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  audioControlBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  audioPlayBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  audioDuration: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 6,
  },
  mediaIconAreaDisabled: {
    opacity: 0.3,
  },
  mediaControlsLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  lockedHint: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  tasksSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tasksTitle: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 18,
    color: '#fff',
    marginBottom: 16,
  },
  tasksList: {
  },
  taskItemWrapper: {
    marginBottom: 12,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    minHeight: 74,
  },
  taskItemCompleted: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  taskItemImageStyle: {
    borderRadius: 16,
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  taskRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  taskLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  taskLinkText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 13,
    color: '#8B5CF6',
    marginLeft: 6,
  },
  taskLinkChevron: {
    opacity: 0.5,
  },
  soundWaveContainer: {
    width: 56,
    height: 56,
    borderRadius: 13,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  ravenIcon: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
  taskTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 16,
    lineHeight: 21,
    color: '#fff',
    marginBottom: 4,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  loadingContainer: {
    minHeight: SCREEN_HEIGHT * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 20,
  },
  errorContainer: {
    minHeight: SCREEN_HEIGHT * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  errorText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 16,
    color: '#fff',
  },
});
