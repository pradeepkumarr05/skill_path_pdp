# SkillPath Prototype Progress

Last updated: 2026-10-07

## Active Checkpoint: Full Prototype Refresh

### Latest Continuation: Live Provider and Duration Verification

- User updated permissions on the existing `skillpath-local` Hugging Face token. Live single-gap generation PASSED: Qwen/Qwen2.5-72B-Instruct, HTML, four sessions, 40 minutes, 89-second request. Full eleven-skill live run is in progress. Never expose the token.
- Gmail SMTP connection/authentication verified; actual inbox delivery and interactive Google OAuth remain manual acceptance checks.
- Live Gemini interview PASSED with deterministic fallback disabled: question generation, scoring and persisted completion. Reduced Gemini 3 thinking level and increased JSON response budgets after a real question request failed with the previous small budget. Removed names/email from assessment prompts. Server thresholds now override model pass/action labels.
- Local `ALLOW_DETERMINISTIC_AI_FALLBACK=false`. Provider failure must not silently become heuristic scoring.
- Profile now saves on Save profile instead of reporting success before persistence. Browser verified save failure, dismiss, retry, real save, and restored custom institution.
- Learning: capped batches to two skills, at most two concurrent requests, exactly two lessons requested per skill; full combined plan must validate. Actionable provider permission/credit errors. Completed lessons have read-only review. Practice workspace and safe Markdown code rendering added; attempt drafts clear on abandonment.
- Real 600-second browser session PASSED without time manipulation, including canceled exit, heartbeat continuity, checkpoint completion and reload persistence. Chromium media devices were simulated. Evidence: `screenshots/prototype-refresh/real-timer-results.json` and completion screenshot.
- Complete 22-question browser assessment PASSED, including submission, persisted per-skill result, learning unlock and reload. Responsive suite re-passed 48 captures plus save-error recovery. Auth12, isolated API17 (real Gemini/fallback disabled), learning13, policy checks and build passed.
- Development server now preflights ports and Vite uses strictPort; no automatic redirect to an auth-incompatible port. App currently served at http://localhost:5173. Do not launch a duplicate.
- Remaining work in this continuation: finish full live HF run, capture actual generated lesson/roadmap views, rerun final checks after practice renderer, update verification report. Earlier checkpoint bullets below are historical and superseded by this section where they disagree.

- Latest user request expands beyond auth: muted colors, full-width content, welcome with sign-in/create-account, populated dashboard and working learning pipeline. Work is in the existing repo only.
- User supplied a visual screenshot after Figma access failures. Do not repeat Figma access/prototype work or use Superdesign. The screenshot is the visual reference, not an extracted token library.
- Implemented: Manrope interface typography, upright Newsreader auth/welcome headings, soft sage/blue/gray tokens, original stepped-path logo, local landscape photo, welcome page, auth restyling, full-width workspace with overview/results/plan/progress/profile/logout, sectioned setup, consolidated proctor consent, one-question MCQ navigation, visible motion warnings.
- Implemented backend: learning_plans and learning_sessions tables, authenticated learning routes, per-skill evidence, validated Hugging Face lesson generation, server-side duration/heartbeat/ownership/checkpoint enforcement, saved completions. Legacy LearningRoadmapPage is no longer mounted by App; do not use its local-state completion behavior.
- User explicitly approved hosted Hugging Face using anonymous per-skill scores only. No name/email/answers are transmitted. HF_TOKEN was absent at inspection. Default HF_ROADMAP_MODEL=Qwen/Qwen2.5-72B-Instruct; configurable. Real provider generation and content quality are NOT yet verified.
- Existing skillpath-development-db container was stopped; restarted with approval. Additive migration succeeded. Local dev server started at http://localhost:5173 with API8787; avoid launching a duplicate server.
- Tests so far: learning policy/integration 12 reported tests passed (Hugging Face response fixture, real PostgreSQL); auth12 passed (local SMTP, not Gmail); API17 passed; existing state-machine33 passed; production build passed before final styling adjustments.
- Browser checks are in scripts/prototype-ui-test.mjs, separate from the user's existing modified browser-test.mjs. Captures go to screenshots/prototype-refresh. Authenticated images use temporary test accounts; populated plan images are explicitly named fixture, not live model output.
- Browser work found and fixed 320px Google-button overflow. Persistence check was corrected to wait for the real API response. Responsive suite PASSED: 48 capture checks plus populated plan reload/logout. Proctor browser suite PASSED using simulated camera/screen: one-question MCQ, navigation, session start and server-confirmed discard on window blur. See docs/prototype-refresh-verification.md.
- Latest user requested Hugging Face setup instructions; provided steps and docs/huggingface-setup.md. Awaiting user confirmation that HF_TOKEN is configured. Do not ask them to paste the secret. Next: restart the backend once configured, test real provider generation, validate curriculum, then conduct final end-to-end review.
- Remaining gates: live HF token/model generation, real Google/Gmail interactive verification, real-device proctor tolerance review, final visual approval and end-to-end review run. No production-grade completion claim.

