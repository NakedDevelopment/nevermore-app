import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RestorePurchaseStatus, SubscriptionPlan, SubscriptionProducts } from '../services/iap.service';

async function syncCurrentUserSubscriptionStatus(isSubscribed: boolean): Promise<void> {
  try {
    const [{ getCurrentUser }, { userProfileService }] = await Promise.all([
      import('../services/auth.service'),
      import('../services/userProfile.service'),
    ]);
    const user = await getCurrentUser();
    if (user) {
      await userProfileService.syncSubscriptionStatus(user.$id, isSubscribed);
    }
  } catch {
    // Subscription access should not be blocked by profile sync failures.
  }
}

interface SubscriptionState {
  isSubscribed: boolean;
  activePlan: SubscriptionPlan | null;
  isLoading: boolean;
  error: string | null;
  products: SubscriptionProducts;
  productsLoading: boolean;
  setSubscribed: (value: boolean) => void;
  checkSubscription: () => Promise<void>;
  loadProducts: () => Promise<void>;
  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  presentPaywall: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  getRestorePurchaseStatus: () => Promise<RestorePurchaseStatus>;
  resetSubscriptionState: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      isSubscribed: false,
      activePlan: null,
      isLoading: false,
      error: null,
      products: { monthly: null, yearly: null },
      productsLoading: false,

      loadProducts: async () => {
        const { iapService } = await import('../services/iap.service');
        set({ productsLoading: true });
        try {
          const products = await iapService.fetchSubscriptionProducts();
          set({ products, productsLoading: false });
        } catch (err) {
          console.warn('loadProducts failed:', err);
          set({ productsLoading: false });
        }
      },

      setSubscribed: (value: boolean) => {
        set({ isSubscribed: value, activePlan: value ? get().activePlan : null, error: null });
        syncCurrentUserSubscriptionStatus(value);
      },

      resetSubscriptionState: () => {
        set({ isSubscribed: false, activePlan: null, isLoading: false, error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      checkSubscription: async () => {
        const { iapService } = await import('../services/iap.service');
        set({ isLoading: true, error: null });
        try {
          const { getCurrentUser } = await import('../services/auth.service');
          const user = await getCurrentUser();
          if (!user) {
            set({ isSubscribed: false, activePlan: null, isLoading: false, error: null });
            return;
          }

          await iapService.identifyUser(user.$id, user.email, user.name);
          const [isSubscribed, activePlan] = await Promise.all([
            iapService.checkSubscription(),
            iapService.getActiveSubscriptionPlan(),
          ]);
          set({
            isSubscribed,
            activePlan: isSubscribed ? activePlan : null,
            isLoading: false,
            error: null,
          });
          syncCurrentUserSubscriptionStatus(isSubscribed);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to check subscription';
          set({ isLoading: false, error: message });
        }
      },

      purchaseSubscription: async (productId: string): Promise<boolean> => {
        const { iapService } = await import('../services/iap.service');
        set({ isLoading: true, error: null });
        try {
          const success = await iapService.purchaseSubscription(productId);
          if (success) {
            const { monthly, yearly } = await import('../services/iap.service').then((m) => m.getIAPProductIds());
            const activePlan = productId === yearly ? 'yearly' : productId === monthly ? 'monthly' : null;
            set({ isSubscribed: true, activePlan, isLoading: false, error: null });
            syncCurrentUserSubscriptionStatus(true);
          } else {
            set({ isLoading: false });
          }
          return success;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Purchase failed';
          set({ isLoading: false, error: message });
          return false;
        }
      },

      restorePurchases: async (): Promise<boolean> => {
        const { iapService } = await import('../services/iap.service');
        set({ isLoading: true, error: null });
        try {
          const success = await iapService.restorePurchases();
          if (success) {
            const activePlan = await iapService.getActiveSubscriptionPlan();
            set({ isSubscribed: true, activePlan, isLoading: false, error: null });
            syncCurrentUserSubscriptionStatus(true);
          } else {
            set({ isLoading: false });
          }
          return success;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Restore failed';
          set({ isLoading: false, error: message });
          return false;
        }
      },

      presentPaywall: async (): Promise<boolean> => {
        const { iapService } = await import('../services/iap.service');
        set({ isLoading: true, error: null });
        try {
          const success = await iapService.presentPaywall();
          const activePlan = success ? await iapService.getActiveSubscriptionPlan() : null;
          set({
            isSubscribed: success,
            activePlan,
            isLoading: false,
            error: null,
          });
          syncCurrentUserSubscriptionStatus(success);
          return success;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to present paywall';
          set({ isLoading: false, error: message });
          return false;
        }
      },

      presentCustomerCenter: async (): Promise<void> => {
        const { iapService } = await import('../services/iap.service');
        set({ isLoading: true, error: null });
        try {
          await iapService.presentCustomerCenter();
          const [isSubscribed, activePlan] = await Promise.all([
            iapService.checkSubscription(),
            iapService.getActiveSubscriptionPlan(),
          ]);
          set({
            isSubscribed,
            activePlan: isSubscribed ? activePlan : null,
            isLoading: false,
            error: null,
          });
          syncCurrentUserSubscriptionStatus(isSubscribed);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unable to open subscription center';
          set({ isLoading: false, error: message });
        }
      },

      getRestorePurchaseStatus: async (): Promise<RestorePurchaseStatus> => {
        const { iapService } = await import('../services/iap.service');
        return iapService.getRestorePurchaseStatus();
      },
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ isSubscribed: state.isSubscribed, activePlan: state.activePlan }),
    }
  )
);
