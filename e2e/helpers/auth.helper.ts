import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

// ─── Test credentials ────────────────────────────────────────────────────────
// Use a dedicated test account that always exists in the Appwrite staging env.
export const TEST_USER = {
  email: 'e2e-test@nevermoreapp.dev',
  password: 'E2eTestPass123!',
};

// A fresh, unique email for sign-up tests that create new accounts
export function uniqueEmail() {
  return `e2e-${Date.now()}@nevermoreapp.dev`;
}

// ─── Navigation helpers ──────────────────────────────────────────────────────

/** Tap "Create Account" on the Welcome screen */
export async function tapCreateAccount() {
  await detoxExpect(element(by.id('welcome-create-account'))).toBeVisible();
  await element(by.id('welcome-create-account')).tap();
}

/** Tap the "Sign In" link on the Welcome screen */
export async function tapSignInLink() {
  await detoxExpect(element(by.id('welcome-sign-in'))).toBeVisible();
  await element(by.id('welcome-sign-in')).tap();
}

// ─── Full flows ───────────────────────────────────────────────────────────────

/**
 * Fills in and submits the Sign Up form.
 * Caller is responsible for being on the SignUp screen before calling.
 */
export async function fillSignUpForm({
  email,
  password,
  agreeToTerms = true,
}: {
  email: string;
  password: string;
  agreeToTerms?: boolean;
}) {
  // Email field  (testID="signup-email" should be added to Input component)
  await element(by.id('signup-email')).typeText(email);
  // Password
  await element(by.id('signup-password')).typeText(password);
  // Confirm password
  await element(by.id('signup-confirm-password')).typeText(password);

  if (agreeToTerms) {
    // Agree to terms checkbox
    await element(by.id('signup-terms-checkbox')).tap();
  }

  await element(by.id('signup-submit')).tap();
}

/**
 * Navigates from the Welcome screen all the way through the happy-path
 * sign-in flow and waits for HomeTabs to appear.
 */
export async function signInFromWelcome({
  email = TEST_USER.email,
  password = TEST_USER.password,
}: { email?: string; password?: string } = {}) {
  // From Welcome screen
  await tapSignInLink();

  await waitFor(element(by.id('signin-email')))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.id('signin-email')).typeText(email);
  await element(by.id('signin-password')).typeText(password);
  await element(by.id('signin-submit')).tap();
}

/**
 * Signs out from the Drawer menu.
 * Caller must be on a HomeTabs screen first.
 */
export async function signOutViaDrawer() {
  // Open drawer
  await element(by.id('drawer-menu-button')).tap();
  await waitFor(element(by.id('drawer-sign-out')))
    .toBeVisible()
    .withTimeout(3000);
  await element(by.id('drawer-sign-out')).tap();
  // Confirm the alert / modal if present
  try {
    await element(by.id('confirmation-confirm')).tap();
  } catch {
    // Some builds skip the confirmation alert
  }
}

// ─── Wait helpers ────────────────────────────────────────────────────────────

export async function waitForWelcomeScreen(timeout = 10000) {
  await waitFor(element(by.text('NEVERMORE')))
    .toBeVisible()
    .withTimeout(timeout);
}

export async function waitForHomeTabs(timeout = 15000) {
  // The bottom-tab label that's always visible on HomeTabs
  await waitFor(element(by.text('40 Day')))
    .toBeVisible()
    .withTimeout(timeout);
}

export async function waitForScreen(screenText: string, timeout = 10000) {
  await waitFor(element(by.text(screenText)))
    .toBeVisible()
    .withTimeout(timeout);
}
