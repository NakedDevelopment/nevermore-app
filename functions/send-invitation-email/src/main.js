const { Client, Users, Query, ID } = require('node-appwrite');

// The recipient normally does NOT have Nevermore installed when the invite
// arrives, so the token has to outlive: read email -> tap -> app store ->
// install -> open -> accept.
const TOKEN_LENGTH = 6;
const TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

module.exports = async ({ req, res, log, error }) => {
  let payload = {};
  try {
    payload = req.body ? JSON.parse(req.body) : {};
  } catch (err) {
    return res.json({ success: false, message: 'Invalid JSON payload' }, 400);
  }

  const { email, deepLink, firstName } = payload;

  if (!email || !deepLink) {
    return res.json({ success: false, message: 'email and deepLink are required' }, 400);
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

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const dynamicKeyRaw = process.env.APPWRITE_API_KEY || req.headers['x-appwrite-key'] || '';
  const dynamicKey = Array.isArray(dynamicKeyRaw) ? String(dynamicKeyRaw[0] || '') : String(dynamicKeyRaw);

  log(`Config check: endpoint=${JSON.stringify(endpoint)} projectId=${JSON.stringify(projectId)} usingStaticKey=${!!process.env.APPWRITE_API_KEY} keyLen=${dynamicKey.length}`);

  let client;
  try {
    client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(dynamicKey);
  } catch (err) {
    error('Failed to construct Appwrite client: ' + err.message);
    return res.json({ success: false, message: 'Failed to configure Appwrite client', debug: err.message }, 500);
  }

  const users = new Users(client);

  let userId;
  try {
    const existing = await users.list([Query.equal('email', email)]);
    if (existing.total > 0) {
      userId = existing.users[0].$id;
    } else {
      const created = await users.create(ID.unique(), email);
      userId = created.$id;
    }
  } catch (err) {
    error('Failed to find or create invitee user: ' + err.message + ' | cause: ' + JSON.stringify(err.cause) + ' | code: ' + err.code + ' | type: ' + err.type);
    return res.json({ success: false, message: 'Failed to prepare invitee account', debug: { message: err.message, cause: err.cause ? String(err.cause) : null, code: err.code, type: err.type } }, 500);
  }

  let secret;
  try {
    // Explicit lifetime. Appwrite's server-side default is 15 minutes, which
    // expires while the recipient is still installing the app from the store,
    // leaving them with a dead invite link.
    const token = await users.createToken(userId, TOKEN_LENGTH, TOKEN_EXPIRY_SECONDS);
    secret = token.secret;
  } catch (err) {
    error('Failed to create login token: ' + err.message);
    return res.json({ success: false, message: 'Failed to create invitation token', debug: err.message }, 500);
  }

  const separator = deepLink.includes('?') ? '&' : '?';
  const redirect = `${deepLink}${separator}userId=${encodeURIComponent(userId)}&secret=${encodeURIComponent(secret)}`;

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
          REDIRECT: redirect,
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

  log(`Invitation email sent to ${email} via Brevo template ${brevoTemplateId}`);

  return res.json({ success: true, userId });
};
