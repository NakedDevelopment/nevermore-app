import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { Button } from '../../components/Button';
import { SecondaryButton } from '../../components/SecondaryButton';
import { ScreenNames } from '../../constants/ScreenNames';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useTrialStore } from '../../store/trialStore';
import { useAuthStore } from '../../store/authStore';
import { useSharedAccessStore } from '../../store/sharedAccessStore';

export function TrialWelcome() {
  const navigation = useNavigation<any>();
  const width = Dimensions.get('window').width;
  const height = Dimensions.get('window').height;
  const bg = useImage(require('../../assets/gradient.png'));
  const [hasCheckedSharedAccess, setHasCheckedSharedAccess] = useState(false);

  const { completeOnboarding } = useOnboardingStore();
  const { startTrial } = useTrialStore();
  const userId = useAuthStore((s) => s.user?.$id);
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const refreshSharedAccess = useSharedAccessStore((s) => s.refreshSharedAccess);

  useEffect(() => {
    if (!userId) {
      setHasCheckedSharedAccess(true);
      return;
    }

    let isMounted = true;
    refreshSharedAccess().finally(() => {
      if (isMounted) {
        setHasCheckedSharedAccess(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [refreshSharedAccess, userId]);

  useEffect(() => {
    if (!isSharedAccessActive) return;
    completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [{ name: ScreenNames.HOME_TABS }],
    });
  }, [completeOnboarding, isSharedAccessActive, navigation]);

  useEffect(() => {
    if (!hasCheckedSharedAccess || !userId || isSharedAccessActive) return;
    // Trial starts regardless of what the user chooses next; persisted on the server.
    void startTrial(userId);
  }, [hasCheckedSharedAccess, isSharedAccessActive, startTrial, userId]);

  if (!hasCheckedSharedAccess || isSharedAccessActive) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
      </View>
    );
  }

  const handleStartSubscription = () => {
    completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [{ name: ScreenNames.SUBSCRIPTION }],
    });
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [{ name: ScreenNames.HOME_TABS }],
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Canvas style={styles.canvas}>
        <SkiaImage image={bg} x={0} y={0} width={width} height={height} fit="cover" />
      </Canvas>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Nevermore</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Start with 3 free days</Text>
          <Text style={styles.description}>
            No pressure. Just listen.{'\n'}
            If it helps, you can keep going.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button title="Start my 3 free days" onPress={handleStartSubscription} variant="primary" size="medium" />
          <SecondaryButton
            title="Not now"
            onPress={handleSkip}
            size="medium"
            style={styles.skipButton}
            textStyle={styles.skipButtonText}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Cinzel_600SemiBold',
  },
  headerSpacer: {
    width: 24,
    height: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: 'Cinzel_600SemiBold',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  skipButton: {
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#8B5CF6',
  },
});
