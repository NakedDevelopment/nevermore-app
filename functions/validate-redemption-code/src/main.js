const { Client, TablesDB, Query } = require('node-appwrite');
const crypto = require('crypto');

// Per-IP throttle: this endpoint is guest-callable by design (the whole
// point is checking a code before the recipient has an account), which
// means it's also the one guessable-code attack surface in this system.
// Random NM-XXXXXX/access codes have enough entropy (32^6) that brute
// force isn't practical even unthrottled, but an admin-issued *named* code
// (e.g. "AAC-PILOT-2026") can be far more guessable, so this isn't just
// theoretical. Bucketed by caller IP + a 10-minute window in
// code_validation_attempts; row security is off there (same pattern as
// the invitations/access_codes tables) since only this function ever
// touches it.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

async function checkRateLimit(tablesDB, databaseId, ip) {
  const windowBucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 20);
  const rowId = `rl_${ipHash}_${windowBucket}`;

  try {
    const existing = await tablesDB.getRow({
      databaseId,
      tableId: 'code_validation_attempts',
      rowId,
    });
    if (existing.count >= RATE_LIMIT_MAX_ATTEMPTS) {
      return false;
    }
    await tablesDB.updateRow({
      databaseId,
      tableId: 'code_validation_attempts',
      rowId,
      data: { count: existing.count + 1 },
    });
    return true;
  } catch (err) {
    // Row doesn't exist yet for this IP/window — create it. (Not a cache of
    // "not found": any other error also falls through here, but failing
    // open on a throttle-bookkeeping error is the right tradeoff — a
    // transient DB hiccup shouldn't lock a legitimate recipient out of
    // redeeming their own invitation.)
    try {
      await tablesDB.createRow({
        databaseId,
        tableId: 'code_validation_attempts',
        rowId,
        data: { count: 1, windowStart: new Date(windowBucket * RATE_LIMIT_WINDOW_MS).toISOString() },
      });
    } catch {
      // Ignore a create race (two requests in the same window creating at
      // once) — the loser's attempt still gets served, just not counted.
    }
    return true;
  }
}

// Lets an unauthenticated recipient check a code — subscriber invitation or
// admin access code — before they have an account. RedeemInviteCode needs to
// validate and show a specific error *before* sending someone into sign-up,
// but neither `invitations` nor `access_codes` grants guest read (both have
// row security off, so opening guest read would let anyone list every row —
// every pending invitation's email address, in the invitations case). This
// function checks both collections with an API key and returns only a
// classification plus the code itself — never email, inviterId, campaign
// name, or any other row field.
//
// Actual redemption (accepting the invitation / recording the access-code
// redemption) happens separately, after the user is authenticated — at that
// point their own session has read access and the existing client-side
// paths (invitationService.acceptInvitation, the redeem-access-code
// function) work unchanged. This function only answers "is this code good?".
module.exports = async ({ req, res, error }) => {
  let payload = {};
  try {
    payload = req.body ? JSON.parse(req.body) : {};
  } catch (err) {
    return res.json({ success: false, kind: null, reason: 'invalid' }, 400);
  }

  const rawCode = payload.code;
  if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
    return res.json({ success: false, kind: null, reason: 'invalid' });
  }
  const code = rawCode.trim().toUpperCase();

  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const invitationsCollectionId = process.env.APPWRITE_INVITATIONS_COLLECTION_ID || 'invitations';
  const accessCodesCollectionId = process.env.APPWRITE_ACCESS_CODES_COLLECTION_ID || 'access_codes';

  if (!databaseId) {
    error('APPWRITE_DATABASE_ID is not configured');
    return res.json({ success: false, kind: null, reason: 'not_found' }, 500);
  }

  // Appwrite Cloud enforces the function's own ephemeral, scope-limited key
  // (req.headers['x-appwrite-key']) for any outbound call back to its own
  // project — a static key set via process.env.APPWRITE_API_KEY is silently
  // NOT what's actually used on the wire (confirmed directly). The
  // function's `scopes` config (Databases/Documents/Rows read) is what
  // governs this key's permissions — set that in the Appwrite Console
  // rather than an API key variable.
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const tablesDB = new TablesDB(client);

  const callerIp = req.headers['x-appwrite-client-ip'] || 'unknown';
  const withinLimit = await checkRateLimit(tablesDB, databaseId, callerIp);
  if (!withinLimit) {
    return res.json({ success: false, kind: null, reason: 'rate_limited' }, 429);
  }

  try {
    const invitationRows = await tablesDB.listRows({
      databaseId,
      tableId: invitationsCollectionId,
      queries: [Query.equal('invitationToken', code), Query.limit(1)],
    });

    if (invitationRows.rows.length > 0) {
      const invitation = invitationRows.rows[0];
      const reason = classifyInvitation(invitation);
      if (reason) {
        return res.json({ success: false, kind: 'invitation', reason });
      }
      return res.json({ success: true, kind: 'invitation', code: invitation.invitationToken });
    }
  } catch (err) {
    error('Failed to look up invitation: ' + err.message);
    return res.json({ success: false, kind: null, reason: 'not_found' }, 500);
  }

  try {
    const accessCodeRows = await tablesDB.listRows({
      databaseId,
      tableId: accessCodesCollectionId,
      queries: [Query.equal('code', code), Query.limit(1)],
    });

    if (accessCodeRows.rows.length > 0) {
      const accessCode = accessCodeRows.rows[0];
      const reason = classifyAccessCode(accessCode);
      if (reason) {
        return res.json({ success: false, kind: 'access_code', reason });
      }
      return res.json({ success: true, kind: 'access_code', code: accessCode.code });
    }
  } catch (err) {
    error('Failed to look up access code: ' + err.message);
    return res.json({ success: false, kind: null, reason: 'not_found' }, 500);
  }

  return res.json({ success: false, kind: null, reason: 'not_found' });
};

// Mirrors invitationService.validateInvitationCode's classification.
function classifyInvitation(invitation) {
  if (invitation.status === 'revoked') return 'revoked';
  if (invitation.status === 'accepted' || invitation.status === 'upgraded') return 'accepted';
  const now = Date.now();
  const isExpired = invitation.expiresAt && new Date(invitation.expiresAt).getTime() < now;
  if (invitation.status === 'expired' || isExpired) return 'expired';
  if (invitation.status !== 'pending') return 'revoked';
  return null;
}

// Mirrors accessCodeService.validateAccessCode's classification.
function classifyAccessCode(accessCode) {
  if (accessCode.status === 'inactive') return 'inactive';
  const now = Date.now();
  if (accessCode.startDate && new Date(accessCode.startDate).getTime() > now) return 'inactive';
  if (accessCode.expiresAt && new Date(accessCode.expiresAt).getTime() < now) return 'expired';
  if (accessCode.maxRedemptions != null && accessCode.redemptionCount >= accessCode.maxRedemptions) {
    return 'redemption_limit';
  }
  return null;
}
