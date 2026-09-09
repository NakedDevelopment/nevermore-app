# send-invitation-email

Appwrite Function that sends the Nevermore invitation email through Brevo's transactional email API. The invitation code itself is generated and stored by the app (`invitation.service.ts`) before this function runs — this function only delivers it. It does not create an Appwrite user, session, or login token: redemption happens when the recipient types the code into "Enter Invitation Code" after installing and signing up/in, not by tapping a deep link.

## Deployment

1. In the Appwrite Console, go to Functions and create a new function pointing at this folder (`functions/send-invitation-email`), runtime Node.js 18+ or 20+, entrypoint `src/main.js`.
2. Set the function's execute permission to allow authenticated Users (or whichever role should be allowed to trigger invitations).
3. Add the environment variables listed below in the function's Settings tab. Do this yourself in the Appwrite Console; secrets should never be pasted into chat, code, or version control.
4. Copy the deployed function's ID into `APPWRITE_INVITATION_FUNCTION_ID` in the app's `.env` file.

## Required environment variables

- `BREVO_API_KEY` — your Brevo API key (Brevo dashboard under SMTP & API > API Keys).
- `BREVO_INVITATION_TEMPLATE_ID` — the invitation template ID in Brevo (template #1).

The App Store and Google Play links are hardcoded directly in the Brevo template's HTML (not passed as params by this function) — see `email-templates/support-network-invitation.html`. Brevo is the source of truth for that template; update the links there (and re-pull the file into the repo) if the listings ever move.

## Request payload

```json
{
  "email": "invitee@example.com",
  "inviteCode": "NM-7X4K92",
  "firstName": "optional"
}
```

## Response

```json
{ "success": true }
```

On failure, `success` is `false` and `message` explains what went wrong.

## Note on the Brevo sender domain

Brevo currently reports that the sender `louis@nevermoreapp.com` is not domain-authenticated, which will block delivery. Authenticate the sending domain (or switch to an authenticated sender) in Brevo before relying on this function in production.
