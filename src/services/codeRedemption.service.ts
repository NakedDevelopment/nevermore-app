import { functions } from './appwrite.config';
import appwriteConfig from './appwrite.config';
import { invitationService, InvitationValidationReason } from './invitation.service';
import { accessCodeService, AccessCodeValidationReason } from './accessCode.service';

// Single entry point for "Enter Invitation Code" — the recipient never knows
// (or needs to know) whether what they typed is a subscriber's shared-access
// invitation or an administrator-issued access code (pilot/research/bulk/
// promo). The two are validated, stored, and reported on separately on the
// backend (invitations vs access_codes collections); this module is the only
// place that looks at both and picks one.
//
// Classification runs through the validate-redemption-code Appwrite
// Function rather than reading the collections directly: RedeemInviteCode
// checks a code *before* the recipient has an account, and neither
// `invitations` nor `access_codes` grants guest read (both have row
// security off, so opening guest read would let anyone list every row — in
// `invitations`' case, every pending invitee's email address). The function
// checks both collections with an API key and returns only a classification
// plus the code itself, never any other field.
export type CodeKind = 'invitation' | 'access_code';

export type CodeClassification =
  | { ok: true; kind: 'invitation'; code: string }
  | { ok: true; kind: 'access_code'; code: string }
  | { ok: false; kind: 'invitation'; reason: InvitationValidationReason }
  | { ok: false; kind: 'access_code'; reason: AccessCodeValidationReason }
  | { ok: false; kind: null; reason: 'not_found' | 'invalid' | 'rate_limited' };

class CodeRedemptionService {
  async classifyCode(rawCode: string): Promise<CodeClassification> {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { ok: false, kind: null, reason: 'invalid' };
    }

    if (!appwriteConfig.validateCodeFunctionId) {
      throw new Error(
        'APPWRITE_VALIDATE_CODE_FUNCTION_ID is not configured. Please check your .env file.'
      );
    }

    const execution = await functions.createExecution({
      functionId: appwriteConfig.validateCodeFunctionId,
      body: JSON.stringify({ code }),
      async: false,
    });

    let result: {
      success?: boolean;
      kind?: CodeKind | null;
      code?: string;
      reason?: string;
    } | null = null;
    try {
      result = execution.responseBody ? JSON.parse(execution.responseBody) : null;
    } catch {
      // Malformed/non-JSON response — fall through to the generic failure below.
    }

    // The function always returns a structured `{ success, kind, reason }`
    // body, even on 4xx/5xx (e.g. 429 for rate limiting, 500 for a lookup
    // error) — status code alone isn't a signal to discard the body, only a
    // response that didn't parse at all is.
    if (!result || result.success === undefined) {
      return { ok: false, kind: null, reason: 'not_found' };
    }

    if (result.success && result.code) {
      return result.kind === 'access_code'
        ? { ok: true, kind: 'access_code', code: result.code }
        : { ok: true, kind: 'invitation', code: result.code };
    }

    if (result.kind === 'invitation') {
      return { ok: false, kind: 'invitation', reason: (result.reason as InvitationValidationReason) || 'not_found' };
    }
    if (result.kind === 'access_code') {
      return { ok: false, kind: 'access_code', reason: (result.reason as AccessCodeValidationReason) || 'not_found' };
    }
    return {
      ok: false,
      kind: null,
      reason: result.reason === 'rate_limited' ? 'rate_limited' : 'not_found',
    };
  }

  // Called after the recipient has authenticated (see authStore's pending
  // code redemption). Re-classifies rather than trusting a cached kind, since
  // the code's state can change between validation and account creation.
  // acceptInvitation()/redeemAccessCode() below read/write with the caller's
  // own now-authenticated session (or, for access codes, the redeem-access-
  // code function) — only classification needs the guest-safe function path.
  async redeemCode(rawCode: string, userId: string): Promise<CodeClassification> {
    const classification = await this.classifyCode(rawCode);
    if (!classification.ok) {
      return classification;
    }

    if (classification.kind === 'invitation') {
      await invitationService.acceptInvitation(classification.code, userId);
    } else {
      // The redemption function derives identity from the caller's own JWT,
      // not this userId — it's only relevant to the invitation branch above.
      await accessCodeService.redeemAccessCode(classification.code);
    }

    return classification;
  }
}

export const codeRedemptionService = new CodeRedemptionService();
