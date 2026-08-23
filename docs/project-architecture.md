# Project Architecture

## Runtime Layers

The prototype mirrors the supplied high-level architecture:

- Presentation layer: React dashboard, assessment forms, learning roadmap, charts, and review panels
- Application layer: Express routes and Socket.io event processing
- AI and agent layer: local state-machine functions representing Assessment, Reasoning, LearnBot, Interviewer, and Fallback agents
- Data layer: in-memory session context with typed profile, skill, roadmap, notebook, mock, interview, and violation records
- External services: represented as placeholders for auth providers, AI model providers, speech-to-text, notifications, storage, and proctoring services

## Event Contract

The backend emits `STATE:SYNC` after meaningful state transitions. The client subscribes once through Zustand and maps the payload into individual state slices.

Inbound events:

- `EVENT:SESSION_JOIN`
- `EVENT:PROCTOR_ALERT`
- `EVENT:ASSESSMENT_SUBMIT`
- `EVENT:LEARNBOT_NODE_COMPLETE`
- `EVENT:MOCK_INTERVIEW_SUBMIT`
- `EVENT:TRIGGER_FALLBACK`
- `EVENT:RESET_SESSION`

REST endpoint:

- `POST /api/session/init`: creates or replaces the local prototype session context

## Prototype State Machine

1. Session initializes into the Assessment agent.
2. Assessment events collect descriptive and MCQ responses while proctor logs are captured.
3. Assessment submission moves the session to Reasoning.
4. Reasoning computes claimed vs measured deltas and produces a 10-minute learning roadmap.
5. LearnBot unlocks roadmap nodes and appends notebook records as nodes are completed.
6. Mock/interview submission calculates aggregate readiness.
7. If readiness fails, fallback remediation marks weak nodes as remediation and blocks certification.

## Implementation Boundaries

- No real login provider is connected.
- No persisted database is used.
- No AI provider is called.
- Proctoring is simulated with browser visibility and clipboard events.
- Speech-to-text is represented by typed assessment answers.
- Object storage outputs are represented by notebook entries in the session context.
