import { Router } from 'express';
import crypto from 'node:crypto';
import {
  AuthError,
  authenticateUser,
  findOrCreateGithubUser,
  findOrCreateGoogleUser,
  issueAccessToken,
  issueRefreshToken,
  registerUser,
  requestPasswordReset,
  resetPasswordWithOtp,
  revokeRefreshToken,
  rotateRefreshToken,
} from './authService.mjs';
import { forgotPasswordSchema, loginSchema, profileSetupSchema, registerSchema, resetPasswordSchema, validate } from './validation.mjs';
import { verifyGoogleIdToken } from './googleAuth.mjs';
import { exchangeGithubCode, isGithubAuthConfigured } from './githubAuth.mjs';
import { verifyAccessToken, ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './tokens.mjs';
import { issueCsrfToken, requireCsrfToken } from '../middleware/csrf.mjs';
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
  resetPasswordRateLimiter,
} from '../middleware/rateLimit.mjs';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

export const authRouter = Router();

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

function cookieOptionsWithMaxAge(baseOptions, maxAge) {
  return maxAge ? { ...baseOptions, maxAge } : baseOptions;
}

function setSessionCookies(res, { accessToken, refreshToken }, { rememberDevice = true } = {}) {
  res.cookie(ACCESS_COOKIE, accessToken, cookieOptionsWithMaxAge({ ...baseCookieOptions }, rememberDevice ? ACCESS_TOKEN_TTL_SECONDS * 1000 : null));
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions,
    ...(rememberDevice ? { maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000 } : {}),
    path: '/api/auth', // only sent back to auth endpoints, minimizing exposure
  });
}

function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions, path: '/api/auth' });
}

function clientMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || undefined };
}

function normalizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? user.full_name ?? null,
  };
}

async function buildAuthResponse(user, token) {
  const normalizedUser = normalizeUser(user);
  let dashboard = { candidate: null, latestSkillResult: null, latestChatSession: null };

  try {
    const { getCandidateDashboardForAuthUser } = await import('../agentRuntimeDb.mjs');
    dashboard = await getCandidateDashboardForAuthUser(normalizedUser.id, normalizedUser.email);
  } catch (err) {
    console.warn('[auth] Unable to load persisted profile snapshot:', err.message);
  }

  return {
    user: {
      ...normalizedUser,
      profileComplete: Boolean(dashboard.candidate),
      candidate: dashboard.candidate,
      latestSkillResult: dashboard.latestSkillResult,
      latestChatSession: dashboard.latestChatSession,
    },
    ...(token ? { token } : {}),
  };
}

// GET /api/auth/csrf-token - call before register/login/logout to obtain a
// token to echo back in the X-CSRF-Token header.
authRouter.get('/csrf-token', (req, res) => {
  issueCsrfToken(req, res);
});

