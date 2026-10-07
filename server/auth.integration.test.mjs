import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { SMTPServer } from 'smtp-server';
import pool, { query } from './db.mjs';

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}

test('Authentication: HTTP, PostgreSQL, and SMTP lifecycle', { timeout: 90000 }, async t => {
  const mail = [];
  const smtp = new SMTPServer({ secure: false, disabledCommands: ['STARTTLS'],
    onAuth(auth, session, callback) { callback(null, { user: auth.username }); },
    onData(stream, session, callback) {
      let body = ''; stream.on('data', chunk => { body += chunk; });
      stream.on('end', () => { mail.push(body.replace(/=\r?\n/g, '').replace(/=3D/g, '=')); callback(); });
    },
  });
  smtp.listen(0, '127.0.0.1'); await once(smtp.server, 'listening');
  const port = await freePort();
  const api = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env,
    API_PORT: String(port), SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.server.address().port), SMTP_SECURE: 'false',
    SMTP_USER: 'auth-test', SMTP_PASS: randomUUID(), SMTP_FROM: 'SkillPath <test@example.com>',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; api.stderr.on('data', chunk => { logs += chunk; });
  const base = `http://127.0.0.1:${port}`;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `auth-${suffix}@example.com`, username = `auth_${suffix}`;
  const password = 'OriginalPassword123!';
  let candidateId, token, resetToken;
  t.after(async () => {
    api.kill('SIGTERM'); await once(api, 'exit').catch(() => {});
    await new Promise(resolve => smtp.close(resolve));
    if (candidateId) await query('DELETE FROM candidates WHERE id=$1', [candidateId]);
    await pool.end();
  });
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) break; } catch {}
    if (i === 99) throw new Error(`API did not start: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const request = async (path, body, bearer = token, method = 'POST') => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) });
    return { status: response.status, body: await response.json() };
  };
  const latestToken = purpose => {
    const entry = [...mail].reverse().find(value => value.includes(`#auth=${purpose}`));
    assert.ok(entry, `SMTP received ${purpose} email`);
    const match = entry.match(/token=([a-f0-9]{64})/); assert.ok(match); return match[1];
  };
  await t.test('registration delivers an actual SMTP verification message and creates an unverified account', async () => {
    const response = await request('/api/auth/register', { username, email, password }, null);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    candidateId = response.body.candidate.id; token = response.body.token;
    assert.equal(response.body.candidate.emailVerified, false); assert.equal(response.body.verificationSent, true);
    assert.ok(latestToken('verify'));
    const stored = await query('SELECT token_hash FROM account_tokens WHERE candidate_id=$1', [candidateId]);
    assert.notEqual(stored.rows[0].token_hash, latestToken('verify'));
  });
  await t.test('unverified users cannot save a profile or start assessments', async () => {
    assert.equal((await request('/api/auth/profile', {})).status, 403);
    assert.equal((await request('/api/skill-assessment', {})).status, 403);
  });
  await t.test('resend cooldown, invalid link, and password validation are enforced', async () => {
    assert.equal((await request('/api/auth/resend-verification', {})).status, 429);
    assert.equal((await request('/api/auth/verify-email', { token: 'invalid' }, null)).status, 400);
    assert.equal((await request('/api/auth/login_credentials', { username, password: 'wrong' }, null)).status, 401);
  });
  await t.test('email verification is single-use and persists across account restoration', async () => {
    const verification = latestToken('verify');
    assert.equal((await request('/api/auth/verify-email', { token: verification }, null)).status, 200);
    assert.equal((await request('/api/auth/verify-email', { token: verification }, null)).status, 400);
    const restored = await request('/api/auth/me', null, token, 'GET');
    assert.equal(restored.body.candidate, undefined); assert.equal(restored.body.emailVerified, true);
    assert.equal(restored.body.profileComplete, false);
    assert.equal((await request('/api/skill-assessment', {})).status, 409);
  });
  await t.test('logout revokes the bearer token on the server', async () => {
    assert.equal((await request('/api/auth/logout', {})).status, 200);
    assert.equal((await request('/api/auth/me', null, token, 'GET')).status, 401);
    const signedIn = await request('/api/auth/login_credentials', { username: email.toUpperCase(), password }, null);
    assert.equal(signedIn.status, 200); token = signedIn.body.token;
  });
  await t.test('password reset request does not reveal whether an email exists', async () => {
    const known = await request('/api/auth/forgot-password', { email }, null);
    const unknown = await request('/api/auth/forgot-password', { email: `missing-${suffix}@example.com` }, null);
    assert.equal(known.status, 200); assert.deepEqual(known, unknown); resetToken = latestToken('reset');
  });
  await t.test('wrong-purpose and weak-password attempts do not consume reset tokens', async () => {
    assert.equal((await request('/api/auth/verify-email', { token: resetToken }, null)).status, 400);
    assert.equal((await request('/api/auth/reset-password', { token: resetToken, password: 'short' }, null)).status, 400);
  });
  await t.test('reset changes the password, invalidates all sessions, and cannot be replayed', async () => {
    const newPassword = 'ReplacementPassword123!';
    const body = { token: resetToken, password: newPassword };
    const results = await Promise.all([request('/api/auth/reset-password', body, null), request('/api/auth/reset-password', body, null)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal((await request('/api/auth/me', null, token, 'GET')).status, 401);
    assert.equal((await request('/api/auth/login_credentials', { username, password }, null)).status, 401);
    const signedIn = await request('/api/auth/login_credentials', { username, password: newPassword }, null);
    assert.equal(signedIn.status, 200); token = signedIn.body.token;
  });
  await t.test('expired links are rejected', async () => {
    await request('/api/auth/forgot-password', { email }, null);
    const expired = latestToken('reset');
    await query('UPDATE account_tokens SET expires_at=NOW()-INTERVAL \'1 minute\' WHERE candidate_id=$1', [candidateId]);
    assert.equal((await request('/api/auth/reset-password', { token: expired, password: 'AnotherPassword123!' }, null)).status, 400);
  });
  await t.test('forged Google tokens and foreign origins are rejected', async () => {
    assert.ok([401,503].includes((await request('/api/auth/google', { credential: 'forged' }, null)).status));
    const response = await fetch(`${base}/api/auth/me`, { headers: { Origin: 'https://untrusted.example', Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 403);
  });
  await t.test('authentication rate limiting is enforced', async () => {
    let status;
    for (let i = 0; i < 22; i++) status = (await request('/api/auth/login_credentials', { username, password: 'wrong' }, null)).status;
    assert.equal(status, 429);
  });
});
