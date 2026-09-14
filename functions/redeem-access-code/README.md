# redeem-access-code

Appwrite Function that redeems an administrator-issued access code (pilot/research/bulk/promo — see `admin/src/lib/accessCodes.ts`) on behalf of the calling user.

This has to run server-side rather than from the client. `access_code_redemptions` has row security on with `create` open to any authenticated user (Appwrite permissions can't validate row *contents*), so a client that wrote redemption rows directly could forge itself free access — inserting a row against a real code's id with a far-future `accessExpiresAt`, or bumping `access_codes.redemptionCount` on a code it was never issued. This function does the validate-then-write with an API key so the only rows that ever get created are ones it decided were legitimate, and identifies the caller from a short-lived JWT (`account.createJWT()` on the client) rather than a client-supplied `userId`, so a user can't redeem on someone else's behalf.

## Deployment

1. In the Appwrite Console, go to Functions and create a new function pointing at this folder (`functions/redeem-access-code`), runtime Node.js 18+ or 20+, entrypoint `src/main.js`.
2. Set the function's execute permission to allow authenticated Users.
3. **Set the function's scopes** (Settings → Scopes, or via the Management API) to include Databases/Documents/Rows read + write. This is not optional: Appwrite Cloud enforces the function's own ephemeral key (exposed to the code as `req.headers['x-appwrite-key']`) for any outbound call back to its own project — a static `APPWRITE_API_KEY` variable is silently ignored for that traffic even if it has full permissions when used directly. Confirmed directly: reading `process.env.APPWRITE_API_KEY` back inside a running execution returned a different, longer-lived value than `req.headers['x-appwrite-key']`, and only the latter's permissions (governed by the function's `scopes`) applied to the actual request.
4. Add the environment variables listed below in the function's Settings tab.
5. Copy the deployed function's ID into `APPWRITE_ACCESS_CODE_REDEMPTION_FUNCTION_ID` in the app's `.env` file.

## Required environment variables

- `APPWRITE_DATABASE_ID` — the Nevermore database id.
- `APPWRITE_ACCESS_CODES_COLLECTION_ID` — optional, defaults to `access_codes`.
- `APPWRITE_ACCESS_CODE_REDEMPTIONS_COLLECTION_ID` — optional, defaults to `access_code_redemptions`.

No API key variable is needed — see the scopes note above. `APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` are provided automatically by Appwrite at runtime.

## Request payload

```json
{
  "code": "AAC-7H4K92",
  "jwt": "<short-lived JWT from account.createJWT() on the client>"
}
```

## Response

Success:
```json
{ "success": true, "accessExpiresAt": "2026-12-31T00:00:00.000Z" }
```
`accessExpiresAt` is `null` when the code grants access that doesn't expire (`accessDurationDays: 0`).

Failure (`success: false`) includes a `reason`: `not_found`, `expired`, `inactive`, `redemption_limit`, `already_redeemed`, `unauthenticated`, `invalid_request`, or `server_error`.

## Note on concurrency

`access_codes.redemptionCount` is claimed via `TablesDB.incrementRowColumn` with a `max` cap, which is atomic server-side (it rejects the increment with a `column_limit_exceeded` error rather than silently overshooting) — this closes the race two different people redeeming the same multi-use code at the same instant used to have, where both could pass a stale `redemptionCount` read and push the count past `maxRedemptions`. The slot is claimed *before* the redemption row is written; if the row write then fails (most likely the `(userId, codeId)` unique index rejecting a same-user duplicate), the claimed slot is released with a compensating decrement so the counter doesn't count a redemption that never actually landed.
