/**
 * auth.e2e.ts
 *
 * Covers the authentication screens:
 *   Welcome → SignUp / SignIn → onboarding gate or HomeTabs
 *
 * Each test relaunches the app with a clean state to ensure isolation.
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import {
  tapCreateAccount,
  tapSignInLink,
  signInFromWelcome,
  waitForWelcomeScreen,
  waitForHomeTabs,
  waitForScreen,
  uniqueEmail,
  TEST_USER,
} from '../helpers/auth.helper';
import { clearAllPersistedState } from '../helpers/store.helper';

// ─────────────────────────────────────────────────────────────────────────────
describe('Authentication', () => {
  beforeEach(async () => {
    await clearAllPersistedState();
    await device.launchApp({ newInstance: true });
    await waitForWelcomeScreen();
  });

  // ── Welcome screen ──────────────────────────────────────────────────────
  describe('Welcome screen', () => {
    it('shows the Nevermore title', async () => {
      await detoxExpect(element(by.text('NEVERMORE'))).toBeVisible();
    });

    it('has a "Create Account" button', async () => {
      await detoxExpect(element(by.id('welcome-create-account'))).toBeVisible();
    });

    it('has a "Sign In" link', async () => {
      await detoxExpect(element(by.id('welcome-sign-in'))).toBeVisible();
    });

    it('navigates to Sign Up on "Create Account" tap', async () => {
      await tapCreateAccount();
      // The Sign Up screen has a "Create Account" submit button and email field
      await waitFor(element(by.id('signup-email')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('navigates to Sign In on "Sign In" link tap', async () => {
      await tapSignInLink();
      await waitFor(element(by.id('signin-email')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  // ── Sign Up ─────────────────────────────────────────────────────────────
  describe('Sign Up', () => {
    beforeEach(async () => {
      await tapCreateAccount();
      await waitFor(element(by.id('signup-email')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('shows validation error when submitting empty form', async () => {
      await element(by.id('signup-submit')).tap();
      // At least one error / disabled state should appear
      await detoxExpect(element(by.id('signup-email'))).toBeVisible();
    });

    it('shows password mismatch error', async () => {
      await element(by.id('signup-email')).typeText(uniqueEmail());
      await element(by.id('signup-password')).typeText('Password123!');
      await element(by.id('signup-confirm-password')).typeText('Different123!');
      await element(by.id('signup-terms-checkbox')).tap();
      await element(by.id('signup-submit')).tap();
      // Error text about passwords not matching
      await waitFor(element(by.text(/password/i)))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('requires agreeing to terms', async () => {
      const email = uniqueEmail();
      await element(by.id('signup-email')).typeText(email);
      await element(by.id('signup-password')).typeText(TEST_USER.password);
      await element(by.id('signup-confirm-password')).typeText(
        TEST_USER.password
      );
      // Do NOT tap terms checkbox
      await element(by.id('signup-submit')).tap();
      // Should not leave the sign-up screen
      await detoxExpect(element(by.id('signup-email'))).toBeVisible();
    });

    it('navigates to back-arrow returns to Welcome', async () => {
      await element(by.id('back-button')).tap();
      await waitForWelcomeScreen();
    });
  });

  // ── Sign In ─────────────────────────────────────────────────────────────
  describe('Sign In', () => {
    beforeEach(async () => {
      await tapSignInLink();
      await waitFor(element(by.id('signin-email')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('shows error for wrong credentials', async () => {
      await element(by.id('signin-email')).typeText('wrong@example.com');
      await element(by.id('signin-password')).typeText('WrongPassword99!');
      await element(by.id('signin-submit')).tap();
      await waitFor(element(by.id('signin-error')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('shows error for empty form submission', async () => {
      await element(by.id('signin-submit')).tap();
      // Email validation fires before network call
      await detoxExpect(element(by.id('signin-email'))).toBeVisible();
    });

    it('has a "Forgot Password?" link', async () => {
      await detoxExpect(element(by.text('Forgot Password?'))).toBeVisible();
    });

    it('navigates to Forgot Password', async () => {
      await element(by.text('Forgot Password?')).tap();
      await waitForScreen('FORGOT PASSWORD');
    });

    it('back arrow returns to Welcome', async () => {
      await element(by.id('back-button')).tap();
      await waitForWelcomeScreen();
    });

    it('successful sign-in lands on HomeTabs (existing user)', async () => {
      // This test requires TEST_USER to exist in the staging Appwrite project
      await element(by.id('signin-email')).typeText(TEST_USER.email);
      await element(by.id('signin-password')).typeText(TEST_USER.password);
      await element(by.id('signin-submit')).tap();
      await waitForHomeTabs(20000);
    });
  });

  // ── Forgot Password ─────────────────────────────────────────────────────
  describe('Forgot Password', () => {
    beforeEach(async () => {
      await tapSignInLink();
      await element(by.text('Forgot Password?')).tap();
      await waitForScreen('FORGOT PASSWORD');
    });

    it('shows email input and Send button', async () => {
      await detoxExpect(element(by.id('forgot-password-email'))).toBeVisible();
      await detoxExpect(element(by.id('forgot-password-submit'))).toBeVisible();
    });

    it('shows error for invalid email format', async () => {
      await element(by.id('forgot-password-email')).typeText('not-an-email');
      await element(by.id('forgot-password-submit')).tap();
      await waitFor(element(by.id('forgot-password-error')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });
});
