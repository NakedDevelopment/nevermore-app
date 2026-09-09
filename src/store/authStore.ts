import { create } from 'zustand';
import { Models } from 'react-native-appwrite';
import * as authService from '../services/auth.service';
import { useBookmarkStore } from './bookmarkStore';
import { useFortyDayStore } from './fortyDayStore';
import { useOnboardingStore } from './onboardingStore';
import { useTrialStore, syncTrialFromUserProfile } from './trialStore';
import { useSharedAccessStore } from './sharedAccessStore';
import { useSubscriptionStore } from './subscriptionStore';
import { ScreenNames } from '../constants/ScreenNames';
import { usePendingInviteStore } from './pendingInvite.store';
import { invitationService } from '../services/invitation.service';
import { showSuccessNotification } from '../services/notifications';

// Redeems an invite code the user typed into RedeemInviteCode before they had
// an account. Accepting an invitation needs an authenticated session either
// way, so this runs right after sign-up/sign-in rather than at code-entry
// time. Non-fatal on failure — a bad/expired code shouldn't block a normal
// sign-up or sign-in.
async function redeemPendingInviteIfAny(userId: string): Promise<void> {
  const code = usePendingInviteStore.getState().code;
  if (!code) {
    return;
  }
  try {
    await invitationService.acceptInvitation(code, userId);
    showSuccessNotification(
      "You've successfully joined their Nevermore support circle.",
      'Invitation Accepted'
    );
  } catch {
    // Swallow — invitation may have been used/expired since it was checked.
  } finally {
    usePendingInviteStore.getState().clear();
  }
}

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  signUp: (email: string, password: string, name?: string, nickname?: string, type?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  sendPasswordRecovery: (email: string) => Promise<void>;
  sendMagicURLLogin: (email: string) => Promise<void>;
  createMagicURLSession: (userId: string, secret: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  signUp: async (email: string, password: string, name?: string, nickname?: string, type?: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.signUp({ email, password, name, nickname, type });
      // Set onboarding step immediately when user signs up
      // This ensures new users start onboarding
      useOnboardingStore.getState().setCurrentStep(ScreenNames.PERMISSION);
      await syncTrialFromUserProfile(user.$id);
      await redeemPendingInviteIfAny(user.$id);
      await useSharedAccessStore.getState().refreshSharedAccess();
      await useBookmarkStore.getState().hydrateFromBackend();
      await useFortyDayStore.getState().hydrateProgressFromBackend();
      await useSubscriptionStore.getState().checkSubscription();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to sign up',
        isLoading: false,
        isAuthenticated: false
      });
      throw error;
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.signIn(email, password);
      const user = await authService.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user after sign in');
      }
      await syncTrialFromUserProfile(user.$id, { backfillTrialIfMissing: true });
      await redeemPendingInviteIfAny(user.$id);
      await useSharedAccessStore.getState().refreshSharedAccess();
      await useBookmarkStore.getState().hydrateFromBackend();
      await useFortyDayStore.getState().hydrateProgressFromBackend();
      await useSubscriptionStore.getState().checkSubscription();
      // Mark onboarding as complete for existing users who sign in
      useOnboardingStore.getState().completeOnboarding();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to sign in',
        isLoading: false,
        isAuthenticated: false
      });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      await import('../contexts/AudioPlayerProvider').then(({ stopAllAudioPlayback }) => stopAllAudioPlayback());
      await authService.signOut();
      await import('../services/iap.service').then(({ iapService }) => iapService.logOut());

      // Clear onboarding state on sign out
      useOnboardingStore.getState().resetOnboarding();
      useTrialStore.getState().resetTrial();
      useSharedAccessStore.getState().clearSharedAccess();
      useSubscriptionStore.getState().resetSubscriptionState();

      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error: any) {
      await import('../contexts/AudioPlayerProvider').then(({ stopAllAudioPlayback }) => stopAllAudioPlayback());
      useSharedAccessStore.getState().clearSharedAccess();
      set({
        error: error.message || 'Failed to sign out',
        isLoading: false
      });
      set({ user: null, isAuthenticated: false });
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await import('../contexts/AudioPlayerProvider').then(({ stopAllAudioPlayback }) => stopAllAudioPlayback());
      await authService.deleteAccount();
      await import('../services/iap.service').then(({ iapService }) => iapService.logOut());

      useBookmarkStore.getState().clearBookmarks();
      useFortyDayStore.getState().clearProgress();
      useOnboardingStore.getState().resetOnboarding();
      useTrialStore.getState().resetTrial();
      useSharedAccessStore.getState().clearSharedAccess();
      useSubscriptionStore.getState().resetSubscriptionState();

      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete account',
        isLoading: false
      });
      throw error;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        await syncTrialFromUserProfile(user.$id, { backfillTrialIfMissing: true });
        await useSharedAccessStore.getState().refreshSharedAccess();
        await useBookmarkStore.getState().hydrateFromBackend();
        await useFortyDayStore.getState().hydrateProgressFromBackend();
        await useSubscriptionStore.getState().checkSubscription();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        await import('../contexts/AudioPlayerProvider').then(({ stopAllAudioPlayback }) => stopAllAudioPlayback());
        useSharedAccessStore.getState().clearSharedAccess();
        useSubscriptionStore.getState().resetSubscriptionState();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      await import('../contexts/AudioPlayerProvider').then(({ stopAllAudioPlayback }) => stopAllAudioPlayback());
      useSubscriptionStore.getState().resetSubscriptionState();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  sendPasswordRecovery: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.createPasswordRecovery(email);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to send recovery email',
        isLoading: false
      });
      throw error;
    }
  },

  sendMagicURLLogin: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.createMagicURLToken(email);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to send magic URL email',
        isLoading: false
      });
      throw error;
    }
  },

  createMagicURLSession: async (userId: string, secret: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.createMagicURLSession(userId, secret);
      const user = await authService.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user after magic URL session');
      }
      await syncTrialFromUserProfile(user.$id, { backfillTrialIfMissing: true });
      await redeemPendingInviteIfAny(user.$id);
      await useSharedAccessStore.getState().refreshSharedAccess();
      await useBookmarkStore.getState().hydrateFromBackend();
      await useFortyDayStore.getState().hydrateProgressFromBackend();
      await useSubscriptionStore.getState().checkSubscription();
      // Mark onboarding as complete for magic URL login (existing users)
      useOnboardingStore.getState().completeOnboarding();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create session',
        isLoading: false,
        isAuthenticated: false
      });
      throw error;
    }
  },
}));
