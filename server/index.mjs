/**
 * server/index.mjs  (v2 — DB + JWT)
 *
 * Replaces the original in-memory server with:
 *  - POST /api/auth/login        → upsert candidate, return JWT
 *  - GET  /api/auth/me           → validate JWT, return candidate profile
 *  - POST /api/agent/start       → JWT-gated, DB-backed chatbot session start
 *  - POST /api/agent/answer      → JWT-gated answer submission
 *  - POST /api/agent/proctor     → JWT-gated proctor event
 *  - GET  /api/agent/session     → JWT-gated session fetch
 *  - POST /api/skill-assessment  → JWT-gated MCQ assessment creation
 *  - POST /api/skill-assessment/submit  → JWT-gated MCQ submission
 *  - POST /api/skill-assessment/proctor → JWT-gated MCQ proctor event
 *  - GET  /api/health            → public health check
 */
import http from 'node:http';
import bcrypt from 'bcrypt';
import { requireAuth, signToken } from './auth.mjs';
import { query } from './db.mjs';
import {
  createSkillAssessment,
  getAgenticSession,
  recordProctorEvent,
  recordSkillAssessmentProctorEvent,
  startAgenticSession,
  submitAgenticAnswer,
  submitSkillAssessment,
  upsertCandidate,
} from './agentRuntimeDb.mjs';
import { geminiModel, isGeminiConfigured } from './geminiClient.mjs';

const PORT = Number(process.env.API_PORT || 8787);
const MAX_BODY_BYTES = 1_000_000;

