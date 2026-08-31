import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const DEFAULT_DEV_SECRET = 'skillpath-dev-secret-key-32-chars-minimum-safe-length';

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET is not set (or is too short). Set a random string of at least 32 characters in .env.',
      );
    }
    return DEFAULT_DEV_SECRET;
  }
  return secret;
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    requireSecret(),
    { expiresIn: ACCESS_TOKEN_TTL, issuer: 'skillpath-api' },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, requireSecret(), { issuer: 'skillpath-api' });
}

/**
 * Refresh tokens are opaque random strings, not JWTs - the client gets the
 * raw token, but only its SHA-256 hash is ever stored server-side. Losing
 * the DB does not hand out usable sessions, and a stolen DB row can't be
 * replayed without the original random value.
 */
export function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { raw, hash, expiresAt };
}

export function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_MS / 1000;
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
