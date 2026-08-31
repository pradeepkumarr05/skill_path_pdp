import crypto from 'node:crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit-cookie CSRF protection.
 *
 * - GET /api/auth/csrf-token sets a random, readable (non-httpOnly) cookie.
 * - The frontend reads that cookie and echoes it back in the X-CSRF-Token
 *   header on every state-changing request.
 * - A cross-site attacker can trick the browser into sending the cookie
 *   automatically, but JS on another origin cannot read it (browsers don't
 *   allow cross-origin cookie reads) and so cannot reproduce it in a
 *   header, which is what this check requires.
 *
 * Combined with SameSite=Strict on the session cookies themselves, this
 * gives defense in depth against CSRF.
 */
export function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.json({ csrfToken: token });
}

export function requireCsrfToken(req, res, next) {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
  }

  return next();
}
