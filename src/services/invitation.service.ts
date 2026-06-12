import { ID, Models, Query } from 'react-native-appwrite';
import { tablesDB, account } from './appwrite.config';
import { APPWRITE_DATABASE_ID, APPWRITE_INVITATIONS_COLLECTION_ID } from '@env';
import { isUnauthorizedError } from './errorHandler';
import { showAppwriteError } from './notifications';
import { userProfileService } from './userProfile.service';
import { Platform } from 'react-native';

async function getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
  try {
    return await account.get();
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return null;
    }
    return null;
  }
}

export interface Invitation {
  $id?: string;
  inviterId: string;
  inviterProfileId?: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'upgraded';
  invitationToken: string;
  deepLink: string;
  inviteeId?: string;
  acceptedAt?: string;
  revokedAt?: string;
  upgradedAt?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface CreateInvitationParams {
  email: string;
  inviterProfileId?: string;
}

export interface CreateInvitationResult {
  invitation: Invitation;
}

export interface AcceptInvitationParams {
  userId: string;
  secret: string;
  token: string;
}

class InvitationService {
  isActiveInvite(status: Invitation['status']): boolean {
    return status === 'pending' || status === 'accepted';
  }

  isSharedAccessInvite(status: Invitation['status']): boolean {
    return status === 'accepted';
  }

  private validateConfig(): void {
    if (!APPWRITE_DATABASE_ID) {
      throw new Error(
        'APPWRITE_DATABASE_ID is not configured. Please check your .env file.'
      );
    }
    if (!APPWRITE_INVITATIONS_COLLECTION_ID) {
      throw new Error(
        'APPWRITE_INVITATIONS_COLLECTION_ID is not configured. Please check your .env file.'
      );
    }
  }

