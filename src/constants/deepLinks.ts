/**
 * Canonical host for every link we email to users.
 *
 * This MUST stay in sync with three other places, or Universal Links /
 * App Links silently fall back to opening a browser:
 *   1. app.json  -> expo.ios.associatedDomains
 *   2. app.json  -> expo.android.intentFilters[].data[].host
 *   3. admin/public/.well-known/{apple-app-site-association,assetlinks.json}
 *      served from this host
 *
 * History: links used to point at the raw Vercel preview domain
 * (nevermore-admin-app-seven.vercel.app) while the app only ever claimed
 * nevermoreapp.com, so the OS never intercepted them and every invite and
 * reset link opened in Safari/Chrome instead of the app.
 */
export const DEEP_LINK_HOST = 'app.nevermoreapp.com';

export const DEEP_LINK_BASE_URL = `https://${DEEP_LINK_HOST}`;

export const buildInviteLink = (invitationToken: string): string =>
  `${DEEP_LINK_BASE_URL}/invite?token=${encodeURIComponent(invitationToken)}`;

export const PASSWORD_RESET_LINK = `${DEEP_LINK_BASE_URL}/reset-password`;

export const MAGIC_URL_LINK = `${DEEP_LINK_BASE_URL}/verify-magic-url`;

/**
 * Hosts the app still accepts inbound links from. The Vercel domains stay
 * listed so links already sitting in people's inboxes keep working.
 */
export const DEEP_LINK_PREFIXES = [
  'nevermoreapp://',
  DEEP_LINK_BASE_URL,
  'https://nevermoreapp.com',
  'https://nevermore-admin-app-seven.vercel.app',
  'https://nevermore-admin-app.vercel.app',
];