## Historical Resume Notes (Superseded)

## Previous Resume Here

- Work exclusively in `/home/anj/skill_path_pdp`, upgrading the existing app in place.
- Do not restart from scratch or use `/home/anj/Desktop/skillpath-prototype` as the implementation target.
- Active increment: Figma-led UI foundation and authentication revision. User REJECTED Superdesign, including v4. Do not implement that proposal or reuse its bookshelf direction.
- Next action: resolve access to the user-selected Modern Product Launch reference, then inspect its actual styles/assets and implement new UI foundation/logo and authentication directly in the existing app. Do not invent extracted fonts/colors or claim exact reproduction without source access.
- Figma connection verified. User supplied Sites file `wALfMDQNopOxterXseDinL` (Modern Product Launch) and Design file `iGpb3AFcqZTU797uLCY8O5` (TOP 50 WEBSITES). TOP 50 is readable; its page is `0:1` LANDING PAGES. User explicitly selected Modern Product Launch as PRIMARY, not Attio or a mix of the collection.
- Latest reference: Sites file `pYSlELtXm1igNsR5Z4YrtJ`, node `0:1`. Read-only get_design_context returned the same no-edit-access error; whoami confirms authentication works. Do not assume this proves incorrect sharing settings: Sites compatibility may be the issue. Request a published preview or screenshots rather than repeating permission changes. No primary-reference styles/assets retrieved.
- User explicitly wants direct React implementation, NOT a Figma prototype or edits. Use Figma only for reading reference material; no further Superdesign or Figma design-generation work.
- User confirmed Full Stack Engineering as the first complete end-to-end domain. Deliver module by module; do not delete existing profiles in other domains. See `docs/prototype-delivery-plan.md` for concrete gaps and acceptance gates.
- Preserve existing uncommitted browser-test and screenshot changes. Branch at start: `skillpath-development`, three commits ahead of origin.

## Collaboration Contract

- Complete one increment at a time: clarify behavior, agree on visual direction, implement, verify, record evidence, obtain user review, then advance.
- Ask about unresolved product or visual decisions before implementing them. Do not repeatedly ask settled questions or questions answered by code inspection.
- Update this file at each implementation, verification, approval, or blocking checkpoint, including the exact next action.
- Distinguish planned, implemented, tested, and user-approved work. Never claim completeness from a successful build alone.
- Do not use Superdesign: latest user direction supersedes earlier requests. Use the requested Figma plugin and actual reference assets/styles when accessible. Use OpenAI Developers guidance where applicable, not as a UI library. Use Hugging Face models for personalization, with model/runtime selection deferred to that module.

## Agreed Product Requirements

- Deliver an end-to-end working local prototype, not a hosted deployment.
- Maintain existing React/Vite/Node/PostgreSQL implementation where suitable.
- Real email/password and Google sign-in; registration, real-inbox email verification and password recovery, persistent identity, and logout.
- New users complete a short required setup before the dashboard. Returning users go to the dashboard; unfinished setup resumes.
- Present required versus optional setup fields explicitly. No fictional prefilled profiles, simulated integrations, false upload success, or nonfunctional controls.
- Authenticated navigation must provide dashboard, assessments/results, learning plan, learning progress/history, profile, and logout.
- Dashboard shows actual saved assessment scores, per-skill progress, roadmap progress, and a useful Continue learning action. No invented metrics.
- Two assessment types: conversational technical assessment and MCQ assessment. Professional user-facing names remain to be approved.
- MCQ assessment shows one question at a time. Question navigation, timing, review, and submission rules require module-specific agreement.
- Compact assessment preparation and consent; avoid long scrolling checkbox pages.
- Camera monitoring must actually analyze video and display timely warnings. Exact assessment motion policies and detection tolerance remain to be agreed.
- Following assessments, generate a personalized learning roadmap from per-skill evidence, including estimated study time, demonstrated strengths, and topics eligible to skip.
- Each topic is divided into 10-minute proctored sessions. Learning is a paced one-to-one conversation, not a page containing all content at once.
- Sessions interleave instruction with timed, session-scoped questions. Answers can be typed or supplied by voice recording with speech-to-text.
- Empty response at timeout, leaving the tab, or detecting no person ends the current learning session without saving that session's progress. Previously completed sessions remain saved.
- Resume at the next unfinished session, restarting an abandoned session. Do not erase earlier completed learning.
- Timers, retry behavior, speech transcription deadlines, detector tolerances, successful completion criteria, and model failure handling must be agreed before that module is implemented.

