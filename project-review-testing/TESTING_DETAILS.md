# SkillPath PDP Testing Details and Technical Inference

Generated on: 1 September 2026

## Actual Terminal Screenshots

The folder `project-review-testing/terminal-screenshots/` contains terminal-style PNG screenshots rendered from the raw terminal session logs captured during the actual test runs.

Files generated:

- `01-npm-test-terminal-page-01.png`
- `01-npm-test-terminal-page-02.png`
- `01-npm-test-terminal-page-03.png`
- `01-npm-test-terminal-page-04.png`
- `02-api-validation-terminal-page-01.png`
- `02-api-validation-terminal-page-02.png`
- `02-api-validation-terminal-page-03.png`
- `03-ui-trial-run-terminal-page-01.png`

These are separate from the designed summary screenshots in `project-review-testing/screenshots/`.

## Testing Performed

### 1. Unit Testing

Command:

```bash
npm test
```

Unit tests were run through Vitest. The tested frontend utility modules were:

- `src/utils/documentValidation.ts`
- `src/utils/authSession.ts`

Coverage focus:

- PDF-only document validation.
- Rejection of non-PDF files such as Word documents and images.
- Protection against spoofed PDF filenames.
- Authenticated-session routing after login.
- Restoration of persisted candidate profile data.
- Routing incomplete users to profile setup.
- Routing completed users to assessment or learning-gap dashboard depending on available results.

Output result:

- 2 test files passed.
- 8 test cases passed.
- 0 failed.

Inference:

- The utility layer behaves correctly for candidate profile validation and session restoration.
- Profile setup cannot accidentally accept unsupported document types at the client utility level.
- Returning-user navigation logic is deterministic and testable.

### 2. Validation / State-Machine Testing

Command:

```bash
npm run test:unit
```

This command runs Vitest first and then executes:

```bash
node server/test-state-machine.mjs
```

The state-machine validation is a custom Node.js test script that validates the core assessment scoring and assessment-control rules without depending on Gemini or the database.

Coverage focus:

- Score clamping.
- Readiness-level thresholds.
- Medium/hard weighted scoring.
- Aggregate score calculation.
- Proctor warning limit.
- MCQ grading.
- Answer timeout detection.

Output result:

- 33 state-machine validation checks passed.
- 0 failed.

Inference:

- The core assessment math is stable.
- Invalid or out-of-range scores are normalized safely.
- Readiness labels are assigned consistently.
- Proctoring termination logic behaves as expected.
- Timeout behavior is deterministic.

### 3. TypeScript and Build Validation

Command:

```bash
npm test
```

The full `npm test` command also runs:

```bash
npm run typecheck
npm run build
```

Frameworks/tools used:

- TypeScript compiler through `tsc --noEmit`.
- Vite production build through `vite build`.

Output result:

- TypeScript validation completed without reported errors.
- Vite transformed 4937 modules.
- Production assets were generated successfully.

Inference:

- The frontend source compiles cleanly.
- Component props, API response types, and assessment result types are compatible at compile time.
- The project can produce deployable frontend build assets.

### 4. API / Integration Testing

Command:

```bash
npm run test:api
```

Framework/tooling used:

- Custom Node.js API test runner: `server/test.mjs`.
- Native `fetch` for HTTP API calls.
- Express backend running on `http://localhost:8787`.
- Local PostgreSQL 15 Docker test container.

Coverage focus:

- Health endpoint.
- CSRF token generation.
- Candidate registration.
- Login.
- JWT access-token issuance.
- Refresh-cookie/session behavior.
- Authenticated profile persistence.
- PDF metadata validation on the server.
- `/api/auth/me` session restoration.
- Protected-route enforcement.
- Chatbot no-skills skip path.
- Deterministic MCQ assessment creation.
- Hiding correct MCQ choices from the public assessment payload.
- MCQ submission and result scoring.
- Returning login with latest result hydration.
- MCQ proctor warnings and termination.
- Rejection of submission after proctor termination.

Output result:

- 34 API checks passed.
- 0 failed.

Inference:

