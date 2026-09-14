# validate-redemption-code

Appwrite Function that lets an unauthenticated recipient check a code — subscriber invitation or admin access code — before they have an account.

`RedeemInviteCode` needs to validate and show a specific error message *before* sending the recipient into sign-up, but neither `invitations` nor `access_codes` grants guest read (both have row security off, so opening guest read would let anyone list every row — every pending invitation's email address, in the `invitations` case). This function checks both collections with an API key and returns only a classification plus the code itself, never any other row field.

Actual redemption (accepting the invitation / recording the access-code redemption) happens separately, after the user is authenticated — at that point their own session has read access and the existing client-side paths (`invitationService.acceptInvitation`, the `redeem-access-code` function) work unchanged. This function only answers "is this code good?".

Because it's guest-callable by necessity, it's also the one guessable-code attack surface in this system — random `NM-XXXXXX`/access codes have enough entropy (32^6) that brute force isn't practical even unthrottled, but an admin-issued *named* code (e.g. `AAC-PILOT-2026`) can be far more guessable. It throttles by caller IP (`req.headers['x-appwrite-client-ip']`, set by Appwrite's own gateway — not client-suppliable) using a `code_validation_attempts` collection.

## Deployment

1. In the Appwrite Console, go to Functions and create a new function pointing at this folder (`functions/validate-redemption-code`), runtime Node.js 18+ or 20+, entrypoint `src/main.js`.
2. Set the function's **execute permission to `any`** — this must be callable by an unauthenticated user, that's the whole point.
3. **Set the function's scopes** (Settings → Scopes, or via the Management API) to include Databases/Documents/Rows read + write (write is needed now for the rate-limit bookkeeping table, not just read). This is not optional: Appwrite Cloud enforces the function's own ephemeral key (exposed to the code as `req.headers['x-appwrite-key']`) for any outbound call back to its own project — a static `APPWRITE_API_KEY` variable is silently ignored for that traffic even if it has full permissions when used directly. Confirmed directly: reading `process.env.APPWRITE_API_KEY` back inside a running execution returned a different, longer-lived value than `req.headers['x-appwrite-key']`, and only the latter's permissions (governed by the function's `scopes`) applied to the actual request.
4. Create a `code_validation_attempts` collection (row security off — only this function ever touches it) with columns `count` (integer, required) and `windowStart` (datetime, required). No indexes needed; rows are addressed directly by ID.
5. Add the environment variables listed below.
6. Copy the deployed function's ID into `APPWRITE_VALIDATE_CODE_FUNCTION_ID` in the app's `.env` file.

## Required environment variables

- `APPWRITE_DATABASE_ID` — the Nevermore database id.
- `APPWRITE_INVITATIONS_COLLECTION_ID` — optional, defaults to `invitations`.
- `APPWRITE_ACCESS_CODES_COLLECTION_ID` — optional, defaults to `access_codes`.

No API key variable is needed — see the scopes note above. `APPWRITE_FUNCTION_API_ENDPOINT` and `APPWRITE_FUNCTION_PROJECT_ID` are provided automatically by Appwrite at runtime. `code_validation_attempts` is currently a fixed name in code, not configurable via env var.

## Request payload

```json
{ "code": "NM-7X4K92" }
```

## Response

Valid code:
```json
{ "success": true, "kind": "invitation", "code": "NM-7X4K92" }
```
or `"kind": "access_code"`.

Invalid code:
```json
{ "success": false, "kind": "invitation", "reason": "expired" }
```
`kind` is `null` when the code doesn't exist in either collection, or when rate-limited. `reason` is one of: `not_found`, `expired`, `accepted`, `revoked` (invitation kind); `not_found`, `expired`, `redemption_limit`, `inactive` (access_code kind); `invalid` (empty/malformed input, `kind: null`); `rate_limited` (429, `kind: null` — more than 20 checks from the same IP within a 10-minute window).
