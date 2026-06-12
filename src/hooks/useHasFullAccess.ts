import { useMemo } from 'react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useSharedAccessStore } from '../store/sharedAccessStore';
import { useTrialStore } from '../store/trialStore';

export function useHasFullAccess(): boolean {
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const trialStartDate = useTrialStore((s) => s.trialStartDate);

  return useMemo(() => {
    return isSubscribed || isSharedAccessActive || useTrialStore.getState().isTrialActive();
  }, [isSubscribed, isSharedAccessActive, trialStartDate]);
}
