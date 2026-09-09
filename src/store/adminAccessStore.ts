import { create } from 'zustand';
import { accessCodeService, AccessCodeRedemption } from '../services/accessCode.service';

// Mirrors sharedAccessStore, but for access granted by an administrator-issued
// code (pilot/research/institutional/promo/bulk) rather than a subscriber's
// shared-subscription invitation. Kept as its own store since the two are
// unrelated grants that happen to compose the same way into useHasFullAccess.
interface AdminAccessState {
  isAdminAccessActive: boolean;
  redemption: AccessCodeRedemption | null;
  isLoading: boolean;
  refreshAdminAccess: () => Promise<void>;
  clearAdminAccess: () => void;
}

export const useAdminAccessStore = create<AdminAccessState>((set) => ({
  isAdminAccessActive: false,
  redemption: null,
  isLoading: false,

  refreshAdminAccess: async () => {
    set({ isLoading: true });
    try {
      const redemption = await accessCodeService.getActiveAccessForCurrentUser();
      set({
        isAdminAccessActive: !!redemption,
        redemption,
        isLoading: false,
      });
    } catch {
      set({ isAdminAccessActive: false, redemption: null, isLoading: false });
    }
  },

  clearAdminAccess: () => {
    set({ isAdminAccessActive: false, redemption: null, isLoading: false });
  },
}));
