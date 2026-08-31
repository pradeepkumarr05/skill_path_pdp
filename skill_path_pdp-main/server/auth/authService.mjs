import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { query } from '../db/pool.mjs';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from './tokens.mjs';
import { encryptSecret } from './crypto.mjs';
import { sendPasswordResetOtpEmail } from './mailer.mjs';

const BCRYPT_COST_FACTOR = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

// Generic, identical-looking errors for "no such user" and "wrong password"
// so the login endpoint never reveals whether an email is registered.
const INVALID_CREDENTIALS = { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' };

class AuthError extends Error {
  constructor({ code, message, status = 400 }) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  return rows[0] || null;
}

export async function registerUser({ email, password, fullName }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    // Same generic response as a real conflict avoided; still 409 here is
    // acceptable for registration (unlike login) since account existence
    // has to be discoverable to prevent duplicate signups anyway.
    throw new AuthError({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists.', status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

  const { rows } = await query(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, full_name, created_at`,
    [email, passwordHash, fullName || null],
  );

  return rows[0];
}

export async function authenticateUser({ email, password, ipAddress, userAgent }) {
  const user = await findUserByEmail(email);

  if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
    await recordLoginAttempt({ email, success: false, reason: 'ACCOUNT_LOCKED', ipAddress, userAgent });
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new AuthError({
      code: 'ACCOUNT_LOCKED',
      message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      status: 423,
    });
  }

  if (!user || !user.is_active) {
    // Run a dummy hash comparison even when the user doesn't exist so the
    // response time doesn't leak whether the email is registered (timing
    // side-channel mitigation).
    await bcrypt.compare(password, '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7t3o3zJHYzUNRs.9YxvR8Q9pQmY8Xxe');
    await recordLoginAttempt({ email, success: false, reason: 'NO_SUCH_USER', ipAddress, userAgent });
    throw new AuthError({ ...INVALID_CREDENTIALS, status: 401 });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    await handleFailedAttempt(user);
    await recordLoginAttempt({ email, success: false, reason: 'BAD_PASSWORD', ipAddress, userAgent });
    throw new AuthError({ ...INVALID_CREDENTIALS, status: 401 });
  }

  await query(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now()
     WHERE id = $1`,
    [user.id],
  );
  await recordLoginAttempt({ email, success: true, ipAddress, userAgent });

  return { id: user.id, email: user.email, fullName: user.full_name };
}

async function handleFailedAttempt(user) {
  const attempts = user.failed_login_attempts + 1;
  const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

  await query(
    `UPDATE users
     SET failed_login_attempts = $2,
         locked_until = CASE WHEN $3 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = $1`,
    [user.id, attempts, shouldLock],
  );

  if (shouldLock) {
    throw new AuthError({
      code: 'ACCOUNT_LOCKED',
      message: `Too many failed attempts. Your account is locked for ${LOCKOUT_DURATION_MS / 60000} minutes.`,
      status: 423,
    });
  }
}

async function recordLoginAttempt({ email, success, reason = null, ipAddress, userAgent }) {
  await query(
    `INSERT INTO login_audit_log (email, success, reason, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [email, success, reason, ipAddress || null, userAgent || null],
  );
}

export function issueAccessToken(user) {
  return signAccessToken({ id: user.id, email: user.email });
}
export async function issueRefreshToken(user, { ipAddress, userAgent } = {}) {
  const { raw, hash, expiresAt } = generateRefreshToken();
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, hash, expiresAt, ipAddress || null, userAgent || null],
  );
  return raw;
}

export async function rotateRefreshToken(rawToken, { ipAddress, userAgent } = {}) {
  const hash = hashRefreshToken(rawToken);
  const { rows } = await query(
    `SELECT rt.*, u.id AS user_id, u.email, u.full_name, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 LIMIT 1`,
    [hash],
  );
  const record = rows[0];

  if (!record || record.revoked_at || new Date(record.expires_at) < new Date() || !record.is_active) {
    throw new AuthError({ code: 'INVALID_SESSION', message: 'Session expired. Please sign in again.', status: 401 });
  }

  // Rotate: revoke the used token and issue a new one. If a revoked token
  // is ever presented again, that's a signal of token theft/replay.
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [record.id]);

  const user = { id: record.user_id, email: record.email, fullName: record.full_name };
  const newRawToken = await issueRefreshToken(user, { ipAddress, userAgent });

  return { user, refreshToken: newRawToken };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const hash = hashRefreshToken(rawToken);
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hash]);
}

/**
 * Finds an existing Google-linked user, links Google to an existing
 * password account with the same (verified) email, or creates a brand
 * new Google-only account (password_hash stays null).
 */
export async function findOrCreateGoogleUser({ googleId, email, fullName, ipAddress, userAgent }) {
  const { rows: byGoogleId } = await query('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [googleId]);
  if (byGoogleId[0]) {
    if (!byGoogleId[0].is_active) {
      throw new AuthError({ code: 'ACCOUNT_DISABLED', message: 'This account is disabled.', status: 403 });
    }
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [byGoogleId[0].id]);
    await recordLoginAttempt({ email, success: true, reason: 'GOOGLE', ipAddress, userAgent });
    return { id: byGoogleId[0].id, email: byGoogleId[0].email, fullName: byGoogleId[0].full_name };
  }

  const existingByEmail = await findUserByEmail(email);
  if (existingByEmail) {
    if (!existingByEmail.is_active) {
      throw new AuthError({ code: 'ACCOUNT_DISABLED', message: 'This account is disabled.', status: 403 });
    }
    // Link Google to the existing password account. Safe because Google
    // already told us this email is verified (checked in googleAuth.mjs).
    const { rows } = await query(
      `UPDATE users SET google_id = $2, last_login_at = now() WHERE id = $1
       RETURNING id, email, full_name`,
      [existingByEmail.id, googleId],
    );
    await recordLoginAttempt({ email, success: true, reason: 'GOOGLE_LINKED', ipAddress, userAgent });
    return { id: rows[0].id, email: rows[0].email, fullName: rows[0].full_name };
  }

  const { rows } = await query(
    `INSERT INTO users (email, google_id, full_name, last_login_at)
     VALUES ($1, $2, $3, now())
     RETURNING id, email, full_name`,
    [email, googleId, fullName],
  );
  await recordLoginAttempt({ email, success: true, reason: 'GOOGLE_NEW_ACCOUNT', ipAddress, userAgent });
  return rows[0];
}

/**
 * Best-effort: if ENCRYPTION_KEY isn't configured, the OAuth login still
 * succeeds - we just skip persisting the provider access token, since it's
 * only needed for optional future API calls, never for authentication
 * itself.
 */
function safeEncrypt(token) {
  if (!token) return null;
  try {
    return encryptSecret(token);
  } catch (err) {
    console.warn('Skipping OAuth token storage:', err.message);
    return null;
  }
}

export async function findOrCreateGithubUser({ githubId, email, fullName, accessToken, ipAddress, userAgent }) {
  const encryptedToken = safeEncrypt(accessToken);

  const { rows: byGithubId } = await query('SELECT * FROM users WHERE github_id = $1 LIMIT 1', [githubId]);
  if (byGithubId[0]) {
    if (!byGithubId[0].is_active) {
      throw new AuthError({ code: 'ACCOUNT_DISABLED', message: 'This account is disabled.', status: 403 });
    }
    await query(
      `UPDATE users
       SET last_login_at = now(), github_access_token_enc = COALESCE($2, github_access_token_enc)
       WHERE id = $1`,
      [byGithubId[0].id, encryptedToken],
    );
    await recordLoginAttempt({ email, success: true, reason: 'GITHUB', ipAddress, userAgent });
    return { id: byGithubId[0].id, email: byGithubId[0].email, fullName: byGithubId[0].full_name };
  }

  const existingByEmail = await findUserByEmail(email);
  if (existingByEmail) {
    if (!existingByEmail.is_active) {
      throw new AuthError({ code: 'ACCOUNT_DISABLED', message: 'This account is disabled.', status: 403 });
    }
    // Link GitHub to the existing account. Safe because GitHub already
    // told us this email is verified (checked in githubAuth.mjs).
    const { rows } = await query(
      `UPDATE users
       SET github_id = $2, github_access_token_enc = COALESCE($3, github_access_token_enc), last_login_at = now()
       WHERE id = $1
       RETURNING id, email, full_name`,
      [existingByEmail.id, githubId, encryptedToken],
    );
    await recordLoginAttempt({ email, success: true, reason: 'GITHUB_LINKED', ipAddress, userAgent });
    return rows[0];
  }

  const { rows } = await query(
    `INSERT INTO users (email, github_id, github_access_token_enc, full_name, last_login_at)
     VALUES ($1, $2, $3, $4, now())
     RETURNING id, email, full_name`,
    [email, githubId, encryptedToken, fullName],
  );
  await recordLoginAttempt({ email, success: true, reason: 'GITHUB_NEW_ACCOUNT', ipAddress, userAgent });
  return rows[0];
}

function generateOtp() {
  // crypto.randomInt is uniformly distributed (unlike Math.random), and
  // zero-padded so codes like "004821" don't get truncated to 5 digits.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function invalidOtpError() {
  return new AuthError({ code: 'INVALID_OTP', message: 'That code is incorrect or has expired.', status: 400 });
}

/**
 * Starts a "forgot password" reset: if the email belongs to a real,
 * password-based account, emails a one-time code and stores only its
 * hash. Deliberately resolves the same way (no return value, no thrown
 * error) whether or not the account exists, was created via Google/GitHub
 * only, or is disabled - the route handler always sends back the same
 * generic response, so this can't be used to enumerate registered emails.
 */
export async function requestPasswordReset({ email, ipAddress }) {
  const user = await findUserByEmail(email);

  if (!user || !user.is_active || !user.password_hash) {
    return;
  }

  const otp = generateOtp();
  await query(
    `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at, ip_address)
     VALUES ($1, $2, now() + interval '${OTP_TTL_MINUTES} minutes', $3)`,
    [user.id, hashOtp(otp), ipAddress || null],
  );

  await sendPasswordResetOtpEmail(user.email, otp);
}

/**
 * Verifies a previously emailed OTP and, if it matches and hasn't expired
 * or been used up, sets a new password. Also revokes every existing
 * refresh token for the account (forces re-login everywhere), since a
 * password reset is often triggered by a suspected compromise.
 */
export async function resetPasswordWithOtp({ email, otp, newPassword }) {
  const user = await findUserByEmail(email);

  // Same generic "invalid code" error whether the account doesn't exist,
  // has no password to reset, or the code truly doesn't match - avoids
  // leaking account existence through this endpoint too.
  if (!user || !user.password_hash) {
    throw invalidOtpError();
  }

  const { rows } = await query(
    `SELECT * FROM password_reset_otps
     WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [user.id],
  );
  const record = rows[0];

  if (!record) {
    throw invalidOtpError();
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new AuthError({
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Too many incorrect attempts. Request a new code.',
      status: 429,
    });
  }

  const providedHash = hashOtp(otp);
  const storedHash = record.otp_hash;
  const matches =
    providedHash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));

  if (!matches) {
    await query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    throw invalidOtpError();
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);

  await query('UPDATE password_reset_otps SET consumed_at = now() WHERE id = $1', [record.id]);
  await query(
    `UPDATE users
     SET password_hash = $2, failed_login_attempts = 0, locked_until = NULL
     WHERE id = $1`,
    [user.id, passwordHash],
  );
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [user.id],
  );
}

export { AuthError };
