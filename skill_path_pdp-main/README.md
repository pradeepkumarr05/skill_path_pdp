# SkillPath

SkillPath is an end-to-end AI-powered skill readiness and assessment platform. This repository contains the complete unified application featuring **Enterprise-Grade Authentication** + **Agentic Chatbot Assessment** + **Deterministic MCQ Skill Assessment** backed by **PostgreSQL** and **Gemini 3.6 Flash**.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vite 6, React 18, TypeScript, Tailwind CSS, Framer Motion, Phosphor Icons |
| **Backend** | Node.js Express API (port 8787) |
| **Database** | PostgreSQL 15+ (`pg` connection pool with transaction safety) |
| **Authentication** | Dual-mode: Secure cookie-based JWT + refresh token rotation + Bearer tokens for API client; Google OAuth (GIS ID token verification), GitHub OAuth, bcrypt password hashing, double-submit CSRF protection, rate limiting |
| **AI Assessment** | Gemini 3.6 Flash via REST API (server-side only) |
| **Proctoring** | Real-time tab-switch, fullscreen exit termination, blur detection, camera & optional microphone check |
| **Typography** | Bricolage Grotesque (UI) + Newsreader italic (Wordmark) |

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Browser (React 18 + Vite)              │
│   • Modern Login / Sign Up / OAuth / Forgot-Reset Password│
│   • Profile Setup (Fresher / Degree / Domain intake)      │
│   • Assessment Guidelines & Proctoring Checklist          │
│   • Live Chatbot Assessment & Deterministic MCQ Test      │
│   • Learning Roadmap Dashboard                            │
└───────────────┬───────────────────────────┬───────────────┘
                │ Authorization: Bearer     │ Cookies / CSRF
                ▼                           ▼
┌───────────────────────────────────────────────────────────┐
│                 SkillPath Express API (Port 8787)         │
│   • Auth Router (/api/auth/*: login, register, oauth, otp)│
│   • Chatbot Agent Runtime (/api/agent/*)                  │
│   • MCQ Assessment Runtime (/api/skill-assessment/*)      │
│   • Health check & Telemetry (/api/health)                │
└───────────────┬───────────────────────────┬───────────────┘
                │                           │
                ▼                           ▼
┌───────────────────────────────┐ ┌─────────────────────────┐
│     PostgreSQL Database       │ │   Google Gemini AI      │
│   • users & refresh_tokens    │ │   • gemini-3.6-flash    │
│   • candidates & chat_sessions│ │   • Adaptive evaluation │
│   • questions & transcripts   │ └─────────────────────────┘
│   • proctor_events & results  │
└───────────────────────────────┘
```

## Core Features

### 🔐 Enterprise-Grade Authentication & Security
- **Email & Password Authentication**: Salted bcrypt hashing (cost factor 12) with account lockout after 5 consecutive failed attempts.
- **Google Sign-In**: Integrated with Google Identity Services (GIS); verifies signed ID tokens on the backend using `google-auth-library`.
- **GitHub OAuth**: Full OAuth flow with secure state verification and optional token encryption.
- **Password Reset via OTP**: 6-digit one-time passcode with 10-minute expiry sent via nodemailer (or logged to server console in dev).
- **Session Security**: Short-lived access tokens (15m) paired with single-use rotating refresh tokens (7d) stored in `httpOnly`, `SameSite=Strict` cookies.
- **CSRF & Rate Limiting**: Double-submit cookie CSRF validation for browser requests + `express-rate-limit` protection.

### 🤖 Agentic Chatbot Assessment
- **Gemini 3.6 Flash Integration**: Adaptive medium → hard question progression tailored to claimed candidate skills.
- **State Machine Runtime**: Dynamic scoring (45% medium + 55% hard weighting), strength/gap detection, and level thresholding (novice, developing, job_ready, strong).
- **Strict Proctoring**: Instant termination overlay upon fullscreen exit or lost camera permissions; tab-switch and blur detection.
- **45-second Question Timer**: Automatic answer submission on timer expiration.

### 📋 Deterministic MCQ Skill Assessment
- **22 Fixed Comprehensive Questions**: Covering 11 key Full Stack engineering skills (2 items per skill).
- **Timed Execution**: 75-second per item countdown with auto-submission.
- **Transparent Feedback**: Explanations and answer evaluations revealed upon test completion.

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (Local, Docker, Supabase, Neon, etc.)
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
DATABASE_URL=postgres://skillpath:skillpath@localhost:5432/skillpath
JWT_SECRET=your-random-64-character-secret-string
GEMINI_API_KEY=your-gemini-api-key-here
API_PORT=8787
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Run Database Migrations
```bash
npm run migrate
```
*Creates all 13 tables: `users`, `refresh_tokens`, `login_audit_log`, `password_reset_otps`, `candidates`, `chat_sessions`, `chat_skill_states`, `chat_skill_attempts`, `chat_questions`, `chat_transcript`, `proctor_events`, `skill_assessments`, and `skill_assessment_results`.*

### 4. Start Development Server
```bash
npm run dev
```
- **Frontend** → http://localhost:5173
- **Backend API** → http://localhost:8787

## Test & Validation Commands

| Command | Purpose |
|---|---|
| `npm run typecheck` | Validates TypeScript across all frontend components |
| `npm run test:unit` | Tests assessment state machine math and scoring logic |
| `npm run test:api` | End-to-end integration test suite for all API routes |
| `npm run build` | Builds production frontend distribution bundle |

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Health check and Gemini/DB status | No |
| `GET` | `/api/auth/csrf-token` | Obtain CSRF token cookie | No |
| `POST` | `/api/auth/register` | Register a new email/password account | CSRF |
| `POST` | `/api/auth/login` | Authenticate user or upsert candidate | CSRF / Token |
| `POST` | `/api/auth/google` | Sign in with Google ID token | CSRF |
| `GET` | `/api/auth/github/start` | Initiate GitHub OAuth | No |
| `GET` | `/api/auth/github/callback` | Complete GitHub OAuth callback | No |
| `POST` | `/api/auth/forgot-password` | Request 6-digit password reset OTP | CSRF |
| `POST` | `/api/auth/reset-password` | Reset password using OTP code | CSRF |
| `POST` | `/api/auth/refresh` | Rotate refresh token | CSRF / Cookie |
| `POST` | `/api/auth/logout` | Revoke session and clear cookies | CSRF |
| `GET` | `/api/auth/me` | Fetch authenticated user/candidate | Yes |
| `POST` | `/api/agent/start` | Start agentic chatbot assessment | Yes |
| `POST` | `/api/agent/answer` | Submit answer for chatbot evaluation | Yes |
| `POST` | `/api/agent/proctor` | Record proctor event during chatbot | Yes |
| `GET` | `/api/agent/session` | Get active chatbot session state | Yes |
| `POST` | `/api/skill-assessment` | Create deterministic MCQ assessment | Yes |
| `POST` | `/api/skill-assessment/submit` | Submit MCQ assessment answers | Yes |
| `POST` | `/api/skill-assessment/proctor` | Record MCQ proctor event | Yes |
