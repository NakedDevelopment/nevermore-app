import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { Button } from '../../components/Button';
import { RavenLoopAnimation } from '../../components/RavenLoopAnimation';
import { ScreenNames } from '../../constants/ScreenNames';
import { useOnboardingStore } from '../../store/onboardingStore';
import { usePushNotificationStore } from '../../store/pushNotificationStore';
import { requestPushPermission, setDailyPushTags } from '../../services/onesignal.service';
import {
  scheduleRemainingDailyPushes,
  syncDailyPushScheduleFromState,
} from '../../services/dailyPushScheduler.service';
import { getLocalDeliveryTimeFromDate } from '../../utils/dailyPushSchedule';

export function NotificationOptIn() {
  const navigation = useNavigation<any>();
  const width = Dimensions.get('window').width;
  const height = Dimensions.get('window').height;
  const bg = useImage(require('../../assets/gradient.png'));
  const { completeOnboarding } = useOnboardingStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishToHome = useCallback(() => {
    completeOnboarding();
    navigation.reset({
      index: 0,
      routes: [{ name: ScreenNames.HOME_TABS }],
    });
  }, [completeOnboarding, navigation]);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const now = new Date();
      const delivery = getLocalDeliveryTimeFromDate(now);
      const granted = await requestPushPermission();

      usePushNotificationStore.getState().setOptInScreenCompleted(true);
      usePushNotificationStore.getState().recordOptIn(now.toISOString(), delivery.hour, delivery.minute);
      usePushNotificationStore.getState().setNotificationsEnabled(granted);

      if (granted) {
        setDailyPushTags(1, true);
        await scheduleRemainingDailyPushes();
      } else {
        setDailyPushTags(1, false);
      }

      finishToHome();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to enable notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotNow = async () => {
    usePushNotificationStore.getState().setOptInScreenCompleted(true);
    usePushNotificationStore.getState().setNotificationsEnabled(false);
    setDailyPushTags(1, false);
    finishToHome();
  };

  React.useEffect(() => {
    void syncDailyPushScheduleFromState();
  }, []);

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
          <RavenLoopAnimation />
          <Text style={styles.title}>STAY CONNECTED</Text>
          <Text style={styles.description}>
            One short message a day from Nevermore, delivered at the same local time. Forty messages, in
            order—then they stop. Tap to open the app any time.
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={isLoading ? 'One moment...' : 'Turn on notifications'}
            onPress={handleEnableNotifications}
            variant="primary"
            size="medium"
            disabled={isLoading}
          />
          <Button
            title="Not now"
            onPress={handleNotNow}
            variant="secondary"
            size="medium"
            disabled={isLoading}
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
    ...StyleSheet.absoluteFillObject,
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
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 16,
    fontFamily: 'Cinzel_400Regular',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
    fontFamily: 'Roboto_400Regular',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#ff6b6b',
    textAlign: 'center',
    fontFamily: 'Roboto_400Regular',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
});