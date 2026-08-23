# SkillPath

SkillPath is a page-by-page build for an end-to-end skill readiness platform. The app progresses one module at a time, starting with Login / Sign Up and moving forward only after review and approval.

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, Framer Motion, Phosphor Icons
- Fonts: Bricolage Grotesque for UI, Newsreader italic for the SkillPath wordmark
- State: local React state for the current page-level build
- Backend: not introduced yet
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

## Current Scope

Authentication is mocked locally on Page 1. Future modules will be added as separate approved pages.

## Documentation

- [UI consistency guide](docs/ui-consistency.md)
- [Verification notes](docs/verification.md)
