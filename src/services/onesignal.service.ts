import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { LogLevel, OneSignal } from 'react-native-onesignal';
import { ONESIGNAL_APP_ID } from '@env';

let initialized = false;

const MISSING_ONESIGNAL_APP_ID_MESSAGE =
  '[OneSignal] ONESIGNAL_APP_ID is not set. OneSignal will not initialize; local daily notifications still work via expo-notifications.';

function getOneSignalAppId(): string {
  return ONESIGNAL_APP_ID || '';
}

export function isOneSignalConfigured(): boolean {
  if (Platform.OS === 'web') return false;
  return Boolean(getOneSignalAppId());
}

export async function initOneSignal(): Promise<void> {
  if (Platform.OS === 'web') return;
  const appId = getOneSignalAppId();
  if (!appId) {
    console.warn(MISSING_ONESIGNAL_APP_ID_MESSAGE);
    return;
  }
  if (initialized) return;

  if (__DEV__) {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  }
  OneSignal.initialize(appId);
  initialized = true;
}

export async function identifyOneSignalUser(appUserId: string): Promise<void> {
  if (!isOneSignalConfigured()) return;
  await initOneSignal();
  OneSignal.login(appUserId);
}

export async function logoutOneSignal(): Promise<void> {
  if (!initialized) return;
  OneSignal.logout();
}

async function requestLocalNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!isOneSignalConfigured()) {
    if (!initialized) {
      console.warn(MISSING_ONESIGNAL_APP_ID_MESSAGE);
    }
    return requestLocalNotificationPermission();
  }
  await initOneSignal();
  return OneSignal.Notifications.requestPermission(true);
}

export function setDailyPushTags(nextMessageDay: number, active: boolean): void {
  if (!isOneSignalConfigured()) return;
  OneSignal.User.addTags({
    daily_push_active: active ? '1' : '0',
    daily_push_next_day: String(nextMessageDay),
  });
}