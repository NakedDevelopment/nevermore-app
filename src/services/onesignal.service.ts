import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { LogLevel, OneSignal } from 'react-native-onesignal';
import { ONESIGNAL_APP_ID } from '@env';

let initialized = false;

const MISSING_ONESIGNAL_APP_ID_MESSAGE =
  '[OneSignal] ONESIGNAL_APP_ID is not set. OneSignal will not initialize; local daily notifications still work via expo-notifications.';

const REMOTE_PUSH_DEFERRED_MESSAGE =
  '[OneSignal] Remote push registration is unavailable (APNs/FCM may not be active). Local 18:30 daily notifications are unaffected.';

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

  try {
    if (__DEV__) {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    }
    OneSignal.initialize(appId);
    initialized = true;
  } catch (error) {
    console.warn(REMOTE_PUSH_DEFERRED_MESSAGE, error);
  }
}

export async function identifyOneSignalUser(appUserId: string): Promise<void> {
  if (!isOneSignalConfigured()) return;
  try {
    await initOneSignal();
    if (!initialized) return;
    OneSignal.login(appUserId);
  } catch (error) {
    console.warn(REMOTE_PUSH_DEFERRED_MESSAGE, error);
  }
}

export async function logoutOneSignal(): Promise<void> {
  if (!initialized) return;
  try {
    OneSignal.logout();
  } catch (error) {
    console.warn(REMOTE_PUSH_DEFERRED_MESSAGE, error);
  }
}

async function requestLocalNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * OS permission for the 40-day local sequence always goes through expo-notifications.
 * OneSignal remote registration is best-effort and must not block local scheduling.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (isOneSignalConfigured()) {
    try {
      await initOneSignal();
      if (initialized) {
        await OneSignal.Notifications.requestPermission(true);
      }
    } catch (error) {
      console.warn(REMOTE_PUSH_DEFERRED_MESSAGE, error);
    }
  } else {
    console.warn(MISSING_ONESIGNAL_APP_ID_MESSAGE);
  }

  try {
    return await requestLocalNotificationPermission();
  } catch (error) {
    console.warn('[Nevermore] Local notification permission request failed.', error);
    return false;
  }
}

export function setDailyPushTags(nextMessageDay: number, active: boolean): void {
  if (!isOneSignalConfigured() || !initialized) return;
  try {
    OneSignal.User.addTags({
      daily_push_active: active ? '1' : '0',
      daily_push_next_day: String(nextMessageDay),
    });
  } catch (error) {
    console.warn(REMOTE_PUSH_DEFERRED_MESSAGE, error);
  }
}