import { Platform } from 'react-native';
import { LogLevel, OneSignal } from 'react-native-onesignal';
import { ONESIGNAL_APP_ID } from '@env';

let initialized = false;

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
  if (!appId || initialized) return;

  if (__DEV__) {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  }
  OneSignal.initialize(appId);
  initialized = true;
}

export async function identifyOneSignalUser(appUserId: string, email?: string | null): Promise<void> {
  if (!isOneSignalConfigured()) return;
  await initOneSignal();
  OneSignal.login(appUserId);
  if (email) {
    OneSignal.User.addEmail(email);
  }
}

export async function logoutOneSignal(): Promise<void> {
  if (!initialized) return;
  OneSignal.logout();
}

export async function requestPushPermission(): Promise<boolean> {
  if (!isOneSignalConfigured()) return false;
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