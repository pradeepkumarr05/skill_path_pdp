import http from 'node:http';
import { requireAuth } from './auth.mjs';
import { query, withTransaction } from './db.mjs';
import { authenticate, publicCandidate, saveProfile } from './accountService.mjs';
import { createSkillAssessment, getAgenticSession, recordProctorEvent, recordSkillAssessmentProctorEvent,
  startAgenticSession, submitAgenticAnswer, submitSkillAssessment } from './agentRuntimeDb.mjs';
import { geminiModel, isGeminiConfigured } from './geminiClient.mjs';
import { uploadDocument } from './documents.mjs';

const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const attempts = new Map();
setInterval(() => { const now = Date.now(); for (const [key, value] of attempts) if (value.until < now) attempts.delete(key); }, 60000).unref();
function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 7500000) throw Object.assign(new Error('Request body is too large.'), { statusCode: 413 });
  }
  try { const value = JSON.parse(body || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }); }
}
async function handleRequest(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (req.headers.origin && req.headers.origin !== origin) return sendJson(res, 403, { error: 'Origin is not allowed.' });
    if (req.method === 'OPTIONS') return sendJson(res, 204, null);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      await query('SELECT 1');
      return sendJson(res, 200, { ok: true, dbConnected: true, geminiConfigured: isGeminiConfigured(), model: geminiModel() });
    }
    if (req.method === 'POST' && ['/api/auth/register', '/api/auth/google', '/api/auth/login_credentials'].includes(url.pathname)) {
      const key = req.socket.remoteAddress;
      const counter = attempts.get(key) || { count: 0, until: Date.now() + 60000 };
      if (counter.until < Date.now()) { counter.count = 0; counter.until = Date.now() + 60000; }
      attempts.set(key, counter);
      if (++counter.count > 20) return sendJson(res, 429, { error: 'Too many sign-in attempts. Try again in a minute.' });
      return sendJson(res, 200, await authenticate(await readJson(req), url.pathname.split('/').pop()));
    }
    const auth = requireAuth(req, res, sendJson);
    if (!auth) return;
    const { rows } = await query('SELECT * FROM candidates WHERE id=$1', [auth.sub]);
    if (!rows[0]) return sendJson(res, 401, { error: 'Account no longer exists.' });
    const candidate = rows[0];
    if (req.method === 'GET' && url.pathname === '/api/auth/me') return sendJson(res, 200, await publicCandidate(candidate));
    if (req.method === 'POST' && url.pathname === '/api/auth/document') return sendJson(res, 200, await uploadDocument(auth.sub, await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/auth/profile') {
      const body = await readJson(req);
      const result = await withTransaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [auth.sub]);
        return saveProfile(auth.sub, body);
      });
      return sendJson(res, 200, result);
    }
    if (!candidate.profile_complete) return sendJson(res, 409, { error: 'Complete your profile before starting an assessment.' });
    const profile = { name: candidate.name, email: candidate.email, qualification: candidate.qualification,
      domain: candidate.selected_domain, interestedRoles: candidate.interested_roles, claimedSkills: candidate.claimed_skills };
    if (req.method === 'GET' && url.pathname === '/api/agent/session') {
      const id = url.searchParams.get('sessionId');
      const owned = await query('SELECT id FROM chat_sessions WHERE id=$1 AND candidate_id=$2', [id, auth.sub]);
      if (!owned.rows.length) return sendJson(res, 404, { error: 'Assessment session was not found.' });
      return sendJson(res, 200, await getAgenticSession(id));
    }
    if (req.method !== 'POST') return sendJson(res, 404, { error: 'Route not found.' });
    const body = await readJson(req);
    const result = await withTransaction(async client => {
    // Serialize each candidate's assessment mutations across API processes.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [auth.sub]);
    switch (url.pathname) {
      case '/api/agent/start': return startAgenticSession(profile, auth.sub);
      case '/api/agent/answer': return submitAgenticAnswer(body.sessionId, body, auth.sub);
      case '/api/agent/proctor': return recordProctorEvent(body.sessionId, body, auth.sub);
      case '/api/skill-assessment': return createSkillAssessment(profile, auth.sub);
      case '/api/skill-assessment/submit': return submitSkillAssessment(body.assessmentId, body.answers, body.timedOut, auth.sub);
      case '/api/skill-assessment/proctor': return recordSkillAssessmentProctorEvent(body.assessmentId, body, auth.sub);
      default: throw Object.assign(new Error('Route not found.'), { statusCode: 404 });
    }
    });
    sendJson(res, 200, result);
  } catch (error) {
    const status = Number(error.statusCode) || (error.code === '22P02' ? 400 : 500);
    console.error(`[api] ${req.method} ${url.pathname}:`, error.message);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'The service could not complete your request. Please try again.' : error.message });
  }
}
http.createServer((req, res) => void handleRequest(req, res)).listen(Number(process.env.API_PORT || 8787), '0.0.0.0', () => console.log('SkillPath API listening'));