## Visual Direction

- Coursera-inspired authentication; LeetCode, Udemy, and Coursera are broader usability references, not templates to copy wholesale.
- User selected a form with a restrained brand panel and emphasized balanced use of available space and sound proportions.
- Subtle colors, readable compact typography, clear hierarchy, structured navigation, and end-user terminology.
- No promotional filler, excessive cards, neon styling, decorative AI motifs, or implementation jargon in product copy.
- Avoid unnecessary page scrolling; retain accessible overflow on smaller screens and at increased zoom.
- User approved muted-blue accents inspired by Coursera, on white/light-gray surfaces with charcoal text and a restrained brand panel. Exact token values, typography, and layout will be proposed for visual review.
- Reference sites: https://uupm.cc/#styles and https://www.typeui.sh/ . User did not select the offered Shadcn or Minimal direction.

## Corrected Existing-App Baseline

- Earlier findings about simulated login applied to a different, older checkout and must not be attributed to this app.
- This app has PostgreSQL account storage, bcrypt password verification, server-side Google ID-token verification, and authenticated API requests.
- `src/App.tsx` restores identity and directs complete profiles to an existing dashboard; setup is used for incomplete profiles.
- Saved assessment history exists. Dashboard roadmap/progress views still need full end-to-end integration.
- Login UI currently combines a dark promotional section and sign-in/sign-up form. Recovery and email-verification flows require implementation review.
- Existing shared CSS has global `!important` input styles and conflicting palette definitions; incremental restyling must avoid breaking untouched screens.
- These are source-inspection findings, not fresh end-to-end verification results.

## Increment Queue

1. UI foundation, new logo and authentication: Superdesign rejected; Figma source access pending, then actual React implementation and review.
2. Working authentication and session lifecycle: IMPLEMENTED; automated checks passed; real Gmail/Google checks pending.
3. Profile setup: pending.
4. Dashboard and structured navigation: pending.
5. Assessment preparation and proctoring: pending.
6. Conversational assessment: pending.
7. Single-question MCQ assessment: pending.
8. Results and per-skill analysis: pending.
9. Hugging Face personalization and learning roadmap: pending.
10. Interactive learning, speech-to-text, and session proctoring: pending.
11. Integrated local workflows and review evidence: pending.

## Evidence and Decisions Log

### 2026-10-05: Initial Context Checkpoint

- User confirmed existing `/home/anj/skill_path_pdp` as target and enabled implementation mode.
- Inspected current app flow, login UI, styles, dependencies, and git status.
- Preserved all pre-existing changes; created this durable context file.
- Superdesign browser sign-in completed successfully. Do not store authorization codes or credentials here.
- Created all six non-empty `.superdesign/init/` context files from this checkout, including actual shared source and existing theme values.
- Saved authentication findings and future acceptance checks in `docs/authentication-audit.md`.
- Retrieved available Superdesign models. User selected muted blue on white/light-gray surfaces with charcoal text.
- Verified context file presence/non-empty content and ran `git diff --check` successfully. Application tests were not rerun for these documentation-only additions.
- No application behavior changed; no new test results claimed.

### 2026-10-05: Muted-Blue Authentication Proposal

- User explicitly selected muted-blue accents inspired by Coursera.
- Created `.superdesign/design-system.md` with approved direction and proposed review tokens; application CSS remains unchanged.
- Superdesign project: `d97eef26-d0cf-4263-9d13-a1e3c0793732`.
- Canvas: https://superdesign.dev/teams/c84eb8af-6214-48b7-bd28-7393f49302d0/projects/d97eef26-d0cf-4263-9d13-a1e3c0793732
- Generating an existing-login baseline before applying the approved redesign. Selected model: `gpt-5.6-luna`, listed by Superdesign as an available OpenAI design model.
- Shared context is limited to design brief, login component, wordmark, relevant CSS ranges, and Tailwind config. No secrets or user data are included.

## Completion Gate for Each Increment

- Document agreed behavior and unresolved decisions.
- Record files changed, meaningful checks, observed results, limitations, and evidence locations.
- Preserve Superdesign project/draft identifiers after successful creation.
- Capture user approval and next action before moving to the next increment.
- Never record credentials, reset tokens, OAuth tokens, or sensitive user data here.

