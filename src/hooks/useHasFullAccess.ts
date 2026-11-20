import { useMemo } from 'react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useSharedAccessStore } from '../store/sharedAccessStore';
import { useAdminAccessStore } from '../store/adminAccessStore';
import { hasFullSubscriptionAccess } from '../utils/subscriptionAccess';

export function useHasFullAccess(): boolean {
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const isSharedAccessActive = useSharedAccessStore((s) => s.isSharedAccessActive);
  const isAdminAccessActive = useAdminAccessStore((s) => s.isAdminAccessActive);

  return useMemo(
    () =>
      hasFullSubscriptionAccess({
        isSubscribed,
        isSharedAccessActive,
        isAdminAccessActive,
      }),
    [isSubscribed, isSharedAccessActive, isAdminAccessActive]
  );
}
