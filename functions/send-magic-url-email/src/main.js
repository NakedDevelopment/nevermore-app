const { Client, Users, Query, ID } = require('node-appwrite');

// Sign-in / email-verification link, sent via Brevo.
//
// Replaces account.createMagicURLToken(), which used Appwrite's built-in
// mailer and was the last user-facing email still branded as Appwrite.
//
// Token lifetime is deliberately long: the recipient may need to install the
// app from the store before the link can be used.
const TOKEN_LENGTH = 6;
const TOKEN_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

module.exports = async ({ req, res, log, error }) => {
  let payload = {};
  try {
    payload = req.body ? JSON.parse(req.body) : {};
  } catch (err) {
    return res.json({ success: false, message: 'Invalid JSON payload' }, 400);
  }

  const { email, deepLink } = payload;

  if (!email || !deepLink) {
    return res.json({ success: false, message: 'email and deepLink are required' }, 400);
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const templateIdRaw = process.env.BREVO_MAGIC_URL_TEMPLATE_ID;

  if (!brevoApiKey) {
    error('BREVO_API_KEY is not configured');
    return res.json({ success: false, message: 'Email provider is not configured' }, 500);
  }

  // No numeric fallback on purpose: guessing an ID silently sends whatever
  // template happens to occupy that slot in Brevo.
  const brevoTemplateId = Number(templateIdRaw);
  if (!templateIdRaw || !Number.isInteger(brevoTemplateId) || brevoTemplateId <= 0) {
    error(`BREVO_MAGIC_URL_TEMPLATE_ID is missing or invalid: ${JSON.stringify(templateIdRaw)}`);
    return res.json({ success: false, message: 'Email template is not configured' }, 500);
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const dynamicKeyRaw = process.env.APPWRITE_API_KEY || req.headers['x-appwrite-key'] || '';
  const dynamicKey = Array.isArray(dynamicKeyRaw) ? String(dynamicKeyRaw[0] || '') : String(dynamicKeyRaw);

  let client;
  try {
    client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(dynamicKey);
  } catch (err) {
    error('Failed to construct Appwrite client: ' + err.message);
    return res.json({ success: false, message: 'Failed to configure Appwrite client' }, 500);
  }

  const users = new Users(client);

  // Matches the previous createMagicURLToken behaviour, which created the
  // account when the address was not yet registered.
  let user;
  try {
    const existing = await users.list([Query.equal('email', email)]);
    if (existing.total > 0) {
      user = existing.users[0];
    } else {
      user = await users.create(ID.unique(), email);
    }
  } catch (err) {
    error('Failed to find or create user: ' + err.message);
    return res.json({ success: false, message: 'Failed to prepare account' }, 500);
  }

  let secret;
  try {
    const token = await users.createToken(user.$id, TOKEN_LENGTH, TOKEN_EXPIRY_SECONDS);
    secret = token.secret;
  } catch (err) {
    error('Failed to create magic URL token: ' + err.message);
    return res.json({ success: false, message: 'Failed to create sign-in token' }, 500);
  }

  const separator = deepLink.includes('?') ? '&' : '?';
  const redirect = `${deepLink}${separator}userId=${encodeURIComponent(user.$id)}&secret=${encodeURIComponent(secret)}`;

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
          FIRSTNAME: user.name || 'there',
          REDIRECT: redirect,
        },
      }),
    });

    if (!emailResponse.ok) {
      const text = await emailResponse.text();
      error('Brevo API error: ' + text);
      return res.json({ success: false, message: 'Failed to send verification email' }, 502);
    }
  } catch (err) {
    error('Failed to call Brevo API: ' + err.message);
    return res.json({ success: false, message: 'Failed to send verification email' }, 500);
  }

  log(`Magic URL email sent to ${email} via Brevo template ${brevoTemplateId}`);

  return res.json({ success: true });
};