### 2026-10-06: Authentication Implementation Checkpoint

- Decisions: Gmail SMTP with an app password; email/password accounts must verify before setup. Existing unverified accounts verify at next sign-in without losing saved data. Google-verified identity satisfies verification.
- Superdesign draft `0f9a52a6-c502-47cd-8ef3-2db11564a97b`, revision 3; preview https://p.superdesign.dev/draft/0f9a52a6-c502-47cd-8ef3-2db11564a97b . React adaptation changes typography/brand proportions based on latest user direction.
- Implemented scoped authentication layouts, sign-in/registration, verification gate, reset/recovery, show-password controls, and recoverable session restoration. No setup/dashboard restyling.
- Added PostgreSQL verification timestamps and hashed, expiring, single-use account tokens; Gmail-compatible Nodemailer delivery; per-endpoint request limiting; server-revocable JWT sessions; logout and reset invalidate sessions.
- Protected profile/document/assessment endpoints reject unverified accounts. Existing account/profile/assessment records are not erased. Previously issued JWTs without a stored session require sign-in again.
- `.env` has Gmail host/port/TLS defaults. SMTP_USER, SMTP_PASS, SMTP_FROM remain empty intentionally; only the user can supply actual credentials. Never put them in chat or commit them.
- `npm run test:auth`: 12 reported tests passed (11 scenarios plus parent), real local HTTP/PostgreSQL/SMTP. This validates SMTP protocol flow, not Gmail inbox delivery.
- `npm run test:unit`: policy test passed and 33 existing state-machine checks passed. `npm run build`: TypeScript and Vite passed. `git diff --check`: passed.
- `npm run test:api`: 17 reported tests passed, including profile persistence, account ownership, deterministic grading and chatbot progression. Temporary accounts are removed by test teardown.
- Desktop 1366x768 and mobile 390x844 screenshots saved in `screenshots/auth-increment/`; narrow 320x740 sign-up is horizontally contained but scrolls vertically. Browser password visibility toggle verified; no page errors observed in inspected screens.
- Existing API regression fixtures now verify their own temporary test accounts via the real endpoint. Full legacy browser workflow has old login selectors and immediate-setup expectations; it was not rerun or overwritten because it contains pre-existing user changes. Update it collaboratively before claiming full-app browser regression coverage.
- Local app: http://localhost:5173/ ; API 8787. Start with `npm run dev` after `npm run migrate`, with PostgreSQL running. Backend env changes require a restart.
- Pending: actual Gmail inbox delivery, successful interactive Google login, final auth review, and remembered-session policy (currently existing sessionStorage behavior, no remember-me claim).

### 2026-10-06: Visual Revision After User Feedback

- User supplied samber frontend-design-deslop and Aceternity Agenforce references; requested changed fonts, no kickers, and less empty/small UI. Asked composition question; answer: "a proper mix of both", followed by "continue".
- Directory skill link timed out; consulted original author repository. Viewed live Agenforce at https://agenforce-marketing-template.vercel.app/ and extracted reference analysis into `.superdesign/website/agenforce/design.md`.
- Typography verified in live reference: Manrope headings. Adopt for auth proposal; do not copy negative letter spacing, marketing hero, fake dashboard, gradients, glass or decorative grids.
- Created `DESIGN.md`; added superseding active direction at top of existing Superdesign design system. Historical direction retained for traceability.
- Revised existing Superdesign draft in replace mode with GPT-5.6 Luna, 5.5 credits; current version 4. Same preview/canvas identifiers as above.
- Reference screenshot node: `454dd4d4-f8c6-4058-b756-da6e94559d92`. Only public reference screenshot and listed UI source/design files shared; no environment secrets.
- Proposal: compact brand header, real bookshelf image, 480px form, Manrope headings/body, muted-blue primary action, no marketing kicker or fake product data. Existing italic logo retained as brand identity, separately from interface type.
- Browser-inspected desktop 1366x768 and mobile390x844; mobile document dimensions390x844, loaded image and computed Manrope verified. Screenshots: `screenshots/auth-increment/proposal-v4-desktop.png`, `proposal-v4-mobile.png`.
- These two images are Superdesign proposal screenshots, NOT the running React app. Application source and backend remain unchanged in this revision; application tests not rerun for design-only work. No services started, avoiding the earlier port conflict with the user's terminal.
- Pending review of layout/image. On approval: implement in AuthLayout/LoginPage/auth.css, locally install Manrope, preserve genuine Google SDK button constraints, use a licensed/local image, test all auth states and update evidence. Remember full app browser script still needs updated auth selectors/verification fixtures.
