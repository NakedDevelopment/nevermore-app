import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const LOOP_MS = 6000;

/**
 * Placeholder raven loop until the client video asset ships (6s seamless loop spec).
 */
export function RavenLoopAnimation() {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const half = LOOP_MS / 2;
    translateY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={animatedStyle}>
        <Image source={require('../assets/raven.png')} style={styles.raven} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    marginBottom: 24,
  },
  raven: {
    width: 140,
    height: 140,
  },
});