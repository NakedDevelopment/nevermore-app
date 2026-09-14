import { ID, Models, Query } from 'react-native-appwrite';
import { tablesDB, account, functions } from './appwrite.config';
import appwriteConfig from './appwrite.config';
import { APPWRITE_DATABASE_ID, APPWRITE_INVITATIONS_COLLECTION_ID } from '@env';
import { isUnauthorizedError } from './errorHandler';
import { showAppwriteError } from './notifications';
import { userProfileService } from './userProfile.service';
import { Platform } from 'react-native';
import { buildInviteLink } from '../constants/deepLinks';

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

// Characters chosen to avoid visual ambiguity when a recipient types the code
// by hand (no 0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_SEGMENT_LENGTH = 6;
const CODE_VALIDITY_DAYS = 30;

function generateInvitationCode(): string {
  let segment = '';
  for (let i = 0; i < CODE_SEGMENT_LENGTH; i++) {
    segment += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `NM-${segment}`;
}

export type InvitationValidationReason =
  | 'not_found'
  | 'expired'
  | 'accepted'
  | 'revoked'
  | 'invalid';

export type InvitationValidationResult =
  | { ok: true; invitation: Invitation }
  | { ok: false; reason: InvitationValidationReason };

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
  expiresAt?: string;
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

  private async sendInvitationEmail(email: string, inviteCode: string): Promise<void> {
    if (!appwriteConfig.invitationFunctionId) {
      throw new Error(
        'APPWRITE_INVITATION_FUNCTION_ID is not configured. Please check your .env file.'
      );
    }

    const execution = await functions.createExecution({
      functionId: appwriteConfig.invitationFunctionId,
      body: JSON.stringify({ email, inviteCode }),
      async: false,
    });

    let result: { success?: boolean; message?: string } = {};
    try {
      result = execution.responseBody ? JSON.parse(execution.responseBody) : {};
    } catch {
      // Fall through to the generic error below.
    }

    if (execution.responseStatusCode >= 400 || !result.success) {
      throw new Error(result.message || 'Failed to send invitation email');
    }
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

  // 32^6 possible codes makes a collision astronomically unlikely, but a
  // paying subscriber's invite shouldn't ever silently fail over one, so we
  // check.
  private async generateUniqueInvitationCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInvitationCode();
      const existing = await this.getInvitationByToken(code);
      if (!existing) {
        return code;
      }
    }
    throw new Error('Failed to generate a unique invitation code. Please try again.');
  }

  // `expiresAt` requires a matching attribute on the invitations collection.
  // Older environments that haven't added it yet still get a working
  // (non-expiring) invitation instead of a hard failure.
  private async createInvitationRow(data: {
    rowId: string;
    inviterId: string;
    inviterProfileId: string;
    email: string;
    status: Invitation['status'];
    invitationToken: string;
    deepLink: string;
    expiresAt: string;
  }): Promise<Models.Document> {
    const { rowId, expiresAt, ...rest } = data;
    try {
      return await tablesDB.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId,
        data: { ...rest, expiresAt } as Record<string, unknown>,
      }) as unknown as Models.Document;
    } catch {
      return await tablesDB.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
        rowId,
        data: rest as Record<string, unknown>,
      }) as unknown as Models.Document;
    }
  }

  private isExpired(invitation: Invitation): boolean {
    if (!invitation.expiresAt) {
      return false;
    }
    return new Date(invitation.expiresAt).getTime() < Date.now();
  }

  // Central place to classify a code the user typed in, so every entry point
  // (RedeemInviteCode, auto-redeem after sign-up/sign-in) shows the same
  // reason instead of a generic failure.
  async validateInvitationCode(rawCode: string): Promise<InvitationValidationResult> {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { ok: false, reason: 'invalid' };
    }

    const invitation = await this.getInvitationByToken(code);
    if (!invitation) {
      return { ok: false, reason: 'not_found' };
    }

    if (invitation.status === 'revoked') {
      return { ok: false, reason: 'revoked' };
    }

    if (invitation.status === 'accepted' || invitation.status === 'upgraded') {
      return { ok: false, reason: 'accepted' };
    }

    if (invitation.status === 'expired' || this.isExpired(invitation)) {
      if (invitation.status !== 'expired') {
        await this.expireInvitation(invitation.$id!);
      }
      return { ok: false, reason: 'expired' };
    }

    return { ok: true, invitation };
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

      const invitationToken = await this.generateUniqueInvitationCode();
      const deepLink = buildInviteLink(invitationToken);
      const expiresAt = new Date(Date.now() + CODE_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const invitation = await this.createInvitationRow({
        rowId: ID.unique(),
        inviterId: currentUser.$id,
        inviterProfileId: inviterProfileId || '',
        email,
        status: 'pending',
        invitationToken,
        deepLink,
        expiresAt,
      });

      try {
        await this.sendInvitationEmail(email, invitationToken);
      } catch (sendError: any) {
        try {
          await tablesDB.deleteRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_INVITATIONS_COLLECTION_ID,
            rowId: invitation.$id,
          });
        } catch {
          // If cleanup fails, the pending invite can still be removed from Manage Invites.
        }
        throw new Error(`Failed to create invitation: ${sendError?.message || 'Unknown error'}`);
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

  async resendInvitation(invitation: Invitation): Promise<Invitation> {
    try {
      this.validateConfig();

      if (!invitation.$id) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Only pending invitations can be resent.');
      }

      const invitationToken = await this.generateUniqueInvitationCode();
      const deepLink = buildInviteLink(invitationToken);
      const expiresAt = new Date(Date.now() + CODE_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

      try {
        await this.sendInvitationEmail(invitation.email, invitationToken);
      } catch (sendError: any) {
        throw new Error(`Failed to resend invitation: ${sendError?.message || 'Unknown error'}`);
      }

      const updatedInvitation = await this.updateInvitationWithFallback(
        invitation.$id,
        {
          status: 'pending',
          invitationToken,
          deepLink,
          expiresAt,
        },
        {
          status: 'pending',
          invitationToken,
          deepLink,
        }
      );

      return updatedInvitation as unknown as Invitation;
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to resend invitation');
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

      const result = await this.validateInvitationCode(token);
      if (!result.ok) {
        throw new Error(`Invitation is ${result.reason.replace('_', ' ')}`);
      }

      return await this.acceptInvitationRecord(result.invitation, inviteeId);
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

