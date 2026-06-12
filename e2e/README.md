# Nevermore — Detox E2E Test Suite

Framework: **Detox** + **Jest** + **TypeScript**
Covers commits: `c314c57 Fix subscription and 40-day regressions` + `3a1c6f2 Add Detox test IDs`

---

## Quick start

```bash
# 1. Install dependencies
yarn add --dev detox jest ts-jest @types/jest detox-cli

# 2. Generate native projects (ios/ and android/ are not committed)
npx expo prebuild --clean

# 3. Build
detox build --configuration ios.sim.debug

# 4. Run all tests
detox test --configuration ios.sim.debug

# Run only regression tests from c314c57
detox test --configuration ios.sim.debug --testNamePattern='\[REGRESSION\]'
```

---

## File map

```
e2e/
├── jest.config.js
├── setup.ts                         # Global launch / teardown
├── helpers/
│   ├── auth.helper.ts               # signIn/signUp helpers, waitFor wrappers
│   └── store.helper.ts              # AsyncStorage seeders (Zustand state)
└── tests/
    ├── auth.e2e.ts                  # Welcome, SignIn, SignUp, ForgotPassword
    ├── onboarding.e2e.ts            # 5-step flow, skip, cold-start resume
    ├── subscription.e2e.ts          # [REGRESSION] Trial gate, TrialExpired, Subscription screen
    ├── fortyDay.e2e.ts              # [REGRESSION] Free days 1–3, locked days 4+, task persistence
    └── navigation.e2e.ts            # [REGRESSION] Guards, drawer, tabs, deep links
```

---

## What the [REGRESSION] tests verify

These directly guard against the bugs fixed in `c314c57`:

| Test | What it prevents regressing |
|---|---|
| `Days 1–3 accessible without subscription` | Free tier cutoff broke — days 1-3 were showing lock icon |
| `Days 4+ locked for trial users` | Subscription gate wasn't firing on all code paths |
| `Task completion persisted to AsyncStorage` | Tasks completed during session were lost on app restart |
| `Tab state preserved (lazy=false)` | Switching tabs reset carousel position back to Day 1 |
| `subscribed user bypasses TrialExpired` | `isSubscribed` check was missing from the block condition |
| `sharedAccessStore bypasses TrialExpired` | New `isSharedAccessActive` pathway not wired into block |
| `back button on Subscription → TrialExpired` | Back navigated to Welcome instead of TrialExpired |
| `reset-password deep link` | Deep link array path config broke single-path handler |
| `create-new-password alias` | Second path alias from array was lost in rewrite |

---

## testIDs added in `3a1c6f2`

All testIDs in the tests match exactly what's in the app as of this commit.

| testID | Element |
|---|---|
| `signin-email` / `signin-password` / `signin-error` | SignIn screen |
| `signup-email` / `signup-password` / `signup-confirm-password` / `signup-terms-checkbox` | SignUp screen |
| `back-button` | All screens with back arrow |
| `forgot-password-email` / `forgot-password-error` | ForgotPassword screen |
| `onboarding-continue` | Permission, Purpose, Nickname, Invite, InviteSend |
| `onboarding-skip` | Nickname, Invite, InviteSend |
| `purpose-option-recovery` / `purpose-option-support` | Purpose screen |
| `nickname-input` | Nickname screen |
| `trial-welcome-start` | TrialWelcome screen |
| `trial-expired-screen` / `trial-expired-subscribe` / `restore-purchases-btn` / `trial-expired-logout` | TrialExpired screen |
| `plan-card-yearly` / `plan-card-monthly` | Subscription screen |
| `plan-radio-yearly-selected` / `plan-radio-monthly-selected` | Subscription screen (selected state) |
| `subscription-submit` / `restore-purchases-btn` | Subscription screen buttons |
| `subscription-popup` / `subscription-popup-close` / `subscription-popup-submit` / `subscription-popup-restore` | SubscriptionPopup component |
| `forty-day-carousel` / `forty-day-prev-btn` / `forty-day-next-btn` | FortyDay carousel |
| `day-lock-icon` | Locked day card |
| `audio-play-btn` | Audio play/pause button (active day only) |
| `task-item-{index}` / `task-checkbox-completed-{index}` / `task-checkbox-{index}` | Task items |
| `active-day-number-{day}` | Active day number text |
| `forty-day-carousel-item-locked` | Locked card touchable |
| `forty-day-retry-btn` | Retry button on error state |
| `home-screen` / `bookmark-screen` | Tab screen roots |
| `drawer-menu-button` / `drawer-content` / `back-button` | Drawer |

---

## Store seeding strategy

Most tests skip real network calls by pre-seeding AsyncStorage before launch.
Zustand `persist` middleware rehydrates from these keys on startup:

| Key | Store | Notes |
|---|---|---|
| `subscription-storage` | subscriptionStore | Only `isSubscribed` is persisted |
| `trial-storage` | trialStore | Only `trialStartDate` is persisted |
| `onboarding-storage` | onboardingStore | `isOnboardingComplete` + `currentOnboardingStep` |
| `forty-day-storage` | fortyDayStore | `currentDay` + `days` + `completedTasks` (added in c314c57) |

> ⚠️ `sharedAccessStore` does **not** use persist — it hydrates from the network
> via `invitationService.getActiveSharedInvitationForCurrentUser()` on each launch.

### Shared access testing

To test the `isSharedAccessActive` pathway end-to-end:

1. Create a staging Appwrite account (Account A) with an active subscription.
2. Create Account B (the test user) with an expired trial.
3. Have Account A send an invitation to Account B and accept it.
4. Use Account B credentials in the shared-access tests.

Or add a mock build variant that returns a fake invitation from `invitationService`.

---

## Package.json scripts to add

```json
"detox:build:ios":       "detox build --configuration ios.sim.debug",
"detox:build:android":   "detox build --configuration android.emu.debug",
"detox:test:ios":        "detox test --configuration ios.sim.debug",
"detox:test:android":    "detox test --configuration android.emu.debug",
"detox:test:regression": "detox test --configuration ios.sim.debug --testNamePattern='\\[REGRESSION\\]'"
```

---

## react-native-iap mock for CI

```ts
// __mocks__/react-native-iap.ts
export const initConnection = jest.fn().mockResolvedValue('true');
export const getSubscriptions = jest.fn().mockResolvedValue([
  { productId: 'monthly_sub', displayPrice: '$9.99', price: 9.99, currency: 'USD' },
  { productId: 'yearly_sub',  displayPrice: '$59.99', price: 59.99, currency: 'USD' },
]);
export const requestSubscription = jest.fn().mockResolvedValue({ transactionId: 'mock-txn' });
export const getAvailablePurchases = jest.fn().mockResolvedValue([]);
export const finishTransaction = jest.fn().mockResolvedValue(undefined);
export const endConnection = jest.fn().mockResolvedValue(undefined);
```
