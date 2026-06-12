/**
 * navigation.e2e.ts
 *
 * Tests the navigation guards in src/navigation/index.tsx.
 *
 * Changes from c314c57 relevant here:
 *   • Deep linking rewritten — now uses custom getRouteFromDeepLink parser
 *     with Linking.getInitialURL + addEventListener. Path config is now a
 *     single string (not an array).
 *   • isSharedAccessActive added to the TrialExpired block condition
 *   • HomeTabs: lazy=false, detachInactiveScreens=false (covered in fortyDay)
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import {
  waitForWelcomeScreen,
  waitForHomeTabs,
  waitForScreen,
} from '../helpers/auth.helper';
import {
  clearAllPersistedState,
  seedActiveTrialState,
  seedExpiredTrialState,
  seedSubscribedState,
  seedOnboardingComplete,
  seedOnboardingAtNickname,
  seedUnsubscribedState,
} from '../helpers/store.helper';

// ─────────────────────────────────────────────────────────────────────────────
describe('Navigation guards', () => {
  beforeEach(async () => {
    await clearAllPersistedState();
  });

  // ── Auth gate ─────────────────────────────────────────────────────────────
  describe('Auth gate', () => {
    it('unauthenticated user sees Welcome screen on cold start', async () => {
      await device.launchApp({ newInstance: true });
      await waitForWelcomeScreen(10000);
    });

    it('unauthenticated user launching into home deep link lands on Welcome', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://home',
      });
      await waitForWelcomeScreen(10000);
    });
  });

  // ── Onboarding gate ───────────────────────────────────────────────────────
  describe('Onboarding gate', () => {
    it('resumes at Nickname when onboarding was paused there', async () => {
      await seedActiveTrialState();
      await seedOnboardingAtNickname();
      await device.launchApp({ newInstance: true });
      await waitForScreen('Nickname', 10000);
    });
  });

  // ── Subscription / trial gate ─────────────────────────────────────────────
  describe('Subscription & trial gate', () => {
    it('active trial user reaches HomeTabs', async () => {
      await seedOnboardingComplete();
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs(10000);
    });

    it('expired trial + no subscription routes to TrialExpired', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedUnsubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForScreen('TRIAL ENDED', 10000);
    });

    it('[REGRESSION] subscribed user bypasses TrialExpired even with expired trial', async () => {
      await seedOnboardingComplete();
      await seedExpiredTrialState();
      await seedSubscribedState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs(10000);
      await detoxExpect(element(by.text('TRIAL ENDED'))).not.toBeVisible();
    });

    it('[REGRESSION] isSharedAccessActive bypasses TrialExpired (network-dependent)', async () => {
      // sharedAccessStore does not persist — requires a real Appwrite staging invitation.
      pending('Requires staging account with active shared invitation');
    });
  });

  // ── Bottom-tab navigation ─────────────────────────────────────────────────
  describe('Bottom tab navigation', () => {
    beforeEach(async () => {
      await seedOnboardingComplete();
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs();
    });

    it('shows Temptations, 40 Day, and Bookmark tabs', async () => {
      await detoxExpect(element(by.text('Temptations'))).toBeVisible();
      await detoxExpect(element(by.text('40 Day'))).toBeVisible();
      await detoxExpect(element(by.text('Bookmark'))).toBeVisible();
    });

    it('tapping "40 Day" shows the 40 Day Challenge screen', async () => {
      await element(by.text('40 Day')).tap();
      await waitForScreen('40 Day Challenge');
    });

    it('tapping "Bookmark" shows the Bookmark screen', async () => {
      await element(by.text('Bookmark')).tap();
      await waitFor(element(by.id('bookmark-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('tapping "Temptations" shows the Home screen', async () => {
      await element(by.text('40 Day')).tap();
      await element(by.text('Temptations')).tap();
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // ── Drawer navigation ─────────────────────────────────────────────────────
  describe('Drawer menu', () => {
    beforeEach(async () => {
      await seedOnboardingComplete();
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      await waitForHomeTabs();
      await element(by.id('drawer-menu-button')).tap();
      await waitFor(element(by.id('drawer-content')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('opens via hamburger icon', async () => {
      await detoxExpect(element(by.id('drawer-content'))).toBeVisible();
    });

    it('shows Profile, Subscription, and Sign Out options', async () => {
      await detoxExpect(element(by.id('drawer-profile'))).toBeVisible();
      await detoxExpect(element(by.id('drawer-subscription'))).toBeVisible();
      await detoxExpect(element(by.id('drawer-sign-out'))).toBeVisible();
    });

    it('navigates to Profile', async () => {
      await element(by.id('drawer-profile')).tap();
      await waitForScreen('Profile');
    });

    it('closes via swipe left', async () => {
      await element(by.id('drawer-content')).swipe('left', 'fast', 0.8);
      await detoxExpect(element(by.id('drawer-content'))).not.toBeVisible();
    });
  });

  // ── Deep links ────────────────────────────────────────────────────────────
  describe('[REGRESSION] Deep link routing (rewritten in c314c57)', () => {
    it('reset-password deep link opens CreateNewPassword screen', async () => {
      // Path changed from array ['reset-password','create-new-password']
      // to single string 'reset-password' in custom getRouteFromDeepLink parser
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://reset-password?userId=test&secret=abc123',
      });
      await waitForScreen('Create New Password', 8000);
    });

    it('create-new-password alias also opens CreateNewPassword screen', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://create-new-password?userId=test&secret=abc123',
      });
      await waitForScreen('Create New Password', 8000);
    });

    it('verify-magic-url deep link opens MagicURLVerify screen', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://verify-magic-url?userId=test&secret=abc123',
      });
      await waitForScreen('Verify Magic URL', 8000);
    });

    it('invite deep link opens Invite screen', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://invite?token=tok&userId=uid&secret=sec&expire=exp&project=proj',
      });
      await waitForScreen('Invite', 8000);
    });

    it('https://nevermoreapp.com reset-password deep link works', async () => {
      // New domain added in c314c57 linking prefixes
      await device.launchApp({
        newInstance: true,
        url: 'https://nevermoreapp.com/reset-password?userId=test&secret=abc123',
      });
      await waitForScreen('Create New Password', 8000);
    });

    it('unknown deep link path falls through to Welcome (unauthenticated)', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://unknown-path',
      });
      await waitForWelcomeScreen(8000);
    });
  });
});
