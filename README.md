# SkillPath Prototype

SkillPath is a local full-stack prototype for an end-to-end skill readiness platform. It follows the supplied PDF workflow and `codex-prototype-blueprint.md` to model authentication entry, profile gathering, proctored assessment, AI reasoning, 10-minute learning roadmap sessions, mock interviews, performance review, certification readiness, and fallback remediation.

## Tech Stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, Framer Motion, lucide-react, Recharts
- State: Zustand with Socket.io client synchronization
- Backend: Express, Socket.io, TypeScript, in-memory prototype session store
- Runtime: Node.js with `tsx` for local backend development
- Prototype data: static skill, roadmap, mock, and remediation data in `src/data`

## Source Guidelines Used

- `/home/anj/Downloads/main-9.pdf`: end-to-end user flow, system architecture, detailed module flows, simplified prototype pipeline, mock/interview fallback architecture
- `/home/anj/Downloads/codex-prototype-blueprint.md`: backend event model, Zustand synchronizer, telemetry shell, assessment workspace, reasoning dashboard, LearnBot workspace, and fallback layout prompts

## Local Commands

```bash
npm install
npm run dev
npm run build
```

The local development command starts:

- Client: `http://localhost:5173`
- Agent backend: `http://localhost:3001`

## Prototype Scope

This is not a production implementation. Authentication, storage, AI model calls, proctoring, speech-to-text, object storage, notifications, and external provider integrations are represented as local prototype flows and typed placeholders. The goal is to make the complete product flow inspectable and interactive before production infrastructure is selected.
