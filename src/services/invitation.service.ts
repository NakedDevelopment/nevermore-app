import { ID, Models, Query } from 'react-native-appwrite';
import { tablesDB, account } from './appwrite.config';
import { APPWRITE_DATABASE_ID, APPWRITE_INVITATIONS_COLLECTION_ID } from '@env';
import { isUnauthorizedError } from './errorHandler';
import { showAppwriteError } from './notifications';
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
  status: 'pending' | 'accepted' | 'expired';
  invitationToken: string;
  deepLink: string;
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
      const pendingCount = myInvitations.filter(inv => inv.status === 'pending').length;
      if (pendingCount >= 2) {
        throw new Error('You can only have up to 2 pending invitations. Please wait for some to be accepted or remove existing ones.');
      }

      const invitationToken = ID.unique();

      const deepLink = `https://nevermore-admin-app.vercel.app/invite?token=${invitationToken}`;
      
      try {
        await account.createMagicURLToken({
          userId: ID.unique(),
          email,
          url: deepLink,
        });
      } catch (magicUrlError: any) {
        throw new Error(`Failed to create invitation: ${magicUrlError?.message || 'Unknown error'}`);
      }

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

  async acceptInvitationByEmail(email: string): Promise<Invitation | null> {
    try {
      this.validateConfig();

      const invitation = await this.getPendingInvitationByEmail(email);
      if (!invitation || !invitation.$id) {
        return null;
      }

      const updatedInvitation = await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: invitation.$id,
        data: {
          status: 'accepted',
        },
      });

      return updatedInvitation as unknown as Invitation;
    } catch (error: any) {
      // Silently fail - invitation acceptance shouldn't block sign-in
      return null;
    }
  }

  async acceptInvitation(token: string): Promise<Invitation> {
    try {
      this.validateConfig();

      const invitation = await this.getInvitationByToken(token);
      if (!invitation || !invitation.$id) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error(`Invitation has already been ${invitation.status}`);
      }

      const updatedInvitation = await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId: invitation.$id,
        data: {
          status: 'accepted',
        },
      });

      return updatedInvitation as unknown as Invitation;
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

