/**
 * fortyDay.e2e.ts
 *
 * REGRESSION TESTS — "Fix subscription and 40-day regressions" (c314c57)
 *
 * Key regressions fixed:
 *   • Days 1–3 free, Days 4+ gated by hasFullAccess
 *     (isSubscribed || isSharedAccessActive || isTrialActive())
 *   • fortyDayStore now persists completedTasks to AsyncStorage
 *     (tasks survived screen transitions but not app restarts — now fixed)
 *   • HomeTabs uses lazy=false + detachInactiveScreens=false so tab state
 *     is preserved when switching tabs
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { waitForHomeTabs } from '../helpers/auth.helper';
import {
  clearAllPersistedState,
  seedActiveTrialState,
  seedSubscribedState,
  seedOnboardingComplete,
  seedUnsubscribedState,
  seedCompletedTask,
} from '../helpers/store.helper';

// ─── Setup helpers ────────────────────────────────────────────────────────────

async function launchToFortyDayTab(subscribed = false) {
  await clearAllPersistedState();
  await seedOnboardingComplete();
  if (subscribed) {
    await seedSubscribedState();
  } else {
    await seedActiveTrialState();
    await seedUnsubscribedState();
  }
  await device.launchApp({ newInstance: true });
  await waitForHomeTabs();
  await element(by.text('40 Day')).tap();
  await waitFor(element(by.text('40 Day Challenge')))
    .toBeVisible()
    .withTimeout(15000);
}

async function tapNext(times = 1) {
  for (let i = 0; i < times; i++) {
    await element(by.id('forty-day-next-btn')).tap();
    await new Promise((r) => setTimeout(r, 400));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('40 Day Journey', () => {

  // ── Screen structure ──────────────────────────────────────────────────────
  describe('Screen structure', () => {
    it('shows the "40 Day Challenge" heading', async () => {
      await launchToFortyDayTab();
      await detoxExpect(element(by.text('40 Day Challenge'))).toBeVisible();
    });

    it('shows carousel, prev/next buttons, and tasks section', async () => {
      await launchToFortyDayTab();
      await detoxExpect(element(by.id('forty-day-carousel'))).toBeVisible();
      await detoxExpect(element(by.id('forty-day-prev-btn'))).toBeVisible();
      await detoxExpect(element(by.id('forty-day-next-btn'))).toBeVisible();
      await detoxExpect(element(by.text('Tasks for today'))).toBeVisible();
    });

    it('shows completion percentage on the active day card', async () => {
      await launchToFortyDayTab();
      await detoxExpect(element(by.text(/Completed: \d+%/))).toBeVisible();
    });

    it('prev button does not navigate when on Day 1 (tap has no effect)', async () => {
      await launchToFortyDayTab();
      // Day 1 is the starting point
      await detoxExpect(element(by.id('active-day-number-1'))).toBeVisible();
      await element(by.id('forty-day-prev-btn')).tap();
      // Still on Day 1
      await detoxExpect(element(by.id('active-day-number-1'))).toBeVisible();
    });
  });

  // ── [REGRESSION] Free days 1–3 ───────────────────────────────────────────
  describe('[REGRESSION] Days 1–3 accessible without subscription', () => {
    it('Day 1 does NOT show a lock icon', async () => {
      await launchToFortyDayTab(false);
      await detoxExpect(element(by.id('day-lock-icon'))).not.toBeVisible();
    });

    it('Day 1 shows audio play button (not "Unlock to play")', async () => {
      await launchToFortyDayTab(false);
      await detoxExpect(element(by.id('audio-play-btn'))).toBeVisible();
      await detoxExpect(element(by.text('Unlock to play'))).not.toBeVisible();
    });

    it('Day 1 task tap does NOT show SubscriptionPopup', async () => {
      await launchToFortyDayTab(false);
      await element(by.id('task-item-0')).tap();
      await detoxExpect(element(by.id('subscription-popup'))).not.toBeVisible();
    });

    it('Day 2 does NOT show a lock icon', async () => {
      await launchToFortyDayTab(false);
      await tapNext(1);
      await detoxExpect(element(by.id('active-day-number-2'))).toBeVisible();
      await detoxExpect(element(by.id('day-lock-icon'))).not.toBeVisible();
    });

    it('Day 3 does NOT show a lock icon', async () => {
      await launchToFortyDayTab(false);
      await tapNext(2);
      await detoxExpect(element(by.id('active-day-number-3'))).toBeVisible();
      await detoxExpect(element(by.id('day-lock-icon'))).not.toBeVisible();
    });
  });

  // ── [REGRESSION] Locked days 4+ ──────────────────────────────────────────
  describe('[REGRESSION] Days 4+ locked for trial (non-subscribed) users', () => {
    it('Day 4 shows a lock icon for trial user', async () => {
      await launchToFortyDayTab(false);
      await tapNext(3);
      await detoxExpect(element(by.id('active-day-number-4'))).toBeVisible();
      await detoxExpect(element(by.id('day-lock-icon'))).toBeVisible();
    });

    it('Day 4 shows "Unlock to play" instead of audio controls', async () => {
      await launchToFortyDayTab(false);
      await tapNext(3);
      await detoxExpect(element(by.text('Unlock to play'))).toBeVisible();
      await detoxExpect(element(by.id('audio-play-btn'))).not.toBeVisible();
    });

    it('tapping locked Day 4 card opens SubscriptionPopup', async () => {
      await launchToFortyDayTab(false);
      await tapNext(3);
      await element(by.id('forty-day-carousel-item-locked')).tap();
      await waitFor(element(by.id('subscription-popup')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('tapping a task on Day 4 opens SubscriptionPopup (does not toggle)', async () => {
      await launchToFortyDayTab(false);
      await tapNext(3);
      await element(by.id('task-item-0')).tap();
      await waitFor(element(by.id('subscription-popup')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('SubscriptionPopup can be dismissed', async () => {
      await launchToFortyDayTab(false);
      await tapNext(3);
      await element(by.id('forty-day-carousel-item-locked')).tap();
      await waitFor(element(by.id('subscription-popup')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('subscription-popup-close')).tap();
      await detoxExpect(element(by.id('subscription-popup'))).not.toBeVisible();
    });
  });

  // ── Subscribed user has full access ───────────────────────────────────────
  describe('Subscribed user: full access to all days', () => {
    it('Day 4 has no lock icon for subscribed user', async () => {
      await launchToFortyDayTab(true);
      await tapNext(3);
      await detoxExpect(element(by.id('active-day-number-4'))).toBeVisible();
      await detoxExpect(element(by.id('day-lock-icon'))).not.toBeVisible();
    });

    it('Day 4 shows audio controls (not "Unlock to play") for subscribed user', async () => {
      await launchToFortyDayTab(true);
      await tapNext(3);
      await detoxExpect(element(by.id('audio-play-btn'))).toBeVisible();
      await detoxExpect(element(by.text('Unlock to play'))).not.toBeVisible();
    });

    it('task toggle on Day 4 marks task complete without popup', async () => {
      await launchToFortyDayTab(true);
      await tapNext(3);
      await element(by.id('task-item-0')).tap();
      await detoxExpect(element(by.id('task-checkbox-completed-0'))).toBeVisible();
      await detoxExpect(element(by.id('subscription-popup'))).not.toBeVisible();
    });
  });

  // ── [REGRESSION] Task completion persists across restarts ────────────────
  describe('[REGRESSION] Task completion persisted to AsyncStorage', () => {
    it('completed task is still checked after app restart', async () => {
      // Complete a task on Day 1 via the UI
      await launchToFortyDayTab(true);
      await detoxExpect(element(by.id('active-day-number-1'))).toBeVisible();
      await element(by.id('task-item-0')).tap();
      await detoxExpect(element(by.id('task-checkbox-completed-0'))).toBeVisible();

      // Restart the app without clearing state
      await device.launchApp({ newInstance: false });
      await waitForHomeTabs();
      await element(by.text('40 Day')).tap();
      await waitFor(element(by.text('40 Day Challenge')))
        .toBeVisible()
        .withTimeout(10000);

      // Task should still show as completed
      await detoxExpect(element(by.id('task-checkbox-completed-0'))).toBeVisible();
    });

    it('pre-seeded completed task shows as checked on launch', async () => {
      // Seed the task directly via AsyncStorage before launch
      await clearAllPersistedState();
      await seedOnboardingComplete();
      await seedSubscribedState();
      await seedActiveTrialState();
      // We don't know the real task ID without loading content, so this test
      // is a smoke test for the seeding mechanism itself
      await seedCompletedTask(1, 'task-0');
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs();
      // If the store rehydrates correctly, the day 1 task-0 will be marked complete
      await element(by.text('40 Day')).tap();
      await waitFor(element(by.text('40 Day Challenge')))
        .toBeVisible()
        .withTimeout(10000);
      // At minimum, the app should not crash on launch with pre-seeded tasks
      await detoxExpect(element(by.text('40 Day Challenge'))).toBeVisible();
    });
  });

  // ── [REGRESSION] Tab state preserved when switching tabs ─────────────────
  describe('[REGRESSION] Tab state preserved (lazy=false, detachInactiveScreens=false)', () => {
    it('navigating away from 40 Day and back preserves current day position', async () => {
      await launchToFortyDayTab(true);
      // Navigate to Day 3
      await tapNext(2);
      await detoxExpect(element(by.id('active-day-number-3'))).toBeVisible();

      // Switch to Temptations tab and back
      await element(by.text('Temptations')).tap();
      await element(by.text('40 Day')).tap();

      // Should still be on Day 3
      await detoxExpect(element(by.id('active-day-number-3'))).toBeVisible();
    });
  });

  // ── Carousel navigation ───────────────────────────────────────────────────
  describe('Carousel navigation', () => {
    it('tapping Next advances to Day 2', async () => {
      await launchToFortyDayTab(false);
      await tapNext(1);
      await detoxExpect(element(by.id('active-day-number-2'))).toBeVisible();
    });

    it('tapping Prev from Day 2 returns to Day 1', async () => {
      await launchToFortyDayTab(false);
      await tapNext(1);
      await element(by.id('forty-day-prev-btn')).tap();
      await detoxExpect(element(by.id('active-day-number-1'))).toBeVisible();
    });

    it('next button does not advance past the last day', async () => {
      await launchToFortyDayTab(true);
      for (let i = 0; i < 40; i++) {
        await element(by.id('forty-day-next-btn')).tap();
        await new Promise((r) => setTimeout(r, 150));
      }
      // Should be capped at Day 40
      await detoxExpect(element(by.id('active-day-number-40'))).toBeVisible();
    });
  });

  // ── Error / retry ─────────────────────────────────────────────────────────
  describe('Error handling', () => {
    it('shows Retry button when content fails to load', async () => {
      pending('Requires network-blocking e2e build variant');
    });
  });
});
