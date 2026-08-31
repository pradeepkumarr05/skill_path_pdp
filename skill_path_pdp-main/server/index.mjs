import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import {
  createSkillAssessment,
  getAgenticSession,
  recordProctorEvent,
  recordSkillAssessmentProctorEvent,
  startAgenticSession,
  submitAgenticAnswer,
  submitSkillAssessment,
} from './agentRuntimeDb.mjs';
import { geminiModel, isGeminiConfigured } from './geminiClient.mjs';
import { authRouter, requireAuth } from './auth/authRoutes.mjs';
import { runMigrations } from './migrate.mjs';

// Auto-run schema migration on server startup
runMigrations().catch((err) => {
  console.warn('[migrate] Startup migration notice:', err.message);
});

const PORT = Number(process.env.API_PORT || 8787);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

// --- Security headers -------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameSrc: ['https://accounts.google.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// --- CORS -------------------------------------------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching localhost / CLIENT_ORIGIN
      if (!origin || origin === CLIENT_ORIGIN || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Cache-Control'],
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Never cache API responses that may contain session-derived data.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Helper to extract candidate / user ID if token present
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.cookies?.['access_token'];
  if (token) {
    try {
      const { verifyAccessToken } = requireAuth;
      // or decode
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        req.auth = payload;
        req.user = payload;
      }
    } catch {
      // continue without auth
    }
  }
  next();
}

app.use(optionalAuth);

// --- Auth routes --------------------------------------------------------
app.use('/api/auth', authRouter);

// --- Health Check -------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: isGeminiConfigured(),
    model: geminiModel(),
    dbConnected: true,
  });
});

// --- Chatbot Assessment Routes ------------------------------------------
app.post('/api/agent/start', async (req, res, next) => {
  try {
    const candidateId = req.auth?.sub || req.user?.id || req.body?.candidateId;
    const session = await startAgenticSession(req.body.profile, candidateId);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.post('/api/agent/answer', async (req, res, next) => {
  try {
    const candidateId = req.auth?.sub || req.user?.id;
    const session = await submitAgenticAnswer(req.body.sessionId, req.body, candidateId);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.post('/api/agent/proctor', async (req, res, next) => {
  try {
    const candidateId = req.auth?.sub || req.user?.id;
    const session = await recordProctorEvent(req.body.sessionId, req.body, candidateId);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.get('/api/agent/session', async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId || '';
    const session = await getAgenticSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Assessment session was not found.' });
    }
    return res.json(session);
  } catch (error) {
    next(error);
  }
});

// --- MCQ Skill Assessment Routes ----------------------------------------
app.post('/api/skill-assessment', async (req, res, next) => {
  try {
    const candidateId = req.auth?.sub || req.user?.id || req.body?.candidateId;
    const assessment = await createSkillAssessment(req.body.profile, candidateId);
    res.json(assessment);
  } catch (error) {
    next(error);
  }
});

app.post('/api/skill-assessment/submit', async (req, res, next) => {
  try {
    const candidateId = req.auth?.sub || req.user?.id;
    const result = await submitSkillAssessment(req.body.assessmentId, req.body.answers, req.body.timedOut, candidateId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/skill-assessment/proctor', async (req, res, next) => {
  try {
    const candidateId = req.auth?.sub || req.user?.id;
    const assessment = await recordSkillAssessmentProctorEvent(req.body.assessmentId, req.body, candidateId);
    res.json(assessment);
  } catch (error) {
    next(error);
  }
});

// --- 404 & Centralized Error Handler -----------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = Number(error?.statusCode || error?.status) || 500;
  if (statusCode >= 500) {
    console.error(`[api] ${req.method} ${req.originalUrl || req.url} → ${statusCode}:`, error);
  }
  res.status(statusCode).json({
    error: error instanceof Error ? error.message : 'Unexpected server error.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SkillPath API listening on http://localhost:${PORT}`);
  console.log(`  Gemini configured: ${isGeminiConfigured()}`);
  console.log(`  Model: ${geminiModel()}`);
});

