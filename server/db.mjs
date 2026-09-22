/**
 * server/db.mjs
 * PostgreSQL connection pool singleton.
 * Reads DATABASE_URL from environment (loaded by geminiClient.mjs env loader or .env).
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
const transactionContext = new AsyncLocalStorage();

const { Pool } = pg;

// ── Inline .env loader (mirrors geminiClient.mjs pattern) ──────────────────
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
// ──────────────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.warn('[db] WARNING: DATABASE_URL is not set. All DB operations will fail.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterised query and return rows.
 * @param {string} text - SQL query with $1, $2 ... placeholders
 * @param {unknown[]} [params] - Parameter values
 */
export async function query(text, params) {
  const result = await (transactionContext.getStore() || pool).query(text, params);
  return result;
}

/**
 * Get a client from the pool for transaction use.
 * Always release the client in a finally block.
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Run a callback inside a transaction.
 * Automatically commits on success or rolls back on error.
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 */
export async function withTransaction(fn) {
  const existing = transactionContext.getStore();
  if (existing) return fn(existing);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await transactionContext.run(client, () => fn(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
