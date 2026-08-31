/**
 * server/migrate.mjs
 * Idempotent PostgreSQL schema migration.
 * Run with: node server/migrate.mjs
 * Or via: npm run migrate
 */
import { query } from './db.mjs';

const DDL = `
-- ────────────────────────────────────────────────────────────────────────────
-- CANDIDATES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL DEFAULT 'Candidate',
  email             TEXT NOT NULL UNIQUE,
  qualification     TEXT NOT NULL DEFAULT '',
  selected_domain   TEXT NOT NULL DEFAULT 'Full Stack Engineering',
  assessment_domain TEXT NOT NULL DEFAULT 'Full Stack Engineering',
  interested_roles  TEXT[] NOT NULL DEFAULT '{}',
  claimed_skills    TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);

-- ────────────────────────────────────────────────────────────────────────────
-- CHAT SESSIONS (Chatbot Agentic Assessment)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id          UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed','terminated','skipped')),
  reason                TEXT NOT NULL DEFAULT '',
  warning_count         INT NOT NULL DEFAULT 0,
  warning_limit         INT NOT NULL DEFAULT 3,
  answer_seconds        INT NOT NULL DEFAULT 45,
  current_skill_index   INT NOT NULL DEFAULT 0,
  question_sequence     INT NOT NULL DEFAULT 0,
  current_question_id   UUID,
  aggregate             JSONB,
  model                 TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  gemini_configured     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  terminated_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_candidate ON chat_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);

-- ────────────────────────────────────────────────────────────────────────────
-- CHAT SKILL STATES
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_skill_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  skill           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  medium_attempts INT NOT NULL DEFAULT 0,
  hard_attempts   INT NOT NULL DEFAULT 0,
  final_score     NUMERIC,
  final_level     TEXT,
  skill_index     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_skill_states_session ON chat_skill_states(session_id);

-- ────────────────────────────────────────────────────────────────────────────
-- CHAT SKILL ATTEMPTS (per answer for a skill)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_skill_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_state_id UUID NOT NULL REFERENCES chat_skill_states(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  difficulty  TEXT NOT NULL CHECK (difficulty IN ('medium','hard')),
  score       INT NOT NULL DEFAULT 0,
  level       TEXT NOT NULL DEFAULT 'novice',
  feedback    TEXT NOT NULL DEFAULT '',
  strengths   TEXT[] NOT NULL DEFAULT '{}',
  gaps        TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_skill_attempts_state ON chat_skill_attempts(skill_state_id);

-- ────────────────────────────────────────────────────────────────────────────
-- CHAT QUESTIONS (one per Gemini call)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  difficulty  TEXT NOT NULL CHECK (difficulty IN ('medium','hard')),
  text        TEXT NOT NULL,
  intent      TEXT NOT NULL DEFAULT '',
  sequence    INT NOT NULL DEFAULT 1,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_questions_session ON chat_questions(session_id);

-- ────────────────────────────────────────────────────────────────────────────
-- CHAT TRANSCRIPT
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_transcript (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('system','agent','candidate')),
  text        TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_transcript_session ON chat_transcript(session_id, created_at);

-- ────────────────────────────────────────────────────────────────────────────
-- PROCTOR EVENTS (shared across chat + skill assessments)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proctor_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID,          -- chat session id
  assessment_id UUID,          -- skill assessment id
  target_type   TEXT NOT NULL CHECK (target_type IN ('chat','skill')),
  type          TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctor_events_session ON proctor_events(session_id);
CREATE INDEX IF NOT EXISTS idx_proctor_events_assessment ON proctor_events(assessment_id);

-- ────────────────────────────────────────────────────────────────────────────
-- SKILL ASSESSMENTS (Deterministic MCQ)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  domain            TEXT NOT NULL DEFAULT 'Full Stack Engineering',
  selected_domain   TEXT NOT NULL DEFAULT 'Full Stack Engineering',
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','submitted','terminated')),
  warning_count     INT NOT NULL DEFAULT 0,
  warning_limit     INT NOT NULL DEFAULT 3,
  due_at            TIMESTAMPTZ NOT NULL,
  duration_seconds  INT NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at      TIMESTAMPTZ,
  terminated_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_assessments_candidate ON skill_assessments(candidate_id);

-- ────────────────────────────────────────────────────────────────────────────
-- SKILL ASSESSMENT RESULTS
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_assessment_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL UNIQUE REFERENCES skill_assessments(id) ON DELETE CASCADE,
  timed_out     BOOLEAN NOT NULL DEFAULT FALSE,
  score         NUMERIC NOT NULL DEFAULT 0,
  level         TEXT NOT NULL DEFAULT 'novice',
  correct_count INT NOT NULL DEFAULT 0,
  total         INT NOT NULL DEFAULT 0,
  results       JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- AUTH TOKENS (JWT refresh tracking — optional, for token revocation)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_candidate ON auth_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
`;

async function migrate() {
  console.log('[migrate] Running SkillPath schema migration...');
  try {
    await query(DDL);
    console.log('[migrate] ✓ All tables created / already exist.');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] ✗ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
