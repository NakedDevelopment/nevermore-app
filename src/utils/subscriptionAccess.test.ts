import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasFullSubscriptionAccess,
  shouldShowPostOnboardingPaywallGate,
} from './subscriptionAccess';

describe('hasFullSubscriptionAccess', () => {
  it('grants access for active subscription', () => {
    assert.equal(
      hasFullSubscriptionAccess({
        isSubscribed: true,
        isSharedAccessActive: false,
        isAdminAccessActive: false,
      }),
      true
    );
  });

  it('grants access for shared or admin access without subscription', () => {
    assert.equal(
      hasFullSubscriptionAccess({
        isSubscribed: false,
        isSharedAccessActive: true,
        isAdminAccessActive: false,
      }),
      true
    );
    assert.equal(
      hasFullSubscriptionAccess({
        isSubscribed: false,
        isSharedAccessActive: false,
        isAdminAccessActive: true,
      }),
      true
    );
  });

  it('denies access when no subscription paths are active', () => {
    assert.equal(
      hasFullSubscriptionAccess({
        isSubscribed: false,
        isSharedAccessActive: false,
        isAdminAccessActive: false,
      }),
      false
    );
  });
});

describe('shouldShowPostOnboardingPaywallGate', () => {
  it('shows gate when onboarding is done but user has no access', () => {
    assert.equal(
      shouldShowPostOnboardingPaywallGate({
        isOnboardingComplete: true,
        isSubscribed: false,
        isSharedAccessActive: false,
        isAdminAccessActive: false,
      }),
      true
    );
  });

  it('does not show gate during onboarding or when subscribed', () => {
    assert.equal(
      shouldShowPostOnboardingPaywallGate({
        isOnboardingComplete: false,
        isSubscribed: false,
        isSharedAccessActive: false,
        isAdminAccessActive: false,
      }),
      false
    );
    assert.equal(
      shouldShowPostOnboardingPaywallGate({
        isOnboardingComplete: true,
        isSubscribed: true,
        isSharedAccessActive: false,
        isAdminAccessActive: false,
      }),
      false
    );
    assert.equal(
      shouldShowPostOnboardingPaywallGate({
        isOnboardingComplete: true,
        isSubscribed: false,
        isSharedAccessActive: true,
        isAdminAccessActive: false,
      }),
      false
    );
    assert.equal(
      shouldShowPostOnboardingPaywallGate({
        isOnboardingComplete: true,
        isSubscribed: false,
        isSharedAccessActive: false,
        isAdminAccessActive: true,
      }),
      false
    );
  });
});