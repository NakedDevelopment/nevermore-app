/**
 * store.helper.ts
 *
 * Pre-seeds AsyncStorage before app launch so tests can skip expensive
 * network calls. Keys must match the `name` fields in each Zustand persist config.
 *
 * NOTE: sharedAccessStore does NOT use persist middleware — it rehydrates from
 * the network on each launch. To test shared-access scenarios you must either:
 *   a) Use a real Appwrite staging invitation (see TEST_SHARED_ACCESS below), or
 *   b) Mock invitationService in a custom e2e build variant.
 */

import { device } from 'detox';

// ─── AsyncStorage keys (must match Zustand persist `name` fields) ─────────────
const KEYS = {
  subscription: 'subscription-storage',
  trial:        'trial-storage',
  onboarding:   'onboarding-storage',
  fortyDay:     'forty-day-storage',
};

// ─── Low-level setter ─────────────────────────────────────────────────────────
async function setAsyncStorage(key: string, value: object) {
  await device.executeScript(
    `
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(${JSON.stringify(key)}, JSON.stringify(${JSON.stringify(
      JSON.stringify(value)
    )}));
    `,
    []
  );
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export async function seedSubscribedState() {
  await setAsyncStorage(KEYS.subscription, {
    state: { isSubscribed: true },
    version: 0,
  });
}

export async function seedUnsubscribedState() {
  await setAsyncStorage(KEYS.subscription, {
    state: { isSubscribed: false },
    version: 0,
  });
}

// ─── Trial ────────────────────────────────────────────────────────────────────

/** Trial started 1 hour ago — well within the 72-hour window */
export async function seedActiveTrialState() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await setAsyncStorage(KEYS.trial, {
    state: { trialStartDate: oneHourAgo },
    version: 0,
  });
}

/** Trial started 4 days ago — expired (window is 72 hours) */
export async function seedExpiredTrialState() {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  await setAsyncStorage(KEYS.trial, {
    state: { trialStartDate: fourDaysAgo },
    version: 0,
  });
}

export async function seedNoTrialState() {
  await setAsyncStorage(KEYS.trial, {
    state: { trialStartDate: null },
    version: 0,
  });
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export async function seedOnboardingComplete() {
  await setAsyncStorage(KEYS.onboarding, {
    state: { isOnboardingComplete: true, currentOnboardingStep: null },
    version: 0,
  });
}

export async function seedOnboardingAtNickname() {
  await setAsyncStorage(KEYS.onboarding, {
    state: { isOnboardingComplete: false, currentOnboardingStep: 'Nickname' },
    version: 0,
  });
}

// ─── 40-Day task completion ───────────────────────────────────────────────────

/**
 * Seeds a completed task for a given day. Uses the same key format as
 * `getTaskStorageKey` in fortyDayStore: `day-${day}-task-${taskId}`.
 * This verifies that task completion persists across app restarts.
 */
export async function seedCompletedTask(day: number, taskId: string) {
  const taskKey = `day-${day}-task-${taskId}`;
  // completedTasks is stored inside the forty-day-storage persist blob
  const existing = await device.executeScript(
    `
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(${JSON.stringify(KEYS.fortyDay)});
    `,
    []
  );

  let state: any = { currentDay: 1, days: [], completedTasks: {} };
  try {
    const parsed = JSON.parse(existing ?? '{}');
    state = parsed.state ?? state;
  } catch { /* start fresh */ }

  state.completedTasks = state.completedTasks ?? {};
  state.completedTasks[taskKey] = true;

  await setAsyncStorage(KEYS.fortyDay, { state, version: 0 });
}

// ─── Shared access (network-only — cannot be seeded via AsyncStorage) ─────────
//
// sharedAccessStore does not persist to AsyncStorage. It hydrates on launch by
// calling invitationService.getActiveSharedInvitationForCurrentUser().
//
// To test shared-access flows in CI, either:
//   1. Use a dedicated staging Appwrite account that has an active invitation
//      (TEST_SHARED_ACCESS_EMAIL / TEST_SHARED_ACCESS_PASSWORD in e2e .env), or
//   2. Add a mock build variant that returns a fake invitation from the service.
//
// See e2e/README.md § "Shared access testing" for details.

// ─── Full reset ───────────────────────────────────────────────────────────────

export async function clearAllPersistedState() {
  await device.executeScript(
    `
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.multiRemove([
      ${JSON.stringify(KEYS.subscription)},
      ${JSON.stringify(KEYS.trial)},
      ${JSON.stringify(KEYS.onboarding)},
      ${JSON.stringify(KEYS.fortyDay)},
    ]);
    `,
    []
  );
}
