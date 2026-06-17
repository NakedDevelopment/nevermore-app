import React, { useCallback } from 'react';
import {
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import cardBg from '../assets/card-bg.png';
import LockIcon from '../assets/icons/lock';
import { useHasFullAccess } from '../hooks/useHasFullAccess';

interface TemptationItem {
  id: string;
  title: string;
  selected?: boolean;
}

interface TemptationBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  items: TemptationItem[];
  onItemSelect: (item: TemptationItem) => void;
  onNavigate?: (item: TemptationItem) => void;
}

const AnimatedTemptationItem: React.FC<{
  item: TemptationItem;
  onPress: (item: TemptationItem) => void;
  index: number;
  isLocked: boolean;
}> = ({ item, onPress, index, isLocked }) => {
  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.8);
  const translateYAnim = useSharedValue(30);
  const pressScale = useSharedValue(1);
  const backgroundOpacity = useSharedValue(0);

  React.useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 300 });
    scaleAnim.value = withTiming(1, { duration: 300 });
    translateYAnim.value = withTiming(0, { duration: 300 });
  }, [fadeAnim, index, scaleAnim, translateYAnim]);

  const handlePressIn = () => {
    pressScale.value = withTiming(0.98, { duration: 100 });
    backgroundOpacity.value = withTiming(1, { duration: 200 });
  };

  const handlePressOut = () => {
    pressScale.value = withTiming(1, { duration: 100 });
    backgroundOpacity.value = withTiming(0, { duration: 200 });
  };

  const handlePress = () => {
    pressScale.value = withTiming(0.95, { duration: 50 }, () => {
      pressScale.value = withTiming(1, { duration: 100 });
    });
    setTimeout(() => {
      onPress(item);
    }, 100);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [
      { scale: scaleAnim.value * pressScale.value },
      { translateY: translateYAnim.value },
    ],
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.itemButton}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.unselectedItemBackground}>
          <Text style={[styles.unselectedItemText, isLocked && styles.lockedItemText]} numberOfLines={1}>
            {item.title}
          </Text>
          {isLocked && (
            <View style={styles.lockIconWrap}>
              <LockIcon width={18} height={18} color="#9CA3AF" />
            </View>
          )}
        </View>
        <Animated.View
          style={[styles.animatedBackground, backgroundAnimatedStyle]}
          pointerEvents="none"
        >
          <ImageBackground
            source={cardBg}
            style={styles.selectedItemBackground}
            imageStyle={styles.selectedItemImageStyle}
          >
            <Text style={styles.selectedItemText}>{item.title}</Text>
            {isLocked && (
              <View style={styles.lockIconWrapSelected}>
                <LockIcon width={18} height={18} color="rgba(255,255,255,0.8)" />
              </View>
            )}
          </ImageBackground>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const TemptationBottomSheet: React.FC<TemptationBottomSheetProps> = ({
  isVisible,
  onClose,
  title,
  items,
  onItemSelect,
  onNavigate,
}) => {
  const hasFullAccess = useHasFullAccess();

  const handleItemPress = useCallback(
    (item: TemptationItem) => {
      onItemSelect(item);
      setTimeout(() => {
        if (onNavigate) {
          onNavigate(item);
        }
        onClose();
      }, 300);
    },
    [onClose, onItemSelect, onNavigate]
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetPanel}>
          <View style={styles.handleIndicator} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.itemsList}
            contentContainerStyle={styles.itemsContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            bounces
          >
            {items.map((item, index) => (
              <AnimatedTemptationItem
                key={item.id}
                item={item}
                index={index}
                onPress={handleItemPress}
                isLocked={!hasFullAccess}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetPanel: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderTopWidth: 1,
    borderTopColor: '#282828',
    maxHeight: '75%',
    minHeight: '42%',
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  handleIndicator: {
    alignSelf: 'center',
    backgroundColor: '#666666',
    width: 40,
    height: 3,
    borderRadius: 2,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingTop: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Roboto_400Regular',
    flex: 1,
    textTransform: 'capitalize',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: 'transparent',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  itemsList: {
    flex: 1,
  },
  itemsContainer: {
    paddingTop: 10,
    paddingBottom: 32,
  },
  itemButton: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    height: 72,
    position: 'relative',
  },
  animatedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  selectedItemBackground: {
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    position: 'relative',
  },
  selectedItemImageStyle: {
    borderRadius: 16,
  },
  selectedItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Cinzel_400Regular',
  },
  unselectedItemBackground: {
    backgroundColor: '#333333',
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    position: 'relative',
  },
  unselectedItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Cinzel_400Regular',
    paddingHorizontal: 36,
  },
  lockedItemText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  lockIconWrap: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  lockIconWrapSelected: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
