const GITHUB_USER_AGENT = 'skillpath-app';

export function isGithubAuthConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function githubError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.status = 401;
  return error;
}

async function fetchGithubEmails(accessToken) {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': GITHUB_USER_AGENT,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!response.ok) return [];
  return response.json();
}

/**
 * Completes the OAuth "Authorization Code" flow: exchanges the one-time
 * code for an access token, then uses that token to read the user's
 * profile and a verified email address. Requires a client secret (unlike
 * Google's client-side ID-token flow), so this must run server-side only.
 */
export async function exchangeGithubCode(code) {
  if (!isGithubAuthConfigured()) {
    throw githubError('GitHub Sign-In is not configured on this server.', 'GITHUB_NOT_CONFIGURED');
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
    }),
  });

  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || tokenBody.error || !tokenBody.access_token) {
    throw githubError('GitHub sign-in could not be completed.', 'GITHUB_TOKEN_EXCHANGE_FAILED');
  }

  const accessToken = tokenBody.access_token;

  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': GITHUB_USER_AGENT,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!profileResponse.ok) {
    throw githubError('Could not read your GitHub profile.', 'GITHUB_PROFILE_FETCH_FAILED');
  }
  const profile = await profileResponse.json();

  // GitHub's /user endpoint only returns an email if the user made one
  // public; it also doesn't say whether that email is verified. /user/emails
  // (granted by the `user:email` scope) is the source of truth for both.
  const emails = await fetchGithubEmails(accessToken);
  const verifiedPrimary =
    emails.find((entry) => entry.primary && entry.verified) || emails.find((entry) => entry.verified);

  if (!verifiedPrimary) {
    // Refuse to trust an unverified email for account linking/creation -
    // otherwise anyone could add an unverified address to their GitHub
    // account and take over an existing SkillPath account with that email.
    throw githubError('Your GitHub account has no verified email address.', 'GITHUB_EMAIL_UNVERIFIED');
  }

  return {
    githubId: String(profile.id),
    email: verifiedPrimary.email,
    fullName: profile.name || profile.login || null,
    accessToken,
  };
}