// POST /api/auth/register
authRouter.post('/register', registerRateLimiter, requireCsrfToken, async (req, res) => {
  const { success, data, error } = validate(registerSchema, req.body);
  if (!success) {
    return res.status(400).json({ error });
  }

  try {
    const user = await registerUser(data);
    const accessToken = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user, clientMeta(req));
    setSessionCookies(res, { accessToken, refreshToken }, { rememberDevice: data.rememberDevice !== false });
    return res.status(201).json(await buildAuthResponse(user, accessToken));
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', loginRateLimiter, requireCsrfToken, async (req, res) => {
  const { success, data, error } = validate(loginSchema, req.body);
  if (!success) {
    return res.status(400).json({ error });
  }

  try {
    const user = await authenticateUser({ ...data, ...clientMeta(req) });
    const accessToken = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user, clientMeta(req));
    setSessionCookies(res, { accessToken, refreshToken }, { rememberDevice: data.rememberDevice !== false });
    return res.status(200).json(await buildAuthResponse(user, accessToken));
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/google - exchanges a verified Google Identity Services
// credential (ID token) for a SkillPath session. See server/auth/googleAuth.mjs
// for the token-verification step.
authRouter.post('/google', loginRateLimiter, requireCsrfToken, async (req, res) => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) {
    return res.status(400).json({ error: 'Missing Google credential.' });
  }

  try {
    const profile = await verifyGoogleIdToken(idToken);
    const user = await findOrCreateGoogleUser({ ...profile, ...clientMeta(req) });
    const accessToken = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user, clientMeta(req));
    setSessionCookies(res, { accessToken, refreshToken });
    return res.status(200).json(await buildAuthResponse(user, accessToken));
  } catch (err) {
    if (err instanceof AuthError || err.status) {
      return res.status(err.status || 401).json({ error: err.message, code: err.code });
    }
    console.error('Google sign-in error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/auth/github/start - full-page redirect into GitHub's consent
// screen. Uses the OAuth "state" parameter (stored in a short-lived cookie)
// as CSRF protection, since this is a browser navigation, not a fetch that
// can carry a custom X-CSRF-Token header.
authRouter.get('/github/start', loginRateLimiter, (req, res) => {
  if (!isGithubAuthConfigured()) {
    return res.redirect(`${CLIENT_ORIGIN}/?oauth=github_error&reason=not_configured`);
  }

  const state = crypto.randomBytes(24).toString('base64url');
  res.cookie('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Must be Lax (not Strict): this cookie has to be sent back on the
    // top-level GET redirect GitHub sends the browser to, which is a
    // cross-site navigation from github.com's point of view.
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/api/auth/github',
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GET /api/auth/github/callback - GitHub redirects the browser here after
// the user approves or denies access.
authRouter.get('/github/callback', loginRateLimiter, async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const cookieState = req.cookies?.github_oauth_state;
  res.clearCookie('github_oauth_state', { path: '/api/auth/github' });

  if (oauthError) {
    return res.redirect(`${CLIENT_ORIGIN}/?oauth=github_error&reason=denied`);
  }

  const stateIsValid =
    typeof code === 'string' &&
    typeof state === 'string' &&
    typeof cookieState === 'string' &&
    state.length === cookieState.length &&
    crypto.timingSafeEqual(Buffer.from(state), Buffer.from(cookieState));

  if (!stateIsValid) {
    return res.redirect(`${CLIENT_ORIGIN}/?oauth=github_error&reason=invalid_state`);
  }

  try {
    const profile = await exchangeGithubCode(code);
    const user = await findOrCreateGithubUser({ ...profile, ...clientMeta(req) });
    const accessToken = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user, clientMeta(req));
    setSessionCookies(res, { accessToken, refreshToken });
    return res.redirect(`${CLIENT_ORIGIN}/?oauth=github_success`);
  } catch (err) {
    console.error('GitHub sign-in error:', err);
    const reason = err.code === 'GITHUB_EMAIL_UNVERIFIED' ? 'email_unverified' : 'failed';
    return res.redirect(`${CLIENT_ORIGIN}/?oauth=github_error&reason=${reason}`);
  }
});

// POST /api/auth/forgot-password - always responds with the same generic
// message whether or not the email belongs to an account, so this
// endpoint can't be used to check which emails are registered. If it
// does belong to a password-based account, a 6-digit code is emailed to
// it, valid for 10 minutes.
authRouter.post('/forgot-password', forgotPasswordRateLimiter, requireCsrfToken, async (req, res) => {
  const { success, data, error } = validate(forgotPasswordSchema, req.body);
  if (!success) {
    return res.status(400).json({ error });
  }

  try {
    await requestPasswordReset({ ...data, ipAddress: req.ip });
  } catch (err) {
    // Never let a failure here (e.g. the mail provider being down) leak
    // through as a different response - log it and still return the
    // generic message below.
    console.error('Forgot-password error:', err);
  }

  return res.status(200).json({
    message: 'If an account exists for that email, a verification code has been sent.',
  });
});

// POST /api/auth/reset-password - verifies the emailed code and sets a
// new password. Also revokes every existing session on success.
authRouter.post('/reset-password', resetPasswordRateLimiter, requireCsrfToken, async (req, res) => {
  const { success, data, error } = validate(resetPasswordSchema, req.body);
  if (!success) {
    return res.status(400).json({ error });
  }

  try {
    await resetPasswordWithOtp(data);
    return res.status(200).json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('Reset-password error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/refresh - rotates the refresh token and issues a new
// short-lived access token. Called silently by the frontend when a request
// comes back 401.
authRouter.post('/refresh', refreshRateLimiter, requireCsrfToken, async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawRefreshToken) {
    return res.status(401).json({ error: 'No active session.' });
  }

  try {
    const { user, refreshToken } = await rotateRefreshToken(rawRefreshToken, clientMeta(req));
    const accessToken = issueAccessToken(user);
    setSessionCookies(res, { accessToken, refreshToken });
    return res.json(await buildAuthResponse(user, accessToken));
  } catch (err) {
    clearSessionCookies(res);
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/profile - persists the one-time candidate setup for the
// signed-in account so future logins can open the dashboard directly.
authRouter.post('/profile', requireCsrfToken, requireAuth, async (req, res) => {
  const { success, data, error } = validate(profileSetupSchema, req.body);
  if (!success) {
    return res.status(400).json({ error });
  }

  try {
    const profile = {
      ...data,
      email: req.auth.email,
    };
    const { upsertCandidate } = await import('../agentRuntimeDb.mjs');
    await upsertCandidate(profile, req.auth.sub);
    return res.status(200).json(await buildAuthResponse({ id: req.auth.sub, email: req.auth.email }));
  } catch (err) {
    const status = Number(err.statusCode || err.status) || 500;
    if (status >= 500) console.error('Profile setup error:', err);
    return res.status(status).json({ error: err.message || 'Unable to save profile setup.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', requireCsrfToken, async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];
  await revokeRefreshToken(rawRefreshToken);
  clearSessionCookies(res);
  return res.status(204).end();
});

// GET /api/auth/me - resolves the current session from the access token or bearer header.
authRouter.get('/me', async (req, res) => {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;
  const token = bearerToken || req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  try {
    const payload = verifyAccessToken(token);
    return res.json(await buildAuthResponse({ id: payload.sub, email: payload.email }));
  } catch {
    return res.status(401).json({ error: 'Session expired.' });
  }
});

/**
 * Express middleware for protecting any other route in the app that
 * requires a signed-in user or candidate.
 */
export function requireAuth(req, res, next) {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;
  const token = bearerToken || req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired.' });
  }
}
