// Sends the Nevermore invitation email through Brevo. The invitation code is
// generated and stored by the app before this function ever runs (see
// invitation.service.ts) — this function's only job is delivering it. It no
// longer creates an Appwrite user or login token: redemption now happens by
// the recipient typing the code into "Enter Invitation Code" after they
// install and sign up/in, not by tapping a deep link, so there's nothing
// here that needs an authenticated session to exist ahead of time.
//
// The App Store / Google Play links are hardcoded directly in the Brevo
// template (not passed as params) — Brevo is the source of truth for
// template #1's HTML; see email-templates/support-network-invitation.html.

module.exports = async ({ req, res, error }) => {
  let payload = {};
  try {
    payload = req.body ? JSON.parse(req.body) : {};
  } catch (err) {
    return res.json({ success: false, message: 'Invalid JSON payload' }, 400);
  }

  const { email, inviteCode, firstName } = payload;

  if (!email || !inviteCode) {
    return res.json({ success: false, message: 'email and inviteCode are required' }, 400);
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const templateIdRaw = process.env.BREVO_INVITATION_TEMPLATE_ID;

  if (!brevoApiKey) {
    error('BREVO_API_KEY is not configured');
    return res.json({ success: false, message: 'Email provider is not configured' }, 500);
  }

  // No numeric fallback on purpose: a `|| '1'` style default silently sends
  // whatever template happens to occupy that slot in Brevo when the env var
  // is missing on the deployed function.
  const brevoTemplateId = Number(templateIdRaw);
  if (!templateIdRaw || !Number.isInteger(brevoTemplateId) || brevoTemplateId <= 0) {
    error(`BREVO_INVITATION_TEMPLATE_ID is missing or invalid: ${JSON.stringify(templateIdRaw)}`);
    return res.json({ success: false, message: 'Email template is not configured' }, 500);
  }

  try {
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': brevoApiKey,
      },
      body: JSON.stringify({
        to: [{ email }],
        templateId: brevoTemplateId,
        params: {
          FIRSTNAME: firstName || 'there',
          INVITE_CODE: inviteCode,
        },
      }),
    });

    if (!emailResponse.ok) {
      const text = await emailResponse.text();
      error('Brevo API error: ' + text);
      return res.json({ success: false, message: 'Failed to send invitation email' }, 502);
    }
  } catch (err) {
    error('Failed to call Brevo API: ' + err.message);
    return res.json({ success: false, message: 'Failed to send invitation email' }, 500);
  }

  return res.json({ success: true });
};
