# SkillPath

SkillPath is an end-to-end AI-powered skill readiness and assessment platform. This repository contains **Module 1: Chatbot Assessment + MCQ Assessment** with a complete backend and database.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite, React 18, TypeScript, Tailwind CSS, Framer Motion, Phosphor Icons |
| Backend | Node.js HTTP API (no framework) |
| Database | PostgreSQL 15+ (persistent sessions, results, proctor events) |
| Auth | JWT (jsonwebtoken) — Bearer token on all protected routes |
| AI | Gemini 2.5 Flash via REST API (server-side only) |
| Fonts | Bricolage Grotesque (UI) + Newsreader italic (wordmark) |

## Architecture

```
Browser (React/Vite)
    ↕  REST API + JWT Bearer token
Node.js HTTP Server (port 8787)
    ↕  pg (node-postgres)
PostgreSQL Database
    ↕  Gemini REST API
Google Generative AI (Gemini 2.5 Flash)
```

## Module 1 Features

### 🤖 Agentic Chatbot Assessment
- **Real Gemini-backed questions** — adaptive medium → hard progression per skill
- **Agentic state machine** — per-skill scoring, pass/fail routing, session completion
- **Live proctoring** — clipboard, tab-switch, fullscreen, window-blur detection
- **45-second per-question timer** — auto-submits on expiry
- **PostgreSQL persistence** — sessions survive server restarts

### 📋 MCQ Skill Assessment (Deterministic)
- **22 fixed questions** across 11 Full Stack skills (2 per skill)
- **Uniform coverage** — every claimed skill tested equally
- **Timed assessment** — 75 seconds per item, auto-submit on expiry
- **Proctoring** — same event model as chatbot stage
- **Graded results** — per-question correctChoice + explanation revealed post-submission

### 🔐 JWT Authentication
- `POST /api/auth/login` — upsert candidate by email, return JWT
- Bearer token required on all `/api/agent/*` and `/api/skill-assessment/*` routes
- Token propagated transparently by the frontend API client

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (running locally or cloud)
- Gemini API key from [aistudio.google.com](https://aistudio.google.com/apikey)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
# Copy the template
copy .env.example .env
```

Edit `.env`:
```env
GEMINI_API_KEY=your-gemini-api-key-here
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/skillpath
JWT_SECRET=any-long-random-string-here
```

### 3. Create the database
```bash
# Using psql
psql -U postgres -c "CREATE DATABASE skillpath;"

# Or in pgAdmin / any client:
# CREATE DATABASE skillpath;
```

### 4. Run schema migration
```bash
npm run migrate
```

Expected output:
```
[migrate] Running SkillPath schema migration...
[migrate] ✓ All tables created / already exist.
```

### 5. Start development servers
```bash
npm run dev
```

This starts:
- **Frontend** → http://localhost:5173
- **API** → http://localhost:8787

### 6. Run end-to-end tests (optional)
```bash
# In a separate terminal while npm run dev is running
npm run test:api
```

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Server health + Gemini status |
| POST | `/api/auth/login` | Public | Upsert candidate, return JWT |
| GET | `/api/auth/me` | JWT | Return authenticated candidate |
| POST | `/api/agent/start` | JWT | Start chatbot session |
| POST | `/api/agent/answer` | JWT | Submit chatbot answer |
| POST | `/api/agent/proctor` | JWT | Record chatbot proctor event |
| GET | `/api/agent/session` | JWT | Fetch chatbot session |
| POST | `/api/skill-assessment` | JWT | Create MCQ assessment |
| POST | `/api/skill-assessment/submit` | JWT | Submit MCQ answers |
| POST | `/api/skill-assessment/proctor` | JWT | Record MCQ proctor event |

## Database Schema

| Table | Purpose |
|---|---|
| `candidates` | Candidate profiles (upserted by email) |
| `chat_sessions` | Chatbot assessment sessions |
| `chat_skill_states` | Per-skill state machine (pending → medium → hard → completed) |
| `chat_skill_attempts` | Individual question scores |
| `chat_questions` | Gemini-generated questions |
| `chat_transcript` | Full conversation log |
| `proctor_events` | All proctoring violations |
| `skill_assessments` | MCQ assessment instances |
| `skill_assessment_results` | Graded MCQ results |
| `auth_sessions` | JWT tracking |

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start both Vite client + API server |
| `npm run dev:api` | API server only |
| `npm run dev:client` | Vite client only |
| `npm run migrate` | Run database migration |
| `npm run test:api` | Run end-to-end API tests |
| `npm run build` | TypeScript check + production build |
| `npm run typecheck` | TypeScript type check only |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (any random string) |
| `GEMINI_MODEL` | No | Override model (default: `gemini-3.6-flash`) |
| `JWT_EXPIRES_IN` | No | Token TTL (default: `7d`) |
| `API_PORT` | No | API port (default: `8787`) |

## Security Notes

- `.env` is git-ignored — never commit it
- All Gemini calls are server-side only — API key never reaches the browser
- JWT tokens are validated on every protected route
- Proctor events auto-terminate sessions after 3 violations
- Answer timer is enforced server-side (not just client-side)

## Documentation

- [UI consistency guide](docs/ui-consistency.md)
- [Project architecture](docs/project-architecture.md)
- [Verification notes](docs/verification.md)