- Authenticated candidate flow works end to end against a real PostgreSQL-backed API.
- Candidate setup is persisted and restored correctly.
- Server-side PDF validation matches the frontend validation rule.
- Assessment APIs are protected and reject missing or invalid tokens.
- Correct answers are not leaked in the public MCQ assessment payload.
- Submitted results are calculated, saved, and returned correctly.
- Proctoring rules prevent submission after termination.

Note:

- Live Gemini question/evaluation assertions were skipped because `GEMINI_API_KEY` was not configured in the local environment.
- Deterministic and database-backed modules were still fully validated.

### 5. UI Trial Run / Browser Walkthrough

Command:

```bash
npm run screenshots
```

Framework/tooling used:

- Playwright.
- Vite frontend server.
- Express API server.
- Local PostgreSQL test database.
- Mocked camera/screen streams for repeatable browser screenshots.

Trial-run path covered:

- Login screen.
- Signup screen.
- Profile setup.
- PDF-only validation message.
- Valid resume/transcript PDF metadata.
- Profile final review.
- Assessment-guideline acceptance.
- Camera/screen/fullscreen assessment access flow.
- Live chatbot assessment page.
- Deterministic skill-assessment page.
- MCQ result screen.
- Learning-gap dashboard.
- Returning-user login redirect to dashboard.

Output result:

- 11 UI trial screenshots generated.

Inference:

- The completed user journey is visually demonstrable.
- Profile setup, assessment entry, proctor-preview UI, MCQ result output, dashboard rendering, and returning-user routing all work through a browser-level walkthrough.

## Frameworks and Tools Used

- React 18: frontend component framework.
- TypeScript: static type validation.
- Vite: development server and production build tool.
- Vitest: frontend/unit test framework.
- Node.js: custom validation and API test runners.
- Express: backend HTTP API framework.
- PostgreSQL: persistent database for users, candidates, sessions, assessments, results, and proctor events.
- Docker: local PostgreSQL test container.
- Playwright: browser automation and UI screenshot generation.
- Zod: request/body validation schemas for auth and profile inputs.
- JWT: access-token authentication.
- Cookie-based refresh sessions: longer-lived session restoration.

## Core Modules Implemented

### Authentication and Session Module

Implemented through:

- `server/auth/authRoutes.mjs`
- `server/auth/authService.mjs`
- `server/auth/tokens.mjs`
- `server/middleware/csrf.mjs`
- `server/middleware/rateLimit.mjs`
- `src/api/authApi.ts`
- `src/utils/authSession.ts`
- `src/pages/LoginPage.tsx`

Functionality:

- Email/password registration.
- Email/password login.
- Google login support.
- GitHub OAuth support.
- CSRF protection for state-changing auth routes.
- JWT access tokens.
- Refresh-token rotation.
- Remember-device option.
- Password reset with OTP.
- Returning-session restoration.
- Profile-aware post-login routing.

Technical correctness:

- API tests confirmed registration, login, token issuance, `/api/auth/me`, and profile hydration.
- Unit tests confirmed post-login routing behavior.
- CSRF tests confirmed token issuance and usage.
- Protected-route tests confirmed unauthenticated or invalid-token requests are rejected.

### Candidate Profile Setup Module

Implemented through:

- `src/pages/ProfileSetupPage.tsx`
- `src/utils/documentValidation.ts`
- `server/auth/validation.mjs`
- `server/agentRuntimeDb.mjs`
- `server/db/schema.sql`

Functionality:

- Captures candidate identity, qualification, college, academic details, selected domain, interested roles, claimed skills, resume filename, and transcript filename.
- Enforces PDF-only resume/transcript validation on the frontend and backend.
- Persists profile data to the `candidates` table.
- Links candidate records to authenticated users.
- Reuses saved profile data on future logins.

Technical correctness:

- Unit tests validated accepted/rejected document types.
- API tests validated server-side rejection of non-PDF resume metadata.
- API tests validated persistence and restoration of PDF file names.
- UI trial screenshots show both failed and successful profile-document validation states.

### Assessment Guidelines and Access Module

Implemented through:

- `src/pages/AssessmentGuidelinesPage.tsx`
- `src/types/assessment.ts`

Functionality:

