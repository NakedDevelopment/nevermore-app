import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DAILY_PUSH_MESSAGES } from '../constants/dailyPushMessages';
import {
  getLocalDeliveryTimeFromDate,
  getNextMessageDayFromClock,
  getRemainingMessageDays,
} from '../utils/dailyPushSchedule';
import { usePushNotificationStore } from '../store/pushNotificationStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('daily-nudge', {
    name: 'Daily messages',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 250],
    lightColor: '#8B5CF6',
  });
}

export async function cancelScheduledDailyPushes(): Promise<void> {
  const { scheduledNotificationIds } = usePushNotificationStore.getState();
  await Promise.all(
    scheduledNotificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
  usePushNotificationStore.getState().setScheduledNotificationIds([]);
}

export async function scheduleRemainingDailyPushes(): Promise<void> {
  const state = usePushNotificationStore.getState();
  if (!state.notificationsEnabled || !state.optedInAt) return;

  const optedInAt = new Date(state.optedInAt);
  if (!Number.isFinite(optedInAt.getTime())) return;

  const delivery =
    state.deliveryHour != null && state.deliveryMinute != null
      ? { hour: state.deliveryHour, minute: state.deliveryMinute }
      : getLocalDeliveryTimeFromDate(optedInAt);

  const days = getRemainingMessageDays(state.nextMessageDay);
  if (days.length === 0) return;

  await cancelScheduledDailyPushes();
  await ensureNotificationChannels();

  const ids: string[] = [];
  for (const day of days) {
    const message = DAILY_PUSH_MESSAGES[day - 1];
    if (!message) continue;

    const triggerDate = getTriggerDateForMessageDay(optedInAt, day, delivery);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        data: { openApp: true, dailyPushDay: day },
        ...(Platform.OS === 'android'
          ? { channelId: 'daily-nudge' }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    ids.push(id);
  }

  usePushNotificationStore.getState().setScheduledNotificationIds(ids);
}

export async function completeDailyPushSequenceAfterDay40(): Promise<void> {
  await cancelScheduledDailyPushes();
  usePushNotificationStore.getState().setNextMessageDay(41);
}

export async function syncDailyPushScheduleFromState(): Promise<void> {
  const state = usePushNotificationStore.getState();
  if (!state.notificationsEnabled || !state.optedInAt) return;

  const optedInAt = new Date(state.optedInAt);
  const delivery =
    state.deliveryHour != null && state.deliveryMinute != null
      ? { hour: state.deliveryHour, minute: state.deliveryMinute }
      : getLocalDeliveryTimeFromDate(optedInAt);

  const nextDay = getNextMessageDayFromClock(optedInAt, delivery);
  usePushNotificationStore.getState().setNextMessageDay(nextDay);

  if (nextDay > DAILY_PUSH_COUNT) {
    await completeDailyPushSequenceAfterDay40();
    return;
  }

  await scheduleRemainingDailyPushes();
}