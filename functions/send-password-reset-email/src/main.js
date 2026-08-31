const { Client, Users, Query } = require('node-appwrite');

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
  const brevoTemplateId = Number(process.env.BREVO_PASSWORD_RESET_TEMPLATE_ID || '2');

  if (!brevoApiKey) {
    error('BREVO_API_KEY is not configured');
    return res.json({ success: false, message: 'Email provider is not configured' }, 500);
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const dynamicKeyRaw = process.env.APPWRITE_API_KEY || req.headers['x-appwrite-key'] || '';
  const dynamicKey = Array.isArray(dynamicKeyRaw) ? String(dynamicKeyRaw[0] || '') : String(dynamicKeyRaw);

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

  let user = null;
  try {
    const existing = await users.list([Query.equal('email', email)]);
    if (existing.total > 0) {
      user = existing.users[0];
    }
  } catch (err) {
    error('Failed to look up user: ' + err.message);
    return res.json({ success: false, message: 'Failed to process password reset request', debug: err.message }, 500);
  }

  if (!user) {
    // Don't create an account and don't reveal whether this email is registered.
    log(`Password reset requested for unknown email ${email}`);
    return res.json({ success: true });
  }

  let secret;
  try {
    const token = await users.createToken(user.$id, 6, 3600);
    secret = token.secret;
  } catch (err) {
    error('Failed to create reset token: ' + err.message);
    return res.json({ success: false, message: 'Failed to create password reset token', debug: err.message }, 500);
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
      return res.json({ success: false, message: 'Failed to send password reset email' }, 502);
    }
  } catch (err) {
    error('Failed to call Brevo API: ' + err.message);
    return res.json({ success: false, message: 'Failed to send password reset email' }, 500);
  }

  log(`Password reset email sent to ${email} via Brevo template ${brevoTemplateId}`);

  return res.json({ success: true });
};