  async createInvitation({
    email,
    inviterProfileId,
  }: CreateInvitationParams): Promise<CreateInvitationResult> {
    try {
      this.validateConfig();

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to send invitations');
      }

      const myInvitations = await this.getMyInvitations();
      const activeCount = myInvitations.filter(inv => this.isActiveInvite(inv.status)).length;
      if (activeCount >= 2) {
        throw new Error('You can only have up to 2 active invites. Please wait for one to be accepted or remove an existing invite.');
      }

      const invitationToken = ID.unique();

      const deepLink = `https://nevermore-admin-app-seven.vercel.app/invite?token=${invitationToken}`;
      
      const invitation = await tablesDB.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          inviterId: currentUser.$id,
          inviterProfileId: inviterProfileId || '',
          email,
          status: 'pending',
          invitationToken,
          deepLink,
        },
      });

      try {
        await account.createMagicURLToken({
          userId: ID.unique(),
          email,
          url: deepLink,
        });
      } catch (magicUrlError: any) {
        try {
          await tablesDB.deleteRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
            rowId: invitation.$id,
          });
        } catch {
          // If cleanup fails, the pending invite can still be removed from Manage Invites.
        }
        throw new Error(`Failed to create invitation: ${magicUrlError?.message || 'Unknown error'}`);
      }

      return {
        invitation: invitation as unknown as Invitation,
      };
    } catch (error: any) {
      if (error.message?.includes('not authorized') || error.code === 401) {
        throw new Error(
          'Permission denied: Please configure collection permissions in Appwrite. ' +
          'Go to your collection Settings → Permissions and add "Users" role with Create, Read, and Update permissions.'
        );
      }
      
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to create invitation');
    }
  }

  async getInvitationByToken(token: string): Promise<Invitation | null> {
    try {
      this.validateConfig();

      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        queries: [Query.equal('invitationToken', token)],
      });

      if (response.rows.length > 0) {
        const invitation = response.rows[0] as unknown as Invitation;
        return invitation;
      }

      return null;
    } catch (error: any) {
      return null;
    }
  }

  async getMyInvitations(): Promise<Invitation[]> {
    try {
      this.validateConfig();

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User must be authenticated to view invitations');
      }

      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        queries: [
          Query.equal('inviterId', currentUser.$id),
          Query.orderDesc('$createdAt'),
        ],
      });

      const invitations = response.rows as unknown as Invitation[];

      return invitations;
    } catch (error: any) {
      return [];
    }
  }

  async getPendingInvitationByEmail(email: string): Promise<Invitation | null> {
    try {
      this.validateConfig();

      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        queries: [
          Query.equal('email', email),
          Query.equal('status', 'pending'),
        ],
      });

      if (response.rows.length > 0) {
        const invitation = response.rows[0] as unknown as Invitation;
        return invitation;
      }

      return null;
    } catch (error: any) {
      return null;
    }
  }

  async resendInvitation(invitation: Invitation): Promise<Invitation> {
    try {
      this.validateConfig();

      if (!invitation.$id) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Only pending invitations can be resent.');
      }

      const invitationToken = ID.unique();
      const deepLink = `https://nevermore-admin-app-seven.vercel.app/invite?token=${invitationToken}`;

      try {
        await account.createMagicURLToken({
          userId: ID.unique(),
          email: invitation.email,
          url: deepLink,
        });
      } catch (magicUrlError: any) {
        throw new Error(`Failed to resend invitation: ${magicUrlError?.message || 'Unknown error'}`);
      }

      const updatedInvitation = await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: invitation.$id,
        data: {
          status: 'pending',
          invitationToken,
          deepLink,
        },
      });

      return updatedInvitation as unknown as Invitation;
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to resend invitation');
    }
  }

  async acceptInvitationByEmail(email: string): Promise<Invitation | null> {
    try {
      this.validateConfig();

      const invitation = await this.getPendingInvitationByEmail(email);
      if (!invitation || !invitation.$id) {
        return null;
      }

      const updatedInvitation = await this.updateInvitationWithFallback(
        invitation.$id,
        {
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
        },
        {
          status: 'accepted',
        }
      );

      return updatedInvitation as unknown as Invitation;
    } catch (error: any) {
      // Silently fail - invitation acceptance shouldn't block sign-in
      return null;
    }
  }

  async acceptInvitationRecord(invitation: Invitation, inviteeId?: string): Promise<Invitation> {
    try {
      this.validateConfig();

      if (!invitation.$id) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error(`Invitation has already been ${invitation.status}`);
      }

      const data: Partial<Invitation> = {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      };
      if (inviteeId) {
        data.inviteeId = inviteeId;
      }

      const updatedInvitation = await this.updateInvitationWithFallback(
        invitation.$id,
        data,
        {
          status: 'accepted',
        }
      );

      return updatedInvitation as unknown as Invitation;
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to accept invitation');
    }
  }

  async acceptInvitation(token: string, inviteeId?: string): Promise<Invitation> {
    try {
      this.validateConfig();

      const invitation = await this.getInvitationByToken(token);
      if (!invitation || !invitation.$id) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error(`Invitation has already been ${invitation.status}`);
      }

      return await this.acceptInvitationRecord(invitation, inviteeId);
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to accept invitation');
    }
  }

  async expireInvitation(invitationId: string): Promise<void> {
    try {
      this.validateConfig();

      await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: invitationId,
        data: {
          status: 'expired',
        },
      });
    } catch (error: any) {
    }
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    try {
      this.validateConfig();

      try {
        await this.updateInvitationWithFallback(
          invitationId,
          {
            status: 'revoked',
            revokedAt: new Date().toISOString(),
          },
          {
            status: 'expired',
          }
        );
      } catch {
        await this.deleteInvitation(invitationId);
      }
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to revoke invitation');
    }
  }

  async markInvitationUpgraded(invitationId: string): Promise<void> {
    try {
      this.validateConfig();

      try {
        await this.updateInvitationWithFallback(
          invitationId,
          {
            status: 'upgraded',
            upgradedAt: new Date().toISOString(),
          },
          null
        );
      } catch {
        await this.deleteInvitation(invitationId);
      }
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to update shared access');
    }
  }

  async getActiveSharedInvitationForCurrentUser(): Promise<Invitation | null> {
    try {
      this.validateConfig();

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return null;
      }

      if (currentUser.$id) {
        const byInviteeId = await this.findAcceptedInvitation([
          Query.equal('inviteeId', currentUser.$id),
          Query.equal('status', 'accepted'),
        ]);
        if (byInviteeId && await this.inviterCanShareAccess(byInviteeId)) {
          return byInviteeId;
        }
      }

      if (currentUser.email) {
        const byEmail = await this.findAcceptedInvitation([
          Query.equal('email', currentUser.email),
          Query.equal('status', 'accepted'),
        ]);
        if (byEmail && await this.inviterCanShareAccess(byEmail)) {
          return byEmail;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async findAcceptedInvitation(queries: string[]): Promise<Invitation | null> {
    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        queries,
      });

      if (response.rows.length === 0) {
        return null;
      }

      const invitation = response.rows[0] as unknown as Invitation;
      return this.isSharedAccessInvite(invitation.status) ? invitation : null;
    } catch {
      return null;
    }
  }

  private async inviterCanShareAccess(invitation: Invitation): Promise<boolean> {
    try {
      const inviterProfile = await userProfileService.getUserProfileByAuthId(invitation.inviterId);
      if (!inviterProfile) {
        return true;
      }

      if (inviterProfile.subscription_status === 'inactive') {
        return false;
      }

      return true;
    } catch {
      return true;
    }
  }

  private async updateInvitationWithFallback(
    invitationId: string,
    data: Partial<Invitation>,
    fallbackData: Partial<Invitation> | null
  ): Promise<Models.Document> {
    try {
      return await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: invitationId,
        data,
      }) as unknown as Models.Document;
    } catch (error) {
      if (!fallbackData) {
        throw error;
      }

      return await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: invitationId,
        data: fallbackData,
      }) as unknown as Models.Document;
    }
  }

  async deleteInvitation(invitationId: string): Promise<void> {
    try {
      this.validateConfig();

      await tablesDB.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: invitationId,
      });
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to delete invitation');
    }
  }
}

export const invitationService = new InvitationService();

