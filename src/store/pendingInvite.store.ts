import { create } from 'zustand';

// Holds an invite code the user typed in manually (via RedeemInviteCode) before
// they had an account. Redeemed automatically right after the following
// sign-up or sign-in completes, then cleared — see authStore.
interface PendingInviteState {
  code: string | null;
  setCode: (code: string) => void;
  clear: () => void;
}

export const usePendingInviteStore = create<PendingInviteState>((set) => ({
  code: null,
  setCode: (code) => set({ code }),
  clear: () => set({ code: null }),
}));
