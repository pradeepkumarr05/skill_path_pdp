# Prototype Refresh Verification

Date: 2026-10-07. Existing React/Vite/Node/PostgreSQL application, not a new project.

## Implemented

- Muted, full-width welcome/auth/workspace layouts and original logo, with locally hosted fonts and landscape asset.
- Dashboard, assessments and per-skill evidence, learning plan, progress, profile and logout navigation.
- Four profile sections, required/optional field explanation, supported-domain choice, consolidated assessment consent, one-question knowledge assessment and visible motion warnings.
- Hosted Hugging Face generation endpoint, server-validated plan content, persisted plans/completions, ten-minute sessions with heartbeat expiry, ownership checks and server-side checkpoints.
- Strong performance in one assessment modality cannot make a weak modality automatically skippable. Missing evidence remains missing, not zero. Optional review is a heuristic threshold, not certification of mastery.

## Executed Tests

| Command | Result | Scope |
| --- | --- | --- |
| `npm run build` | Passed | TypeScript and production assets |
| `npm run test:auth` | 12 reported tests passed | Real HTTP/PostgreSQL and local SMTP; not Gmail inbox delivery |
| `npm run test:api` | 17 reported tests passed | Profile, assessment ownership, grading, proctor policy, chat progression |
| `npm run test:unit` | Policy test file plus 33 state-machine checks passed | Existing deterministic assessment behavior |
| `npm run test:learning` | 12 reported tests passed | Scoring/validation plus real PostgreSQL plan/session lifecycle; mocked provider response |
| `node scripts/prototype-ui-test.mjs` | Passed | 48 responsive capture checks at 1440/800/390/320px plus populated-plan restoration and logout |
| `node scripts/proctor-ui-test.mjs` | Passed | One MCQ at a time, navigation, simulated-media session start, early completion disabled, blur discards attempt on server |
| `git diff --check` | Passed | Patch whitespace |

Tests create their own temporary candidates and delete them at teardown. The existing user's browser-test changes and older screenshots are preserved.

## Screenshots

See `screenshots/prototype-refresh/`. `results.json` and `proctor-results.json` describe scope and limitations. Authenticated screenshots use a temporary database test account. Files labeled `fixture` contain controlled test data. Populated roadmap screenshots do NOT demonstrate live Hugging Face output. Media screenshots use Chromium simulated devices, not a human camera trial. The service tests advance timestamps on test rows to verify the ten-minute boundary without changing production duration.

## Still Required

- Configure HF_TOKEN privately and run a real generation with the selected hosted model. Validate actual lesson content, output length, generation latency, and provider failure behavior. See `docs/huggingface-setup.md`.
- Real Google OAuth success and real Gmail inbox verification/reset delivery.
- Real-camera motion/lighting tolerance and supported-browser screen-sharing trial. Browser-side proctoring is a deterrent and telemetry mechanism, not proof against bypass or proof of cheating.
- A real ten-minute learning walkthrough and complete new-user-to-resume run with the configured external providers.
- User review of visual design. This is an implemented and partially verified prototype, not a production-readiness certification.