- Displays assessment rules and required readiness checks.
- Requests camera, microphone, screen, and fullscreen access.
- Stores an `AssessmentAccessGrant` object for downstream assessment pages.

Technical correctness:

- UI trial walkthrough reached the assessment stage only after guideline acceptance.
- Mocked browser permissions verified that assessment screens can render with camera/screen-preview state.

### Agentic Chatbot Assessment Module

Implemented through:

- `server/agentRuntimeDb.mjs`
- `server/geminiClient.mjs`
- `src/pages/LiveChatbotAssessmentPage.tsx`
- `src/api/skillpathApi.ts`

Functionality:

- Starts a chatbot assessment from claimed skills.
- Creates persistent chat sessions and per-skill state rows.
- Generates a medium-difficulty question first.
- Evaluates answers through Gemini when configured.
- Advances to hard difficulty if the medium answer passes.
- Completes the skill if medium fails or hard is answered.
- Persists transcript, attempts, skill scores, aggregate score, warnings, status, and timestamps.
- Skips chatbot assessment when the candidate submits no claimed skills.

Technical correctness:

- The state machine is explicit and persisted in PostgreSQL.
- API tests confirmed the no-claimed-skills skip path.
- The Gemini live path is structurally implemented but was not executed in this local validation because `GEMINI_API_KEY` was absent.
- The implementation validates active question IDs before accepting answers, preventing stale-answer submission.

### Deterministic MCQ Skill Assessment Module

Implemented through:

- `server/deterministicSkillAssessment.mjs`
- `server/agentRuntimeDb.mjs`
- `src/pages/SkillAssessmentPage.tsx`
- `src/api/skillpathApi.ts`

Functionality:

- Builds a fixed deterministic item bank of 22 technical MCQ questions.
- Covers HTML, CSS, JavaScript, TypeScript, React, Node.js, REST APIs, DSA, PostgreSQL, MongoDB, and Git.
- Gives 75 seconds per item.
- Computes total duration as `number_of_items * 75`.
- Stores active assessments, due time, warning count, status, and results.
- Hides `correctChoice` and `explanation` before submission.
- Reveals result explanations only after submission.

Technical correctness:

- API tests confirmed assessment creation and active status.
- API tests confirmed `correctChoice` is not exposed in the assessment payload.
- API tests confirmed submission returns a scored result.
- API tests confirmed result count matches the item count.
- State-machine tests confirmed MCQ score math for boundary cases.

### Proctoring Module

Implemented through:

- `server/agentRuntimeDb.mjs`
- `src/pages/LiveChatbotAssessmentPage.tsx`
- `src/pages/SkillAssessmentPage.tsx`
- `src/pages/LearningRoadmapPage.tsx`

Functionality:

- Records tab/window/focus/copy/paste/context-menu style events.
- Tracks warning count.
- Terminates after 3 warnings.
- Immediately terminates on critical events such as fullscreen exit or camera-track end.
- Rejects submissions after termination.

Technical correctness:

- State-machine tests verified 1 and 2 warnings do not terminate, while 3 warnings terminate.
- API tests verified third MCQ warning terminates assessment.
- API tests verified submit-after-termination returns 409 conflict.

### Learning Gap Engine Module

Implemented through:

- `src/pages/LearningRoadmapPage.tsx`
- `src/types/assessment.ts`

Functionality:

- Uses skill assessment results and chatbot aggregate results to present a learning-gap dashboard.
- Shows roadmap progress, readiness scores, gap summary, recommended focus areas, and lesson-session controls.
- Supports returning-user dashboard restoration when saved results exist.

Technical correctness:

- Auth-session tests confirmed returning users with latest results route to the learning-gap engine.
- API tests confirmed returning login includes latest skill result.
- UI trial screenshots confirmed dashboard rendering and returning-user redirect.

## Assessment Engine Algorithm

The project uses two assessment paths:

1. Agentic chatbot assessment.
2. Deterministic MCQ assessment.

### Shared Score Normalization

All numeric scores pass through this normalization rule:

```text
score = round(score)
score below 0 becomes 0
score above 100 becomes 100
non-numeric score becomes 0
```

This prevents invalid scores from breaking result calculation or producing impossible percentages.

