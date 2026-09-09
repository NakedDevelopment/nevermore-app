const { Client, Account, TablesDB, Query, ID, Permission, Role } = require('node-appwrite');

// Redeems an administrator-issued access code (pilot/research/bulk/promo —
// see admin/src/lib/accessCodes.ts) for the calling user.
//
// This has to run server-side rather than from the client: the
// access_code_redemptions collection allows any authenticated user to
// create a row (Appwrite has no way to validate row *contents* at the
// permission layer), so a client that could write redemption rows directly
// could forge itself free access by inserting a row with a real code's id
// and a far-future accessExpiresAt, or bump access_codes.redemptionCount on
// a code it was never issued. Doing the validate-then-write here, with an
// API key, means the only rows that ever get created are ones this function
// decided were legitimate.
//
// Caller identity comes from a short-lived JWT (see accessCode.service.ts,
// account.createJWT()) rather than a client-supplied userId, so a user can't
// redeem on someone else's behalf by passing a different id in the payload.
module.exports = async ({ req, res, error }) => {
  let payload = {};
  try {
    payload = req.body ? JSON.parse(req.body) : {};
  } catch (err) {
    return res.json({ success: false, reason: 'invalid_request', message: 'Invalid JSON payload' }, 400);
  }

  const { code, jwt } = payload;
  if (!code || !jwt) {
    return res.json({ success: false, reason: 'invalid_request', message: 'code and jwt are required' }, 400);
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  // Appwrite Cloud enforces the function's own ephemeral, scope-limited key
  // (req.headers['x-appwrite-key']) for any outbound call back to its own
  // project — a static key set via process.env.APPWRITE_API_KEY is silently
  // NOT what's actually used on the wire, confirmed directly: reading it
  // back inside a running function showed a different, longer-lived value
  // than the header key, and using it produced "missing scopes" errors that
  // an equivalent direct call with the same key outside the function did
  // not. The function's `scopes` config (Databases/Documents/Rows read+write)
  // is what actually governs this key's permissions — set that in the
  // Appwrite Console (or via the Management API) rather than an API key
  // variable.
  const dynamicApiKey = req.headers['x-appwrite-key'];

  let user;
  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
    user = await new Account(userClient).get();
  } catch (err) {
    return res.json({ success: false, reason: 'unauthenticated', message: 'Invalid or expired session' }, 401);
  }

  const adminClient = new Client().setEndpoint(endpoint).setProject(projectId).setKey(dynamicApiKey);
  const tablesDB = new TablesDB(adminClient);

  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const accessCodesCollectionId = process.env.APPWRITE_ACCESS_CODES_COLLECTION_ID || 'access_codes';
  const redemptionsCollectionId = process.env.APPWRITE_ACCESS_CODE_REDEMPTIONS_COLLECTION_ID || 'access_code_redemptions';

  if (!databaseId) {
    error('APPWRITE_DATABASE_ID is not configured');
    return res.json({ success: false, reason: 'server_error', message: 'Function is not configured' }, 500);
  }

  const normalizedCode = String(code).trim().toUpperCase();

  let accessCode;
  try {
    const codeRows = await tablesDB.listRows({
      databaseId,
      tableId: accessCodesCollectionId,
      queries: [Query.equal('code', normalizedCode), Query.limit(1)],
    });
    if (codeRows.rows.length === 0) {
      return res.json({ success: false, reason: 'not_found' }, 404);
    }
    accessCode = codeRows.rows[0];
  } catch (err) {
    error('Failed to look up access code: ' + err.message);
    return res.json({ success: false, reason: 'server_error', message: 'Failed to look up code' }, 500);
  }

  if (accessCode.status === 'inactive') {
    return res.json({ success: false, reason: 'inactive' }, 409);
  }
  const now = Date.now();
  if (accessCode.startDate && new Date(accessCode.startDate).getTime() > now) {
    return res.json({ success: false, reason: 'inactive' }, 409);
  }
  if (accessCode.expiresAt && new Date(accessCode.expiresAt).getTime() < now) {
    return res.json({ success: false, reason: 'expired' }, 409);
  }
  if (accessCode.redemptionCount >= accessCode.maxRedemptions) {
    return res.json({ success: false, reason: 'redemption_limit' }, 409);
  }

  // Belt-and-suspenders check ahead of the write — the unique index on
  // (userId, codeId) is the actual guarantee against a double redemption
  // racing this check.
  try {
    const existing = await tablesDB.listRows({
      databaseId,
      tableId: redemptionsCollectionId,
      queries: [Query.equal('codeId', accessCode.$id), Query.equal('userId', user.$id), Query.limit(1)],
    });
    if (existing.rows.length > 0) {
      return res.json({ success: false, reason: 'already_redeemed' }, 409);
    }
  } catch (err) {
    error('Failed to check existing redemptions: ' + err.message);
    return res.json({ success: false, reason: 'server_error', message: 'Failed to check redemption status' }, 500);
  }

  const redeemedAt = new Date();
  const accessExpiresAt = accessCode.accessDurationDays > 0
    ? new Date(redeemedAt.getTime() + accessCode.accessDurationDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  try {
    await tablesDB.createRow({
      databaseId,
      tableId: redemptionsCollectionId,
      rowId: ID.unique(),
      data: {
        codeId: accessCode.$id,
        code: accessCode.code,
        userId: user.$id,
        redeemedAt: redeemedAt.toISOString(),
        accessExpiresAt,
        status: 'active',
      },
      // Row security is on for this collection — without this, the user
      // couldn't read their own redemption record back.
      permissions: [Permission.read(Role.user(user.$id))],
    });
  } catch (err) {
    // Most likely the unique (userId, codeId) index rejecting a concurrent
    // duplicate redemption that slipped past the check above.
    error('Failed to create redemption row: ' + err.message);
    return res.json({ success: false, reason: 'already_redeemed' }, 409);
  }

  try {
    await tablesDB.updateRow({
      databaseId,
      tableId: accessCodesCollectionId,
      rowId: accessCode.$id,
      data: { redemptionCount: accessCode.redemptionCount + 1 },
    });
  } catch (err) {
    // The redemption row (created above) is the source of truth for "did
    // this user get access" — don't fail the whole redemption over the
    // counter update. A concurrent redeemer of the same multi-use code could
    // in rare cases push the count slightly past maxRedemptions; acceptable
    // at pilot/promo scale without a transactional increment.
    error('Failed to increment access code redemption count: ' + err.message);
  }

  return res.json({ success: true, accessExpiresAt: accessExpiresAt || null });
};
