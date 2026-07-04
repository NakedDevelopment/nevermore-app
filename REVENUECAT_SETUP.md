# RevenueCat Setup

This app now uses RevenueCat for subscription state, purchases, restore, hosted paywalls, and Customer Center.

## Installed packages

```bash
npm install --save react-native-purchases react-native-purchases-ui
```

## App configuration

The app reads RevenueCat SDK keys from `.env`. Production builds should use platform-specific public SDK keys from the RevenueCat app settings:

```text
REVENUECAT_API_KEY_IOS=<public_apple_api_key>
REVENUECAT_API_KEY_ANDROID=<public_google_api_key>
```

`REVENUECAT_API_KEY` remains available as a shared fallback for local development. If no key is configured, or if a Test Store `test_...` key is accidentally used in a production build, RevenueCat flows are disabled gracefully instead of crashing app startup.

The active entitlement checked by the app is:

```text
Lou Knows LLC Pro
```

Since the app has exactly one paid tier, subscription status is actually determined by whether the customer has ANY active entitlement (not by matching this name) — so a dashboard naming mismatch can't lock out a paying user. The name above is still used as the `requiredEntitlementIdentifier` when presenting the RevenueCat paywall (`RevenueCatUI.presentPaywallIfNeeded`), so it must exactly match the entitlement identifier configured in the dashboard for the paywall gate itself to work.

## RevenueCat dashboard checklist

1. Create or open the RevenueCat project for Lou Knows LLC / Nevermore.
2. Add the iOS app with bundle ID:

```text
com.nevermore.app
```

3. Add the Android app with package ID:

```text
com.nevermoreapp
```

4. Create/import two subscription products:

```text
monthly
yearly
```

5. Create an entitlement:

```text
Lou Knows LLC Pro
```

6. Attach both products (`monthly`, `yearly`) to the `Lou Knows LLC Pro` entitlement.
7. Create an offering and mark it as the current/default offering.
8. Add a Monthly package mapped to the `monthly` product.
9. Add an Annual/Yearly package mapped to the `yearly` product.
10. Create and attach a RevenueCat Paywall to the current offering.
11. Optional: configure Customer Center in RevenueCat if the account plan supports it.

## App integration points

- `src/services/iap.service.ts` initializes RevenueCat, fetches offerings, checks entitlements, purchases packages, restores purchases, presents the RevenueCat paywall, and opens Customer Center.
- `src/store/subscriptionStore.ts` exposes subscription state to the app and syncs RevenueCat status back to Appwrite user profiles.
- `src/components/SubscriptionPopup.tsx` opens the hosted RevenueCat paywall.
- `src/navigation/screens/Subscription.tsx` opens the hosted RevenueCat paywall and shows Customer Center for active subscribers.
- `src/App.tsx` initializes RevenueCat and registers a customer info listener.

## Testing notes

- Test Store keys are for development/testing only and should not be submitted to the App Store or Google Play.
- Production builds must use the RevenueCat public app key for the real Apple/Google store app.
- Always confirm the RevenueCat customer profile shows the same Appwrite user ID as the app user ID.
- A successful purchase must activate the `Lou Knows LLC Pro` entitlement.
- A restore should only unlock access when RevenueCat reports the entitlement as active.
