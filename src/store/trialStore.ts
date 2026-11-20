import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { userProfileService } from '../services/userProfile.service';

/** @deprecated Local 72h trial is no longer used for access; the store manages the 3-day intro trial. */
const TRIAL_DURATION_MS = 72 * 60 * 60 * 1000;

interface TrialState {
  trialStartDate: string | null;
  /** Persists trial start to Appwrite and local store (idempotent). */
  startTrial: (authId: string) => Promise<void>;
  resetTrial: () => void;
  isTrialActive: () => boolean;
  isTrialExpired: () => boolean;
}

function isWithinTrialWindow(trialStartDate: string | null, nowMs: number): boolean {
  if (!trialStartDate) return false;
  const startMs = Date.parse(trialStartDate);
  if (!Number.isFinite(startMs)) return false;
  return nowMs - startMs < TRIAL_DURATION_MS;
}

export async function waitForTrialStoreHydration(): Promise<void> {
  if (useTrialStore.persist.hasHydrated()) return;
  return new Promise((resolve) => {
    const unsub = useTrialStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

type SyncTrialOptions = {
  /**
   * When true (login / session restore): if the profile exists but trial_started_at is null,
   * persist trial start as now on the server and locally.
   * Leave false for fresh sign-up so TrialWelcome can still own the first trial start.
   */
  backfillTrialIfMissing?: boolean;
};

/**
 * Loads trial_started_at from the user profile after local persist has rehydrated.
 * With backfillTrialIfMissing, missing server values are set from now (login/session flows).
 */
export async function syncTrialFromUserProfile(
  authId: string,
  options?: SyncTrialOptions
): Promise<void> {
  await waitForTrialStoreHydration();
  const backfill = options?.backfillTrialIfMissing ?? false;
  try {
    const profile = await userProfileService.getUserProfileByAuthId(authId);
    if (!profile?.$id) {
      return;
    }
    if (profile.trial_started_at) {
      useTrialStore.setState({ trialStartDate: profile.trial_started_at });
      return;
    }
    if (!backfill) {
      return;
    }
    const iso = await userProfileService.ensureTrialStarted(authId);
    if (iso) {
      useTrialStore.setState({ trialStartDate: iso });
    } else {
      useTrialStore.setState({ trialStartDate: new Date().toISOString() });
    }
  } catch (e) {
    console.error('syncTrialFromUserProfile error:', e);
  }
}

export const useTrialStore = create<TrialState>()(
  persist(
    (set, get) => ({
      trialStartDate: null,

      startTrial: async (authId: string) => {
        const { trialStartDate } = get();
        if (trialStartDate) return;

        let iso: string | null = null;
        try {
          iso = await userProfileService.ensureTrialStarted(authId);
        } catch (e) {
          console.error('startTrial ensureTrialStarted error:', e);
        }

        if (iso) {
          set({ trialStartDate: iso });
        } else {
          set({ trialStartDate: new Date().toISOString() });
        }
      },

      resetTrial: () => {
        set({ trialStartDate: null });
      },

      isTrialActive: () => {
        return isWithinTrialWindow(get().trialStartDate, Date.now());
      },

      isTrialExpired: () => {
        const { trialStartDate } = get();
        if (!trialStartDate) return false;
        return !isWithinTrialWindow(trialStartDate, Date.now());
      },
    }),
    {
      name: 'trial-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ trialStartDate: state.trialStartDate }),
    }
  )
);
