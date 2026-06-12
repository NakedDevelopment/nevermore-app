import React, { useState, useEffect } from 'react';
import { Dimensions, FlatList, ImageBackground as RNImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import {
  Canvas,
  Image,
  useImage,
} from '@shopify/react-native-skia';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import MenuIcon from '../../assets/icons/menu';
import BookmarkActiveIcon from '../../assets/icons/bookmark-active';
import { useBookmarkStore } from '../../store/bookmarkStore';
import { ScreenNames } from '../../constants/ScreenNames';
import { Image as ExpoImage } from 'expo-image';
import { ConfirmationModal } from '../../components/ConfirmationModal';

type RootStackParamList = {
  TemptationDetails: {
    contentId: string;
    temptationTitle: string;
  };
};

type BookmarkNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function Bookmark() {
  const navigation = useNavigation<BookmarkNavigationProp>();
  
  const { 
    toggleBookmark, 
    activeTab: storeActiveTab, 
    setActiveTab: setStoreActiveTab,
    getFilteredBookmarks 
  } = useBookmarkStore();

  const [activeTab, setActiveTab] = useState<'Recovery' | 'Support'>(storeActiveTab);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [bookmarkToDelete, setBookmarkToDelete] = useState<{ id: string; title: string; role: string; index: number } | null>(null);
  
  const width = Dimensions.get('window').width;
  const bg = useImage(require('../../assets/main-bg.png'));
  const insets = useSafeAreaInsets();

  // Reanimated shared values for entrance animations
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-30);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(50);
  const bookmarkScales = useSharedValue<number[]>([]);
  const bookmarkOpacities = useSharedValue<number[]>([]);
  const filteredBookmarks = getFilteredBookmarks(activeTab);

  const handleTabChange = (tab: 'Recovery' | 'Support') => {
    setActiveTab(tab);
    setStoreActiveTab(tab);
  };

  useEffect(() => {
    if (filteredBookmarks.length > 0) {
      bookmarkScales.value = filteredBookmarks.map(() => 1);
      bookmarkOpacities.value = filteredBookmarks.map(() => 0);
    }
  }, [filteredBookmarks]);

  // Reset and animate on screen focus
  useFocusEffect(
    React.useCallback(() => {
      // Reset animation values
      headerOpacity.value = 0;
      headerTranslateY.value = -30;
      contentOpacity.value = 0;
      contentTranslateY.value = 50;
      
      const currentBookmarks = getFilteredBookmarks(activeTab);
      if (currentBookmarks.length > 0) {
        bookmarkOpacities.value = currentBookmarks.map(() => 0);
        bookmarkScales.value = currentBookmarks.map(() => 0);
      }

      // Start animations
      headerOpacity.value = withTiming(1, { duration: 600 });
      headerTranslateY.value = withTiming(0, { duration: 600 });
      
      // Animate content in - background is always visible to prevent black screen
      contentOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));
      contentTranslateY.value = withDelay(200, withTiming(0, { duration: 800 }));

      // Animate bookmarks
      if (currentBookmarks.length > 0) {
        currentBookmarks.forEach((_, index) => {
          const delay = 400 + (index * 150);
          bookmarkOpacities.value[index] = withDelay(delay, withTiming(1, { duration: 400 }));
          bookmarkScales.value[index] = withDelay(delay, withTiming(1, { duration: 400 }));
        });
      }

      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerOpacity.value,
      transform: [{ translateY: headerTranslateY.value }],
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
    };
  });

  const handleBookmarkPress = (bookmark: any, index: number) => {
    bookmarkScales.value[index] = withTiming(0.98, { duration: 100 }, () => {
      bookmarkScales.value[index] = withTiming(1, { duration: 100 });
    });

    navigation.navigate(ScreenNames.TEMPTATION_DETAILS, {
      contentId: bookmark.id,
      temptationTitle: bookmark.title,
    });
  };

  const handleRemoveBookmark = (bookmarkId: string, title: string, role: string, index: number) => {
    bookmarkScales.value[index] = withTiming(0.98, { duration: 100 }, () => {
      bookmarkScales.value[index] = withTiming(1, { duration: 100 });
    });

    setBookmarkToDelete({ id: bookmarkId, title, role, index });
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = () => {
    if (bookmarkToDelete) {
      toggleBookmark(bookmarkToDelete.id, bookmarkToDelete.title, bookmarkToDelete.role);
      setDeleteModalVisible(false);
      setBookmarkToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalVisible(false);
    setBookmarkToDelete(null);
  };

  return (
    <View style={styles.container} testID="bookmark-screen">
      <Animated.View style={[styles.header, { paddingTop: insets.top }, headerAnimatedStyle]}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          testID="drawer-menu-button"
        >
          <MenuIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nevermore</Text>
        <View style={styles.headerRight} />
      </Animated.View>
   
      {/* Background Canvas - always visible to prevent black screen */}
      <View style={styles.backgroundContainer}>
        <RNImageBackground
          source={require('../../assets/main-bg.png')}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        <Canvas style={styles.canvas}>
          {bg ? <Image image={bg} x={0} y={0} width={width} height={900} fit="cover" /> : null}
        </Canvas>
      </View>

      {/* Content - animated */}
      <Animated.View style={[styles.canvasTouchable, contentAnimatedStyle]}>
        <View style={styles.contentHeader}>
          <Text style={styles.pageTitle}>Bookmark</Text>
          <View style={styles.segmentedControl}>
            {(['Recovery', 'Support'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                  onPress={() => handleTabChange(tab)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.segmentButtonText}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {filteredBookmarks.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <BlurView intensity={20} tint="dark" style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>
                This is your fight.
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                Mark the temptations that matter.
              </Text>
              <View style={styles.emptyStateIconContainer}>
                <ExpoImage 
                  source={require('../../assets/bookmark-empty.png')} 
                  style={styles.emptyImage}
                  contentFit="cover"
                />
              </View>
            </BlurView>
          </View>
        ) : (
          <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => `${item.id}-${item.role}`}
            style={styles.flatListContainer}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: bookmark, index }) => (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleBookmarkPress(bookmark, index)}
                style={styles.bookmarkCardContainer}
              >
                <BlurView intensity={20} tint="dark" style={styles.bookmarkBlur}>
                  <Text style={styles.bookmarkTitle}>{bookmark.title}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveBookmark(bookmark.id, bookmark.title, bookmark.role, index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.bookmarkIconButton}
                  >
                    <BookmarkActiveIcon width={24} height={24} color="#965CDF" />
                  </TouchableOpacity>
                </BlurView>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </Animated.View>

      <ConfirmationModal
        visible={deleteModalVisible}
        title="Are you sure you want to remove this temptation from your Bookmarks?"
        description="You will need to bookmark the temptation again in order to see it appear on the Bookmark page."
        cancelText="Keep the Bookmark"
        confirmText="Remove Bookmark"
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        confirmButtonColor="#ff4444"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  canvasTouchable: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  contentHeader: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  pageTitle: {
    color: '#fff',
    fontSize: 34,
    fontFamily: 'Cinzel_400Regular',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  segmentedControl: {
    width: '64%',
    minWidth: 240,
    height: 38,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  segmentButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Roboto_500Medium',
  },
  flatListContainer: {
    position: 'absolute',
    top: 240,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flatListContent: {
    paddingHorizontal: 30,
    paddingBottom: 30,
  },
  bookmarkCardContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 70,
  },
  bookmarkBlur: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  bookmarkTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Cinzel_600SemiBold',
    flex: 1,
  },
  bookmarkIconButton: {
    padding: 8,
  },
  separator: {
    height: 20,
  },
  emptyStateContainer: {
    position: 'absolute',
    top: 280,
    left: 30,
    right: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyImage: {
    width: 100,
    height: 120,
  },
  emptyStateCard: {
    width: '100%',
    minHeight: 200,
    borderRadius: 12,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto_500Medium',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto_500Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyStateIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

});
