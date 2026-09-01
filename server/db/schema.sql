-- SkillPath authentication schema
-- Run via: npm run db:migrate  (see server/db/migrate.mjs)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  TEXT NOT NULL,
  password_hash          TEXT, -- nullable: accounts created via Google/GitHub Sign-In have no password
  google_id              TEXT, -- Google's stable "sub" claim; null for non-Google accounts
  full_name              TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until           TIMESTAMPTZ,
  last_login_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_have_a_login_method CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- Case-insensitive uniqueness on email without requiring the citext extension.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users (google_id) WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS candidates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL DEFAULT 'Candidate',
  email                TEXT NOT NULL UNIQUE,
  qualification        TEXT NOT NULL DEFAULT '',
  selected_domain      TEXT NOT NULL DEFAULT 'Full Stack Engineering',
  assessment_domain    TEXT NOT NULL DEFAULT 'Full Stack Engineering',
  interested_roles     TEXT[] NOT NULL DEFAULT '{}',
  claimed_skills       TEXT[] NOT NULL DEFAULT '{}',
  resume_file_name     TEXT,
  transcript_file_name TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_file_name TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS transcript_file_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id) WHERE user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'candidates_user_id_fkey'
      AND conrelid = 'candidates'::regclass
  ) THEN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- GitHub Sign-In columns. Added via idempotent ALTERs (rather than folded
-- into CREATE TABLE above) so this file can be re-run safely against a
-- database that was already migrated before GitHub support existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT;
-- AES-256-GCM ciphertext of the GitHub access token (see server/auth/crypto.mjs).
-- Optional: only populated if ENCRYPTION_KEY is configured. Not required for
-- authentication itself - only useful if the app later calls the GitHub API
-- on the user's behalf (e.g. reading repos for a skill assessment).
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token_enc TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_idx ON users (github_id) WHERE github_id IS NOT NULL;

-- Widen the "must have some way to log in" constraint to include GitHub.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_have_a_login_method;
ALTER TABLE users ADD CONSTRAINT users_have_a_login_method
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL OR github_id IS NOT NULL);

-- Refresh tokens are stored hashed (never in plaintext) so a DB leak alone
-- cannot be used to mint sessions. Enables per-session revocation / logout.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_hash_idx ON refresh_tokens (token_hash);

-- Append-only audit trail for login attempts, used for monitoring / abuse
-- detection independent of the per-account lockout counters above.
CREATE TABLE IF NOT EXISTS login_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  reason      TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_audit_log_email_idx ON login_audit_log (lower(email));
CREATE INDEX IF NOT EXISTS login_audit_log_created_at_idx ON login_audit_log (created_at);

-- One-time codes for the "forgot password" flow. Only a SHA-256 hash of
-- the code is stored (never the code itself), mirroring how refresh
-- tokens are stored below - a database leak alone can't be used to
-- reset accounts.
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash      TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT
);

CREATE INDEX IF NOT EXISTS password_reset_otps_user_id_idx ON password_reset_otps (user_id);

-- Auto-update updated_at on users
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
