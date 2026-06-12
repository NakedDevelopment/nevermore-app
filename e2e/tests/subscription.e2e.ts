/**
 * subscription.e2e.ts
 *
 * REGRESSION TESTS — "Fix subscription and 40-day regressions" (c314c57)
 *
 * Key regressions fixed in that commit:
 *   • sharedAccessStore added as a 3rd access pathway alongside isSubscribed
 *     and isTrialActive — all three must be respected in the TrialExpired block
 *   • Subscription back button routing corrected (trial expired → TrialExpired,
 *     trial active → go back normally)
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import {
  waitForWelcomeScreen,
  waitForHomeTabs,
  waitForScreen,
} from '../helpers/auth.helper';
import {
  clearAllPersistedState,
  seedExpiredTrialState,
  seedActiveTrialState,
  seedSubscribedState,
  seedOnboardingComplete,
  seedUnsubscribedState,
} from '../helpers/store.helper';

// ─────────────────────────────────────────────────────────────────────────────
describe('Subscription & Trial', () => {
  beforeEach(async () => {
    await clearAllPersistedState();
  });

  // ── TrialExpired hard-block ───────────────────────────────────────────────
  describe('[REGRESSION] TrialExpired hard-block', () => {
    it('routes authenticated user with expired trial to TrialExpired screen', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedUnsubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED', 10000);
    });

    it('TrialExpired screen shows Subscribe button', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await detoxExpect(element(by.id('trial-expired-subscribe'))).toBeVisible();
    });

    it('TrialExpired screen shows Restore Purchase link', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await detoxExpect(element(by.id('restore-purchases-btn'))).toBeVisible();
    });

    it('TrialExpired screen shows Log out option', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await detoxExpect(element(by.id('trial-expired-logout'))).toBeVisible();
    });

    it('cannot swipe back from TrialExpired (gesture disabled in navigator)', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await element(by.id('trial-expired-screen')).swipe('right', 'fast', 0.9);
      await detoxExpect(element(by.text('TRIAL ENDED'))).toBeVisible();
    });

    it('tapping Log out returns to Welcome screen', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await element(by.id('trial-expired-logout')).tap();
      await waitForWelcomeScreen(10000);
    });
  });

  // ── [REGRESSION] sharedAccessStore bypasses TrialExpired ─────────────────
  describe('[REGRESSION] Shared access bypasses TrialExpired block', () => {
    it('subscribed user with expired trial reaches HomeTabs (not TrialExpired)', async () => {
      // isSubscribed=true must bypass the block regardless of trial state
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedSubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs(10000);
      await detoxExpect(element(by.text('TRIAL ENDED'))).not.toBeVisible();
    });

    it('shared access user with expired trial reaches HomeTabs (network-dependent)', async () => {
      // sharedAccessStore hydrates from the network — this test requires a
      // staging Appwrite account with an active invitation.
      // See e2e/README.md § "Shared access testing".
      pending('Requires staging Appwrite account with active shared invitation');
    });

    it('useHasFullAccess is true when isSubscribed is true regardless of trial', async () => {
      // Verifies the logic: isSubscribed || isSharedAccessActive || isTrialActive()
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedSubscribedState();
      await device.launchApp({ newInstance: true });
      // If hasFullAccess were false, locked 40-day content would show popup
      // Navigate to FortyDay and verify Day 4 is NOT locked
      await waitForHomeTabs(10000);
      await element(by.text('40 Day')).tap();
      await waitFor(element(by.text('40 Day Challenge')))
        .toBeVisible()
        .withTimeout(10000);
      // Navigate to Day 4
      await element(by.id('forty-day-next-btn')).tap();
      await element(by.id('forty-day-next-btn')).tap();
      await element(by.id('forty-day-next-btn')).tap();
      // No lock icon should appear
      await detoxExpect(element(by.id('day-lock-icon'))).not.toBeVisible();
    });
  });

  // ── Subscription screen routing ───────────────────────────────────────────
  describe('[REGRESSION] Subscription screen routing', () => {
    async function openSubscriptionFromTrialExpired() {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedUnsubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await element(by.id('trial-expired-subscribe')).tap();
      await waitForScreen('SUBSCRIPTION', 8000);
    }

    it('navigates from TrialExpired to Subscription screen', async () => {
      await openSubscriptionFromTrialExpired();
      await detoxExpect(element(by.text('SUBSCRIPTION'))).toBeVisible();
    });

    it('[REGRESSION] back button on Subscription returns to TrialExpired when trial expired', async () => {
      // Before fix: back navigated to Welcome instead of TrialExpired
      await openSubscriptionFromTrialExpired();
      await element(by.id('back-button')).tap();
      await waitForScreen('TRIAL ENDED', 5000);
    });

    it('back button on Subscription does NOT show TrialExpired when trial is active', async () => {
      await seedOnboardingComplete();
      await seedActiveTrialState();
      await seedUnsubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs();
      await element(by.id('drawer-menu-button')).tap();
      await waitFor(element(by.id('drawer-subscription')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('drawer-subscription')).tap();
      await waitForScreen('SUBSCRIPTION');
      await element(by.id('back-button')).tap();
      await detoxExpect(element(by.text('TRIAL ENDED'))).not.toBeVisible();
    });
  });

  // ── Subscription screen UI ────────────────────────────────────────────────
  describe('Subscription screen UI', () => {
    async function openSubscriptionScreen() {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedUnsubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await element(by.id('trial-expired-subscribe')).tap();
      await waitForScreen('SUBSCRIPTION', 8000);
    }

    it('defaults to Yearly plan selected', async () => {
      await openSubscriptionScreen();
      await detoxExpect(element(by.id('plan-radio-yearly-selected'))).toBeVisible();
    });

    it('shows both Yearly and Monthly plan cards', async () => {
      await openSubscriptionScreen();
      await detoxExpect(element(by.id('plan-card-yearly'))).toBeVisible();
      await detoxExpect(element(by.id('plan-card-monthly'))).toBeVisible();
    });

    it('can switch selection to Monthly plan', async () => {
      await openSubscriptionScreen();
      await element(by.id('plan-card-monthly')).tap();
      await detoxExpect(element(by.id('plan-radio-monthly-selected'))).toBeVisible();
    });

    it('shows Subscribe button', async () => {
      await openSubscriptionScreen();
      await detoxExpect(element(by.id('subscription-submit'))).toBeVisible();
    });

    it('shows Restore Purchases button', async () => {
      await openSubscriptionScreen();
      await detoxExpect(element(by.id('restore-purchases-btn'))).toBeVisible();
    });

    it('shows error when IAP products are not configured', async () => {
      await openSubscriptionScreen();
      await element(by.id('subscription-submit')).tap();
      await waitFor(element(by.text(/not configured|try again/i)))
        .toBeVisible()
        .withTimeout(8000);
    });

    it('shows "active subscription" message when already subscribed', async () => {
      await seedOnboardingComplete();
      await seedSubscribedState();
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs();
      await element(by.id('drawer-menu-button')).tap();
      await waitFor(element(by.id('drawer-subscription')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('drawer-subscription')).tap();
      await waitForScreen('SUBSCRIPTION');
      await detoxExpect(
        element(by.text(/You have an active subscription/))
      ).toBeVisible();
    });
  });

  // ── Post-subscription navigation ──────────────────────────────────────────
  describe('[REGRESSION] Navigation after subscription actions', () => {
    it('Restore Purchase on TrialExpired leads to HomeTabs or no-purchase alert', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedUnsubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED');
      await element(by.id('restore-purchases-btn')).tap();
      // Two valid outcomes depending on mock/real IAP:
      try {
        await waitForHomeTabs(10000);
      } catch {
        await waitFor(element(by.text(/No active subscription/i)))
          .toBeVisible()
          .withTimeout(5000);
      }
    });
  });

  // ── Active trial — no block ───────────────────────────────────────────────
  describe('Active trial access', () => {
    it('user with active trial reaches HomeTabs without TrialExpired', async () => {
      await seedOnboardingComplete();
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs(10000);
      await detoxExpect(element(by.text('TRIAL ENDED'))).not.toBeVisible();
    });
  });
});