// ── CORS headers for local dev ────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        const error = new Error('Request body is too large.');
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error('Request body must be valid JSON.');
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function routeKey(method, pathname) {
  return `${method.toUpperCase()} ${pathname}`;
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  try {
    // ── Public routes ───────────────────────────────────────────────────────

    if (routeKey(req.method, url.pathname) === 'GET /api/health') {
      sendJson(res, 200, {
        ok: true,
        geminiConfigured: isGeminiConfigured(),
        model: geminiModel(),
        dbConnected: true,
      });
      return;
    }

    // POST /api/auth/login - upsert candidate by email + return JWT
    if (routeKey(req.method, url.pathname) === 'POST /api/auth/login') {
      const body = await readJson(req);
      const email = String(body?.email || '').trim().toLowerCase();

      if (!email || !email.includes('@')) {
        sendJson(res, 400, { error: 'A valid email address is required.' });
        return;
      }

      let password_hash = null;
      if (body?.password) {
        password_hash = await bcrypt.hash(body.password, 10);
      }

      // Build full profile from body
      const profileInput = {
        name: body?.name || body?.profile?.name || 'Candidate',
        email,
        username: body?.username || null,
        password_hash,
        qualification: body?.qualification || body?.profile?.qualification || '',
        domain: body?.domain || body?.profile?.domain || 'Full Stack Engineering',
        interestedRoles: body?.interestedRoles || body?.profile?.interestedRoles || [],
        claimedSkills: body?.claimedSkills || body?.profile?.claimedSkills || [],
      };

      const candidate = await upsertCandidate(profileInput);
      const token = signToken(candidate.id);

      sendJson(res, 200, {
        token,
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          qualification: candidate.qualification,
          selectedDomain: candidate.selected_domain,
          assessmentDomain: candidate.assessment_domain,
          interestedRoles: candidate.interested_roles || [],
          claimedSkills: candidate.claimed_skills || [],
        },
      });
      return;
    }

    // POST /api/auth/login_credentials - login with username + password
    if (routeKey(req.method, url.pathname) === 'POST /api/auth/login_credentials') {
      const body = await readJson(req);
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');

      if (!username || !password) {
        sendJson(res, 400, { error: 'Username and password are required.' });
        return;
      }

      const { rows } = await query(`SELECT * FROM candidates WHERE username = $1 OR email = $1`, [username]);
      if (!rows.length) {
        sendJson(res, 401, { error: 'Invalid username or password.' });
        return;
      }

      const candidate = rows[0];
      if (!candidate.password_hash) {
        sendJson(res, 401, { error: 'Invalid username or password (no password set).' });
        return;
      }

      const match = await bcrypt.compare(password, candidate.password_hash);
      if (!match) {
        sendJson(res, 401, { error: 'Invalid username or password.' });
        return;
      }

      const token = signToken(candidate.id);
      sendJson(res, 200, {
        token,
        candidate: {
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          qualification: candidate.qualification,
          selectedDomain: candidate.selected_domain,
          assessmentDomain: candidate.assessment_domain,
          interestedRoles: candidate.interested_roles || [],
          claimedSkills: candidate.claimed_skills || [],
        },
      });
      return;
    }

    // ── Protected routes ────────────────────────────────────────────────────

    // GET /api/auth/me — return authenticated candidate profile
    if (routeKey(req.method, url.pathname) === 'GET /api/auth/me') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const { rows } = await query(`SELECT * FROM candidates WHERE id = $1`, [auth.sub]);
      if (!rows.length) {
        sendJson(res, 404, { error: 'Candidate not found.' });
        return;
      }

      const c = rows[0];
      sendJson(res, 200, {
        id: c.id,
        name: c.name,
        email: c.email,
        qualification: c.qualification,
        selectedDomain: c.selected_domain,
        assessmentDomain: c.assessment_domain,
        interestedRoles: c.interested_roles || [],
        claimedSkills: c.claimed_skills || [],
        createdAt: c.created_at,
      });
      return;
    }

    // POST /api/agent/start — start chatbot session
    if (routeKey(req.method, url.pathname) === 'POST /api/agent/start') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const body = await readJson(req);
      const session = await startAgenticSession(body.profile, auth.sub);
      sendJson(res, 200, session);
      return;
    }

    // POST /api/agent/answer — submit chatbot answer
    if (routeKey(req.method, url.pathname) === 'POST /api/agent/answer') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const body = await readJson(req);
      const session = await submitAgenticAnswer(body.sessionId, body, auth.sub);
      sendJson(res, 200, session);
      return;
    }

    // POST /api/agent/proctor — record chatbot proctor event
    if (routeKey(req.method, url.pathname) === 'POST /api/agent/proctor') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const body = await readJson(req);
      const session = await recordProctorEvent(body.sessionId, body, auth.sub);
      sendJson(res, 200, session);
      return;
    }

    // GET /api/agent/session — fetch chatbot session
    if (routeKey(req.method, url.pathname) === 'GET /api/agent/session') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const sessionId = url.searchParams.get('sessionId') || '';
      const session = await getAgenticSession(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Assessment session was not found.' });
        return;
      }
      sendJson(res, 200, session);
      return;
    }

    // POST /api/skill-assessment — create MCQ assessment
    if (routeKey(req.method, url.pathname) === 'POST /api/skill-assessment') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const body = await readJson(req);
      const assessment = await createSkillAssessment(body.profile, auth.sub);
      sendJson(res, 200, assessment);
      return;
    }

    // POST /api/skill-assessment/submit — submit MCQ answers
    if (routeKey(req.method, url.pathname) === 'POST /api/skill-assessment/submit') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const body = await readJson(req);
      const result = await submitSkillAssessment(body.assessmentId, body.answers, body.timedOut, auth.sub);
      sendJson(res, 200, result);
      return;
    }

    // POST /api/skill-assessment/proctor — record MCQ proctor event
    if (routeKey(req.method, url.pathname) === 'POST /api/skill-assessment/proctor') {
      const auth = requireAuth(req, res, sendJson);
      if (!auth) return;

      const body = await readJson(req);
      const assessment = await recordSkillAssessmentProctorEvent(body.assessmentId, body, auth.sub);
      sendJson(res, 200, assessment);
      return;
    }

    sendJson(res, 404, { error: 'Route not found.' });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    console.error(`[api] ${req.method} ${url.pathname} → ${statusCode}:`, error.message);
    sendJson(res, statusCode, {
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
}

http
  .createServer((req, res) => {
    void handleRequest(req, res);
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`SkillPath API v2 (DB + JWT) listening on http://localhost:${PORT}`);
    console.log(`  Gemini configured: ${isGeminiConfigured()}`);
    console.log(`  Model: ${geminiModel()}`);
  });
