export type SubscriptionAccessInput = {
  isSubscribed: boolean;
  isSharedAccessActive: boolean;
  isAdminAccessActive: boolean;
};

/** Full app access requires an active store subscription (incl. intro trial), shared access, or admin access. */
export function hasFullSubscriptionAccess(input: SubscriptionAccessInput): boolean {
  return input.isSubscribed || input.isSharedAccessActive || input.isAdminAccessActive;
}

/** After onboarding, users without paid/shared access should see the trial-ended / subscribe gate. */
export function shouldShowPostOnboardingPaywallGate(input: {
  isOnboardingComplete: boolean;
  isSubscribed: boolean;
  isSharedAccessActive: boolean;
}): boolean {
  return (
    input.isOnboardingComplete &&
    !input.isSubscribed &&
    !input.isSharedAccessActive
  );
}