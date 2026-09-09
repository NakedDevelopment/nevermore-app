import { useMemo } from 'react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useSharedAccessStore } from '../store/sharedAccessStore';
import { useAdminAccessStore } from '../store/adminAccessStore';
import { useTrialStore } from '../store/trialStore';

export function useHasFullAccess(): boolean {
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const isAdminAccessActive = useAdminAccessStore((s) => s.isAdminAccessActive);
  const trialStartDate = useTrialStore((s) => s.trialStartDate);

  return useMemo(() => {
    return isSubscribed || isSharedAccessActive || isAdminAccessActive || useTrialStore.getState().isTrialActive();
  }, [isSubscribed, isSharedAccessActive, isAdminAccessActive, trialStartDate]);
}
