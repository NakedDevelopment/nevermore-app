/**
 * onboarding.e2e.ts
 *
 * Covers the 5-step new-user onboarding:
 *   Permission → Purpose → Nickname → Invite → InviteSend → TrialWelcome → HomeTabs
 *
 * Also verifies that:
 *   - Existing users (sign-in) skip onboarding entirely
 *   - Mid-flow cold restarts resume at the correct step
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import {
  tapCreateAccount,
  waitForWelcomeScreen,
  waitForHomeTabs,
  waitForScreen,
  TEST_USER,
} from '../helpers/auth.helper';
import {
  clearAllPersistedState,
  seedOnboardingAtNickname,
  seedOnboardingComplete,
  seedActiveTrialState,
} from '../helpers/store.helper';

// ─────────────────────────────────────────────────────────────────────────────
describe('Onboarding', () => {
  beforeEach(async () => {
    await clearAllPersistedState();
    await device.launchApp({ newInstance: true });
    await waitForWelcomeScreen();
  });

  // ── Step helpers ──────────────────────────────────────────────────────────

  async function advanceThroughPermission() {
    await waitForScreen('Permission');
    // Tap Continue / Allow on the Permission screen
    await element(by.id('onboarding-continue')).tap();
  }

  async function advanceThroughPurpose() {
    await waitForScreen('Purpose');
    // Select either "Recovery" or "Support" option, then continue
    await element(by.id('purpose-option-recovery')).tap();
    await element(by.id('onboarding-continue')).tap();
  }

  async function advanceThroughNickname(nickname = 'Tester') {
    await waitForScreen('Nickname');
    await element(by.id('nickname-input')).typeText(nickname);
    await element(by.id('onboarding-continue')).tap();
  }

  async function skipInvite() {
    await waitForScreen('Invite');
    await element(by.id('onboarding-skip')).tap();
  }

  async function skipInviteSend() {
    await waitForScreen('Invite Send');
    await element(by.id('onboarding-skip')).tap();
  }

  async function confirmTrialWelcome() {
    await waitForScreen('TRIAL WELCOME', 8000);
    await element(by.id('trial-welcome-start')).tap();
  }

  // ── Full happy path ───────────────────────────────────────────────────────
  describe('Full onboarding flow (new user)', () => {
    it('shows Permission screen immediately after sign-up', async () => {
      await tapCreateAccount();
      // Minimal sign-up via direct store seed — avoids real network call
      // In a real environment, replace with a proper sign-up form fill
      // For now, confirm the step is correct after the user is authenticated
      await waitForScreen('Permission');
    });

    it('progresses through all 5 steps and reaches TrialWelcome', async () => {
      // Seed as authenticated + onboarding at step 1
      // (real sign-up would trigger this automatically)
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      await waitForWelcomeScreen();

      // Navigate through each step
      await advanceThroughPermission();
      await advanceThroughPurpose();
      await advanceThroughNickname();
      await skipInvite();
      await skipInviteSend();
      await waitForScreen('TRIAL WELCOME');
    });

    it('navigates to HomeTabs after TrialWelcome start button', async () => {
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      await waitForWelcomeScreen();

      await advanceThroughPermission();
      await advanceThroughPurpose();
      await advanceThroughNickname();
      await skipInvite();
      await skipInviteSend();
      await confirmTrialWelcome();
      await waitForHomeTabs();
    });
  });

  // ── Step-by-step content checks ───────────────────────────────────────────
  describe('Individual onboarding steps', () => {
    it('Permission step is visible and has a continue action', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://permission',
      });
      await waitForScreen('Permission');
      await detoxExpect(element(by.id('onboarding-continue'))).toBeVisible();
    });

    it('Purpose step shows Recovery and Support options', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://purpose',
      });
      await waitForScreen('Purpose');
      await detoxExpect(
        element(by.id('purpose-option-recovery'))
      ).toBeVisible();
      await detoxExpect(element(by.id('purpose-option-support'))).toBeVisible();
    });

    it('Nickname step requires a non-empty nickname', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://nickname',
      });
      await waitForScreen('Nickname');
      // Tap continue without entering a nickname
      await element(by.id('onboarding-continue')).tap();
      // Should remain on Nickname or show error
      await detoxExpect(element(by.id('nickname-input'))).toBeVisible();
    });

    it('Invite step can be skipped', async () => {
      await device.launchApp({
        newInstance: true,
        url: 'nevermoreapp://invite',
      });
      await waitForScreen('Invite');
      await detoxExpect(element(by.id('onboarding-skip'))).toBeVisible();
    });
  });

  // ── Resume mid-onboarding ─────────────────────────────────────────────────
  describe('Resume from cold start', () => {
    it('resumes at Nickname step when app was closed at that step', async () => {
      await seedOnboardingAtNickname();
      await device.launchApp({ newInstance: true });
      // Navigation should restore the onboarding stack to Nickname
      await waitForScreen('Nickname', 8000);
    });

    it('can navigate back from Nickname to Permission after resume', async () => {
      await seedOnboardingAtNickname();
      await device.launchApp({ newInstance: true });
      await waitForScreen('Nickname', 8000);
      // Back gesture should be available (stack was restored)
      await device.pressBack(); // Android; on iOS use swipe back or back button
      await waitForScreen('Purpose');
    });
  });

  // ── Existing user (sign-in) skips onboarding ─────────────────────────────
  describe('Existing user sign-in', () => {
    it('skips onboarding entirely and lands on HomeTabs', async () => {
      await seedOnboardingComplete();
      await seedActiveTrialState();
      await device.launchApp({ newInstance: true });
      // Simulating an already-authenticated existing user
      // The navigator should route directly to HOME_TABS
      await waitForHomeTabs(10000);
    });
  });
});