### Readiness Level Mapping

The readiness label is assigned using fixed thresholds:

```text
85 to 100  -> strong
70 to 84   -> job_ready
45 to 69   -> developing
0 to 44    -> novice
```

Technical correctness:

- Boundary cases were tested: 85, 84, 70, 69, 45, 44, 0, and 100.
- This proves labels change correctly at threshold boundaries.

### Agentic Chatbot Progression Algorithm

For each claimed skill:

1. Start with a medium-difficulty question.
2. Candidate answers within 45 seconds.
3. Gemini evaluates the answer using a strict JSON schema.
4. If medium passes, advance to one hard question.
5. If medium fails, complete that skill with the medium score and move to the next skill.
6. If hard is answered, calculate a final weighted score.
7. Move to the next claimed skill.
8. When all skills are complete, calculate aggregate readiness.

Pass thresholds:

```text
medium pass score = 65
hard pass score = 70
```

Final chatbot skill score when hard is reached:

```text
final_score = round((best_medium_score * 0.45) + (hard_score * 0.55))
```

Why this is technically sound:

- Medium-first progression prevents wasting hard questions on candidates who have not shown basic competency.
- The hard question carries more weight because it better represents job readiness.
- Best medium score is used so a valid medium performance contributes to the final skill score.
- Each skill has its own persisted state, so progress is auditable and recoverable.
- Question IDs are validated before accepting answers, preventing stale or repeated question submissions.
- Timeouts are converted into warning events and empty answers, so late submissions cannot bypass the timer.

### Aggregate Chatbot Score

When all chatbot skills are completed:

```text
aggregate_score = average(final_skill_scores)
aggregate_level = readiness level for aggregate_score
```

Why this is technically sound:

- Each skill contributes equally to the chatbot aggregate.
- The score is clamped and rounded, preventing invalid aggregate values.
- The aggregate includes `skillsAssessed`, so the UI can show how much evidence supports the score.

### Deterministic MCQ Algorithm

The MCQ assessment uses a deterministic item bank of 22 questions.

Steps:

1. Build assessment items from `DETERMINISTIC_SKILL_ITEMS`.
2. Remove `correctChoice` and `explanation` before sending questions to the client.
3. Record the assessment start time.
4. Set due time as:

```text
due_at = started_at + (number_of_items * 75 seconds)
```

5. On submit, compare each selected answer with the stored correct answer.
6. Count correct answers.
7. Calculate percentage score:

```text
score = round((correct_count / total_items) * 100)
```

8. Convert score to readiness level.
9. Persist final result and explanations.

Why this is technically sound:

- Correct answers are hidden before submission, reducing answer leakage.
- Scoring is deterministic and reproducible.
- Result count is checked against item count.
- Missing answers become `null` selected choices and are scored incorrect.
- Submitted/terminated states are enforced server-side.
- A terminated assessment cannot be submitted later.
- Results are stored in a separate `skill_assessment_results` table, preserving an auditable assessment record.

### Proctoring Algorithm

Rules:

```text
warning_limit = 3
normal violation -> increment warning count
warning_count >= 3 -> terminate assessment
fullscreen_exit or camera_track_ended -> terminate immediately
terminated assessment -> reject submission
```

Why this is technically sound:

- It separates recoverable warnings from critical violations.
- It persists every proctor event for auditability.
- It enforces termination on the backend, not only in the browser UI.
- API tests proved terminated submissions are rejected with conflict status.

## Final Inference

The completed deterministic modules are ready for project-review demonstration.

Evidence supports the following claims:

- Unit-level validation passed.
- State-machine and algorithm validation passed.
- TypeScript and production build validation passed.
- DB-backed API integration passed.
- Browser-level trial run produced successful screenshots.
- Auth, profile persistence, PDF validation, protected assessments, MCQ scoring, proctor termination, result hydration, dashboard routing, and UI journey rendering are functioning together.

Open note for review:

- Gemini-backed live question generation/evaluation requires `GEMINI_API_KEY`. Since it was not configured locally, the live AI path was not executed in this test run. The deterministic MCQ engine, auth flow, profile persistence, proctoring, and UI trial were validated successfully.
