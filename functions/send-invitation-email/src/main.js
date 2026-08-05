const { Client, Users, Query, ID } = require('node-appwrite');

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
  const brevoTemplateId = Number(process.env.BREVO_INVITATION_TEMPLATE_ID || '1');

  if (!brevoApiKey) {
    error('BREVO_API_KEY is not configured');
    return res.json({ success: false, message: 'Email provider is not configured' }, 500);
  }

  const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY || '');

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
    error('Failed to find or create invitee user: ' + err.message);
    return res.json({ success: false, message: 'Failed to prepare invitee account' }, 500);
  }

  let secret;
  try {
    const token = await users.createToken(userId);
    secret = token.secret;
  } catch (err) {
    error('Failed to create login token: ' + err.message);
    return res.json({ success: false, message: 'Failed to create invitation token' }, 500);
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
