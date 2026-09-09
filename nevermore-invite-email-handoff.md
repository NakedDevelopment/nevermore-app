# Nevermore invite email — handoff

Two parts. Do them in order. Report what you find for Part 2 before writing any
migration — if the existing invitation-token infrastructure already covers it (it
almost certainly does, see below), adapt it rather than building a second system.

---

## Part 1 — Pull the live Brevo template into the repo

The Brevo transactional template (account **NevermoreApp**, template **ID 1**,
subject *"You matter to someone's recovery."*) is the source of truth for the HTML.
Do **not** hand-write or paste the HTML — fetch it so the repo copy can't drift from
what actually sends:

```bash
curl -sS -X GET "https://api.brevo.com/v3/smtp/templates/1" \
  -H "accept: application/json" \
  -H "api-key: $BREVO_API_KEY" \
  | jq -r '.htmlContent' > email-templates/support-network-invitation.html
```

That's the existing file in this repo — it's already the correctly-named sibling to
`email-templates/magic-url-verification.html`, no new path needed. Commit it once pulled.

**If `BREVO_API_KEY` isn't in the environment, stop and ask — do not guess or
hardcode a key.**

### What changed in the email (for reference/verification only — Brevo already has this live)

| Before | After |
|---|---|
| `Accept Invitation` button → `{{ params.REDIRECT }}` | Two buttons: **Download on the App Store** and **Get it on Google Play** (URLs hardcoded in the template — iOS `https://apps.apple.com/app/id6754863979`, Android `https://play.google.com/store/apps/details?id=com.nevermoreapp`) |
| Small "fallback code" block | Prominent **YOUR INVITATION CODE** block → `{{ params.INVITE_CODE }}` |
| — | Instruction copy: *After installing Nevermore, open the app and select "Enter Invitation Code."* |

Everything above that section (branding, colors, greeting, support-circle copy, audio-library
section, footer) is unchanged. `params.FIRSTNAME` is still used in the greeting.

### Required code changes

- `params.REDIRECT` is no longer used — confirm nothing still builds a deep link
  only to populate it.
- `params.INVITE_CODE` is required. Format: `NM-XXXXXX` — prefix `NM-`, then 6
  uppercase alphanumeric chars, excluding ambiguous characters (`0/O`, `1/I/L`) so
  it's readable off a phone screen.
- `params.APP_STORE_URL` / `params.PLAY_STORE_URL` are **not** sent — those links
  are hardcoded directly in the Brevo HTML, not templated.

Resulting send-call payload:

```json
{
  "templateId": 1,
  "to": [{ "email": "<recipient>" }],
  "params": {
    "FIRSTNAME": "<recipient first name>",
    "INVITE_CODE": "NM-7X4K92"
  }
}
```

### Code lifecycle rules

The code must **not** be consumed when the email is opened, when a store link is
tapped, or when the app is installed. It's marked used **only** after the recipient
successfully accepts the invitation, and cannot be reused after that. It must
support expiration and re-issuing a replacement.

---

## Part 2 — Reuse the existing invitation token; don't build a parallel system

Before writing any migration: check whether the existing invitation flow already
generates and stores a unique server-side token per invitation (`invitationToken` on
the `invitations` collection, `src/services/invitation.service.ts`). If it does —
adapt that field into the user-facing `INVITE_CODE` (format above) rather than
standing up a second table. This is the difference between a column on an existing
table and a whole parallel invitation architecture — report back which one you're
looking at before touching schema or writing a migration.

Specifically verify:
- Where the code is generated (should be a friendly-format generator feeding the
  existing `invitationToken` field, not `ID.unique()`).
- That the code isn't marked used until acceptance, and can't be reused after
  (check the `status` state machine: `pending → accepted`, plus `expired`/`revoked`).
- That expiration is supported (an `expiresAt`-style field, checked at
  validation/redemption time — note if this needs a new Appwrite attribute, since
  that has to be added manually in the Appwrite console, not via migration).
- That there's a resend/replacement path (issuing a new code without losing the
  original invitation record).

Report findings for all four before concluding whether any new schema work is
actually needed.
