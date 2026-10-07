/**
 * server/auth.mjs
 * JWT authentication helpers and middleware.
 *
 * - signToken(candidateId)   → signed JWT string
 * - verifyToken(token)        → decoded payload or throws
 * - requireAuth(req, res, next) → Express-style middleware (used inline in index.mjs)
 */
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { query } from './db.mjs';

// ── Inline .env loader ──────────────────────────────────────────────────────
let envLoaded = false;
function loadLocalEnv() {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const sepIdx = normalized.indexOf('=');
    if (sepIdx === -1) continue;
    const key = normalized.slice(0, sepIdx).trim();
    let value = normalized.slice(sepIdx + 1).trim();
    if (!key || process.env[key]) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadLocalEnv();
// ───────────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to a random value of at least 32 characters.');

/**
 * Sign a JWT token for the given candidateId.
 * @param {string} candidateId - UUID of the candidate
 * @returns {string} Signed JWT
 */
export async function signToken(candidateId) {
  const token = jwt.sign({ sub: candidateId, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    jwtid: randomUUID(),
  });
  const decoded = verifyToken(token);
  await query('INSERT INTO auth_sessions(candidate_id,token_hash,expires_at) VALUES ($1,$2,$3)', [candidateId, tokenHash(token), new Date(decoded.exp * 1000)]);
  return token;
}

export const tokenHash = token => createHash('sha256').update(token).digest('hex');

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {{ sub: string }} Decoded payload
 * @throws If token is invalid or expired
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

/**
 * Extract Bearer token from Authorization header.
 * @param {import('node:http').IncomingMessage} req
 * @returns {string | null}
 */
export function extractBearerToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Middleware-style auth guard for use in handleRequest.
 * Attaches decoded payload to req.auth if valid.
 * Returns true if auth passed, sends 401 and returns false otherwise.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {(statusCode: number, body: unknown) => void} sendJson
 * @returns {{ sub: string } | null} decoded payload or null
 */
export async function requireAuth(req, res, sendJson) {
  const token = extractBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Authorization token is required.' });
    return null;
  }
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    sendJson(res, 401, { error: 'Authorization token is invalid or expired.' });
    return null;
  }
  const session = await query('SELECT id FROM auth_sessions WHERE token_hash=$1 AND candidate_id=$2 AND expires_at>NOW()', [tokenHash(token), decoded.sub]);
  if (!session.rows.length) {
    sendJson(res, 401, { error: 'Your session has expired. Please sign in again.' });
    return null;
  }
  return decoded;
}
