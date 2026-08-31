# SkillPath

SkillPath is a page-by-page build for an end-to-end skill readiness platform. The app progresses one module at a time, starting with Login / Sign Up and moving forward only after review and approval.

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, Framer Motion, Phosphor Icons
- Backend: Node HTTP API for agent sessions, proctor events, timers, deterministic skill assessment keys, and grading
- AI: Gemini API from the server only for the claimed-skill chatbot stage
- Fonts: Bricolage Grotesque for UI, Newsreader italic for the SkillPath wordmark
- State: local React state for page routing plus server-owned assessment sessions
- Runtime: Node.js and Vite

## Source Guidelines Used

- `/home/anj/Downloads/main-9.pdf`: end-to-end user flow, system architecture, detailed module flows, app pipeline, mock/interview fallback architecture
- Supplied markdown blueprint: backend event model, Zustand synchronizer, telemetry shell, assessment workspace, reasoning dashboard, LearnBot workspace, and fallback layout prompts

## Local Commands

```bash
npm install
npm run dev
npm run build
```

The local development command starts:

- Client: `http://localhost:5173`
- API: `http://localhost:8787`

## Current Scope

Login / Sign Up, Profile Setup, Assessment Guidelines, Gemini-backed Live Chatbot Assessment, deterministic proctored Full Stack Skill Assessment, Gap Detection, and UI-only Learning Roadmap sessions are implemented.

The `.env` file is ignored and must stay out of git. The backend reads `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY`.

## Documentation

- [UI consistency guide](docs/ui-consistency.md)
- [Verification notes](docs/verification.md)
