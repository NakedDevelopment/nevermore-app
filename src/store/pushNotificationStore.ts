import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PushNotificationState {
  optInScreenCompleted: boolean;
  notificationsEnabled: boolean;
  optedInAt: string | null;
  deliveryHour: number | null;
  deliveryMinute: number | null;
  nextMessageDay: number;
  scheduledNotificationIds: string[];
  setOptInScreenCompleted: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  recordOptIn: (iso: string, hour: number, minute: number) => void;
  setNextMessageDay: (day: number) => void;
  setScheduledNotificationIds: (ids: string[]) => void;
  resetPushNotificationState: () => void;
}

export const usePushNotificationStore = create<PushNotificationState>()(
  persist(
    (set) => ({
      optInScreenCompleted: false,
      notificationsEnabled: false,
      optedInAt: null,
      deliveryHour: null,
      deliveryMinute: null,
      nextMessageDay: 1,
      scheduledNotificationIds: [],

      setOptInScreenCompleted: (value) => set({ optInScreenCompleted: value }),
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      recordOptIn: (iso, hour, minute) =>
        set({
          optedInAt: iso,
          deliveryHour: hour,
          deliveryMinute: minute,
          nextMessageDay: 1,
        }),
      setNextMessageDay: (day) => set({ nextMessageDay: day }),
      setScheduledNotificationIds: (ids) => set({ scheduledNotificationIds: ids }),
      resetPushNotificationState: () =>
        set({
          optInScreenCompleted: false,
          notificationsEnabled: false,
          optedInAt: null,
          deliveryHour: null,
          deliveryMinute: null,
          nextMessageDay: 1,
          scheduledNotificationIds: [],
        }),
    }),
    {
      name: 'push-notification-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);