import http from 'node:http';
import {
  createSkillAssessment,
  getAgenticSession,
  recordProctorEvent,
  recordSkillAssessmentProctorEvent,
  startAgenticSession,
  submitAgenticAnswer,
  submitSkillAssessment,
} from './agentRuntime.mjs';
import { geminiModel, isGeminiConfigured } from './geminiClient.mjs';

const PORT = Number(process.env.API_PORT || 8787);
const MAX_BODY_BYTES = 1_000_000;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
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

  try {
    if (routeKey(req.method, url.pathname) === 'GET /api/health') {
      sendJson(res, 200, {
        ok: true,
        geminiConfigured: isGeminiConfigured(),
        model: geminiModel(),
      });
      return;
    }

    if (routeKey(req.method, url.pathname) === 'POST /api/agent/start') {
      const body = await readJson(req);
      const session = await startAgenticSession(body.profile);
      sendJson(res, 200, session);
      return;
    }

    if (routeKey(req.method, url.pathname) === 'POST /api/agent/answer') {
      const body = await readJson(req);
      const session = await submitAgenticAnswer(body.sessionId, body);
      sendJson(res, 200, session);
      return;
    }

    if (routeKey(req.method, url.pathname) === 'POST /api/agent/proctor') {
      const body = await readJson(req);
      const session = recordProctorEvent(body.sessionId, body);
      sendJson(res, 200, session);
      return;
    }

    if (routeKey(req.method, url.pathname) === 'GET /api/agent/session') {
      const sessionId = url.searchParams.get('sessionId') || '';
      const session = getAgenticSession(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Assessment session was not found.' });
        return;
      }
      sendJson(res, 200, session);
      return;
    }

    if (routeKey(req.method, url.pathname) === 'POST /api/skill-assessment') {
      const body = await readJson(req);
      const assessment = await createSkillAssessment(body.profile);
      sendJson(res, 200, assessment);
      return;
    }

    if (routeKey(req.method, url.pathname) === 'POST /api/skill-assessment/submit') {
      const body = await readJson(req);
      const result = submitSkillAssessment(body.assessmentId, body.answers, body.timedOut);
      sendJson(res, 200, result);
      return;
    }

    if (routeKey(req.method, url.pathname) === 'POST /api/skill-assessment/proctor') {
      const body = await readJson(req);
      const assessment = recordSkillAssessmentProctorEvent(body.assessmentId, body);
      sendJson(res, 200, assessment);
      return;
    }

    sendJson(res, 404, { error: 'Route not found.' });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    sendJson(res, statusCode, {
      error: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
}

http.createServer((req, res) => {
  void handleRequest(req, res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`SkillPath API listening on http://localhost:${PORT}`);
});
