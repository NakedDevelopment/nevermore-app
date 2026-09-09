import { Query } from 'react-native-appwrite';
import { tablesDB, account, functions } from './appwrite.config';
import appwriteConfig from './appwrite.config';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_ACCESS_CODES_COLLECTION_ID,
  APPWRITE_ACCESS_CODE_REDEMPTIONS_COLLECTION_ID,
} from '@env';
import { isUnauthorizedError } from './errorHandler';
import { showAppwriteError } from './notifications';

// Administrator-issued access codes (pilots, research, corporate/bulk
// licensing, promotions, complimentary access) — deliberately a separate
// collection from `invitations`. A subscriber's shared-subscription invite
// and an admin's access code both get typed into the same "Enter Invitation
// Code" screen, but they're tracked, configured, and reported on separately
// on the backend (see codeRedemption.service.ts for where they're unified).
export interface AccessCode {
  $id?: string;
  code: string;
  campaignName?: string;
  organizationName?: string;
  accessDurationDays: number; // 0 = access does not expire once granted
  maxRedemptions: number | null; // how many different people may redeem this code; null = unlimited
  redemptionCount: number;
  startDate?: string;
  expiresAt?: string; // when the CODE stops being redeemable (not the grantee's access window)
  isComplimentary?: boolean;
  discountPercent?: number;
  notes?: string;
  status: 'active' | 'inactive';
  createdBy?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface AccessCodeRedemption {
  $id?: string;
  codeId: string;
  code: string;
  userId: string;
  redeemedAt: string;
  accessExpiresAt?: string;
  status: 'active' | 'revoked';
}

export type AccessCodeValidationReason =
  | 'not_found'
  | 'expired'
  | 'redemption_limit'
  | 'inactive'
  | 'invalid';

export type AccessCodeValidationResult =
  | { ok: true; accessCode: AccessCode }
  | { ok: false; reason: AccessCodeValidationReason };

async function getCurrentUserId(): Promise<string | null> {
  try {
    const user = await account.get();
    return user.$id;
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return null;
    }
    return null;
  }
}

class AccessCodeService {
  private validateConfig(): void {
    if (!APPWRITE_DATABASE_ID) {
      throw new Error('APPWRITE_DATABASE_ID is not configured. Please check your .env file.');
    }
    if (!APPWRITE_ACCESS_CODES_COLLECTION_ID) {
      throw new Error('APPWRITE_ACCESS_CODES_COLLECTION_ID is not configured. Please check your .env file.');
    }
    if (!APPWRITE_ACCESS_CODE_REDEMPTIONS_COLLECTION_ID) {
      throw new Error('APPWRITE_ACCESS_CODE_REDEMPTIONS_COLLECTION_ID is not configured. Please check your .env file.');
    }
  }

  async getAccessCodeByCode(code: string): Promise<AccessCode | null> {
    try {
      this.validateConfig();

      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_ACCESS_CODES_COLLECTION_ID,
        queries: [Query.equal('code', code)],
      });

      if (response.rows.length > 0) {
        return response.rows[0] as unknown as AccessCode;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Central classification, mirroring invitationService.validateInvitationCode
  // so both code types produce the same shape of result for the redemption UI.
  async validateAccessCode(rawCode: string): Promise<AccessCodeValidationResult> {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { ok: false, reason: 'invalid' };
    }

    const accessCode = await this.getAccessCodeByCode(code);
    if (!accessCode) {
      return { ok: false, reason: 'not_found' };
    }

    if (accessCode.status === 'inactive') {
      return { ok: false, reason: 'inactive' };
    }

    const now = Date.now();
    if (accessCode.startDate && new Date(accessCode.startDate).getTime() > now) {
      return { ok: false, reason: 'inactive' };
    }
    if (accessCode.expiresAt && new Date(accessCode.expiresAt).getTime() < now) {
      return { ok: false, reason: 'expired' };
    }

    // maxRedemptions: null means unlimited (the server-side redemption
    // function treats it the same way — see functions/redeem-access-code).
    if (accessCode.maxRedemptions != null && accessCode.redemptionCount >= accessCode.maxRedemptions) {
      return { ok: false, reason: 'redemption_limit' };
    }

    return { ok: true, accessCode };
  }

  // Redemption runs server-side (see functions/redeem-access-code), not via
  // a direct client write. access_code_redemptions permits any authenticated
  // user to create a row (Appwrite can't restrict row *contents* at the
  // permission layer), and access_codes only allows writes from the `admin`
  // label — a plain client write could forge a redemption or couldn't bump
  // the redemption counter at all. The function validates, writes with an
  // API key, and grants the row read permission back to the caller (row
  // security is on for that collection). Caller identity comes from a
  // short-lived JWT rather than a client-supplied userId, so a user can't
  // redeem on someone else's behalf.
  async redeemAccessCode(rawCode: string): Promise<{ accessExpiresAt: string | null }> {
    try {
      if (!appwriteConfig.accessCodeRedemptionFunctionId) {
        throw new Error(
          'APPWRITE_ACCESS_CODE_REDEMPTION_FUNCTION_ID is not configured. Please check your .env file.'
        );
      }

      const { jwt } = await account.createJWT();

      const execution = await functions.createExecution({
        functionId: appwriteConfig.accessCodeRedemptionFunctionId,
        body: JSON.stringify({ code: rawCode.trim().toUpperCase(), jwt }),
        async: false,
      });

      let result: { success?: boolean; reason?: string; accessExpiresAt?: string | null; message?: string } = {};
      try {
        result = execution.responseBody ? JSON.parse(execution.responseBody) : {};
      } catch {
        // Fall through to the generic error below.
      }

      if (execution.responseStatusCode >= 400 || !result.success) {
        throw new Error(result.message || `Access code is ${(result.reason || 'invalid').replace('_', ' ')}`);
      }

      return { accessExpiresAt: result.accessExpiresAt ?? null };
    } catch (error: any) {
      showAppwriteError(error, { skipUnauthorized: true });
      throw new Error(error.message || 'Failed to redeem access code');
    }
  }

  // Powers adminAccessStore — is there a still-valid grant for this user?
  async getActiveAccessForCurrentUser(): Promise<AccessCodeRedemption | null> {
    try {
      this.validateConfig();

      const userId = await getCurrentUserId();
      if (!userId) {
        return null;
      }

      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_ACCESS_CODE_REDEMPTIONS_COLLECTION_ID,
        queries: [
          Query.equal('userId', userId),
          Query.equal('status', 'active'),
          Query.orderDesc('$createdAt'),
        ],
      });

      const redemptions = response.rows as unknown as AccessCodeRedemption[];
      const now = Date.now();
      return redemptions.find((r) => !r.accessExpiresAt || new Date(r.accessExpiresAt).getTime() > now) || null;
    } catch {
      return null;
    }
  }
}

export const accessCodeService = new AccessCodeService();
