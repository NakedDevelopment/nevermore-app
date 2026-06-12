import { create } from 'zustand';
import { invitationService, Invitation } from '../services/invitation.service';
import { userProfileService } from '../services/userProfile.service';

type SharedAccessStatus = 'none' | 'active' | 'revoked' | 'upgraded';

interface SharedAccessState {
  isSharedAccessActive: boolean;
  status: SharedAccessStatus;
  invitation: Invitation | null;
  inviterName: string | null;
  isLoading: boolean;
  refreshSharedAccess: () => Promise<void>;
  markSharedAccessUpgraded: () => Promise<void>;
  clearSharedAccess: () => void;
}

export const useSharedAccessStore = create<SharedAccessState>((set, get) => ({
  isSharedAccessActive: false,
  status: 'none',
  invitation: null,
  inviterName: null,
  isLoading: false,

  refreshSharedAccess: async () => {
    set({ isLoading: true });
    try {
      const invitation = await invitationService.getActiveSharedInvitationForCurrentUser();
      if (invitation) {
        const inviterProfile = await userProfileService.getUserProfileByAuthId(invitation.inviterId);
        const inviterName = inviterProfile?.nickname?.trim()
          || inviterProfile?.full_name?.trim()
          || 'someone who cares about you';

        set({
          isSharedAccessActive: true,
          status: 'active',
          invitation,
          inviterName,
          isLoading: false,
        });
        return;
      }

      set({
        isSharedAccessActive: false,
        status: 'none',
        invitation: null,
        inviterName: null,
        isLoading: false,
      });
    } catch {
      set({
        isSharedAccessActive: false,
        status: 'none',
        invitation: null,
        inviterName: null,
        isLoading: false,
      });
    }
  },

  markSharedAccessUpgraded: async () => {
    const invitation = get().invitation;
    if (!invitation?.$id) {
      set({
        isSharedAccessActive: false,
        status: 'upgraded',
        invitation: null,
        inviterName: null,
      });
      return;
    }

    await invitationService.markInvitationUpgraded(invitation.$id);
    set({
      isSharedAccessActive: false,
      status: 'upgraded',
      invitation: null,
      inviterName: null,
    });
  },

  clearSharedAccess: () => {
    set({
      isSharedAccessActive: false,
      status: 'none',
      invitation: null,
      inviterName: null,
      isLoading: false,
    });
  },
}));
