# Authentication Increment: Baseline Audit

Date: 2026-10-05
Target: existing `/home/anj/skill_path_pdp` application
Status: baseline findings below retained for history. Authentication implemented on 2026-10-06; see implementation checkpoint below.

## Existing Behavior to Preserve

- Password registration/sign-in uses PostgreSQL and bcrypt with cost 12.
- Google ID tokens are verified server-side for the configured audience; verified email and provider subject are required.
- Protected endpoints verify JWT identity and load the candidate from the database.
- Assessment mutations receive the authenticated candidate identity; do not replace these with browser-supplied ownership.
- Account restoration routes incomplete profiles to setup and complete profiles to the dashboard.
- Registration and login have an existing per-IP request limit.

## Gaps for the Authentication Increment

| Area | Source observation | Required outcome |
| --- | --- | --- |
| Verification | No email-verification endpoints or UI in the current auth flow | Real-inbox verification, explicit pending state, expiring single-use verification credentials |
| Recovery | No forgot/reset-password routes or UI | Real delivery, expiring single-use reset credentials, clear expired-link and retry states |
| Logout | Frontend clears sessionStorage only; JWT verification has no logout revocation check | Server-enforced invalidation and predictable subsequent sign-in |
| Persistence | Token stored in sessionStorage; not a durable cross-browser-session login | Agree on remembered-session behavior and implement/test it explicitly |
| Restore errors | App clears identity on any currentUser failure | Distinguish expired authentication from temporary service/network failure |
| Routing | React step state; no URL-based authenticated route model | Review deep-link/back/refresh behavior with the navigation increment |
| Google configuration | UI depends on VITE_GOOGLE_CLIENT_ID; server depends on GOOGLE_CLIENT_ID | Verify matching real configuration without exposing values; no fake success fallback |
| Profile API typing | Client login(profile) advertises LoginResponse while profile endpoint returns candidate only | Correct contract when editing the affected auth integration |
| Visual consistency | Global CSS overrides inputs and links with !important dark colors | Scope authentication styling so later pages are not accidentally restyled |
| Login copy | Large promotional area and pre-login assessment anchors | Focus on account access with concise user-facing copy and approved brand panel |

## Original Pending Decisions (Resolved Where Noted)

- Exact visual tokens and approval of the Superdesign authentication proposal.
- Gmail SMTP with an app password selected; user must populate credentials locally.
- Remembered-session duration and verification gating details before authentication implementation.
- Verification required before setup, including existing unverified accounts at next sign-in; saved data retained.

## Required Verification Before Auth Is Called Complete

- Register, duplicate account, malformed input, wrong password, and rate limiting.
- Verification delivery, valid/expired/reused verification credentials, and resend behavior.
- Password recovery delivery, valid/expired/reused reset credentials, and invalidation of affected sessions.
- Google real sign-in and invalid token rejection; provider failure/cancellation handling.
- Logout invalidates the server session; expired credentials cannot access protected endpoints.
- Refresh restores the proper user destination; transient network failures are recoverable.
- New user, incomplete setup, and returning-user destinations are correct.
- Keyboard, labels, focus, loading/errors, mobile layout, laptop viewport fit, and zoom behavior.

Do not label these scenarios passed until they have actually run. A design preview is not an authentication integration test.

## Implementation Checkpoint: 2026-10-06

- Backend: `authMail.mjs`, `auth.mjs`, `accountService.mjs`, `index.mjs`, `migrate.mjs`.
- Frontend: `LoginPage.tsx`, `AuthLayout.tsx`, `auth.css`, `skillpathApi.ts`, auth routing in `App.tsx`.
- Authentication integration suite: `npm run test:auth`, Node test runner with real PostgreSQL and a local SMTP receiver. 12 reported tests passed: delivery/token hashing, unverified gating, resend throttling, single-use verification, session revocation, recovery non-enumeration response, invalid/expired/purpose-mismatched tokens, concurrent reset, invalid Google tokens, origin checks and rate limiting.
- Build and existing policy/state-machine unit checks passed. Browser screenshots: `screenshots/auth-increment/`.
- SMTP integration does not prove Gmail deliverability. Invalid Google token rejection does not prove successful Google sign-in. Those remain manual provider checks, as do full keyboard/zoom coverage and all returning-user navigation paths.
- Gmail defaults are present in ignored `.env`; populate SMTP_USER and SMTP_FROM with the sender Gmail address, SMTP_PASS with its app password. Do not use or disclose the normal Google password. Restart API after changes.
- Session storage policy remains unchanged: sessionStorage, seven-day JWT expiry, now validated against revocable server sessions. No cross-browser remembered-session promise.
