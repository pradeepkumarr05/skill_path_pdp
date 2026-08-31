import { OAuth2Client } from 'google-auth-library';

let cachedClient = null;

function getClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new OAuth2Client(clientId);
  }
  return cachedClient;
}

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

/**
 * Verifies a Google Identity Services credential (a signed JWT ID token)
 * server-side against Google's public keys. This is the step that
 * actually proves the token wasn't forged - never trust a decoded-but-
 * unverified JWT from the client.
 *
 * Returns the verified profile, or throws if the token is invalid,
 * expired, or was issued for a different Google OAuth client.
 */
export async function verifyGoogleIdToken(idToken) {
  const client = getClient();
  if (!client) {
    const error = new Error('Google Sign-In is not configured on this server.');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    const error = new Error('Google sign-in could not be verified.');
    error.code = 'INVALID_GOOGLE_TOKEN';
    error.status = 401;
    throw error;
  }

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    const error = new Error('Google sign-in could not be verified.');
    error.code = 'INVALID_GOOGLE_TOKEN';
    error.status = 401;
    throw error;
  }

  if (!payload.email_verified) {
    // Refuse to trust an unverified email for account linking/creation -
    // otherwise anyone could register an unverified address at Google and
    // take over an existing SkillPath account with the same email.
    const error = new Error('Your Google email address is not verified.');
    error.code = 'GOOGLE_EMAIL_UNVERIFIED';
    error.status = 401;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    fullName: payload.name || null,
  };
}
