# SkillPath

Professional profile setup, a Gemini technical interview, a deterministic skills assessment, and a Learning Gap Engine. This implementation is on `skillpath-development` (the actual GitHub branch name).

## Run locally

1. Install Node.js 22+ and PostgreSQL 15+.
2. Run `npm ci`. Dependencies are installed from the lockfile; `node_modules` is not source code.
3. Create a PostgreSQL database, then copy `.env.example` to `.env` (`cp .env.example .env` on macOS/Linux).
4. Set `DATABASE_URL` and generate `JWT_SECRET` using `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Use that output as the secret; keep `.env` private.
5. Configure Google and Gemini below.
6. Run `npm run migrate`, then `npm run dev`.
7. Open http://localhost:5173. The API is at http://localhost:8787. Restart both processes after changing environment variables.

Example local PostgreSQL container:

```sh
docker run --name skillpath-db -e POSTGRES_USER=skillpath -e POSTGRES_PASSWORD=local-password -e POSTGRES_DB=skillpath -p 5432:5432 -d postgres:15-alpine
```

Use `postgresql://skillpath:local-password@localhost:5432/skillpath` for this example only. Use a separate password and database for production.

## Google sign-in setup

1. In [Google Cloud Console](https://console.cloud.google.com/), select or create your project.
2. Configure Google Auth Platform branding and audience. While the app is in testing, add the Google accounts that will test it as test users.
3. Create an OAuth client of type **Web application**.
4. Add `http://localhost:5173` to **Authorized JavaScript origins**. Add your exact HTTPS production origin when deploying. Hostnames and ports must match; `127.0.0.1` is a different origin.
5. Put the same client ID in `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` in `.env`. The ID is public configuration, not a client secret. This popup ID-token flow does not require a client secret or callback route.
6. Restart the app. Choose **Sign in with Google** or **Sign up with Google**. The server verifies the ID token signature, audience, expiry, and verified email before issuing an application token.
7. A new account opens profile setup. A returning account with completed setup opens the Learning Gap Engine with its saved profile and latest result.

The Google button is only displayed when the client ID is configured. Password accounts remain supported. A real Google popup/consent flow still needs your OAuth client and a test account; forged-token rejection is covered by automated tests.

Reference: [Google server-side ID-token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Gemini setup

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey), with API access and quota for your project.
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.6-flash`. The previous local `gemini-2.5-flash` configuration was rejected by the provider during verification.
3. Keep `ALLOW_DETERMINISTIC_AI_FALLBACK=false` for normal operation. Unavailable AI then produces a retryable error instead of silently assigning a heuristic score.
4. The server uses the official `@google/genai` SDK with structured JSON responses, a 20-second request timeout, and one retry for transient failures. `GEMINI_TIMEOUT_MS` must be at least 10000.

For explicitly offline development only, setting `ALLOW_DETERMINISTIC_AI_FALLBACK=true` enables the existing question bank and heuristic evaluator. Those scores are not equivalent to Gemini evaluation. Never expose the Gemini key through a `VITE_` variable.

Reference: [Google GenAI SDK](https://github.com/googleapis/js-genai).

## Assessment behavior

- The AI interview assesses claimed skills with medium questions and an optional harder follow-up, using a server-controlled timer and persisted state.
- The deterministic module is the existing **22-question Full Stack MCQ assessment**, not a second generative chatbot. Its answer keys remain server-side until submission.
- The deterministic catalog currently covers Full Stack Engineering. Other profile interests do not imply that additional domain question banks exist.
- Camera and entire-screen sharing are required. Microphone is optional. Use desktop Chrome or Edge on localhost or HTTPS; mobile browsers generally do not provide the required screen capture APIs.
- Both assessments display a live camera thumbnail. Lost camera, screen sharing, or fullscreen terminates the assessment. Clipboard/context-menu attempts and focus changes are logged; repeated warnings terminate the session.
- Camera motion and persistent darkness are local review signals. They do not automatically prove cheating or disqualify a person. This browser-based implementation does not identify extra faces, phones, voices, or activity outside the shared screen.
- Video is not recorded or uploaded. Only proctoring events, answers, scores, timestamps, and uploaded PDF documents are persisted.
- Optional resume/transcript uploads accept actual, unencrypted PDFs up to 5 MB. The server parses and stores the bytes in PostgreSQL.

## Verification

```sh
npm run test:unit
npm run test:api       # requires the running API/database and configured Gemini
npm run build
npx playwright install chromium
npm run test:browser   # requires localhost:5173 and localhost:8787
```

The browser test creates test accounts and uploads a generated PDF. It exercises signup, setup, restoration, both assessments, video playback, scores, and responsive screens. It uses Chromium's simulated media and live configured Gemini. Test accounts are left in the dedicated development database for inspection; do not run these tests against production.

See [implementation notes](docs/IMPLEMENTATION.md) and [screenshots and evidence](screenshots/README.md). No automated suite establishes 100% correctness or proves that a browser can detect every form of cheating.

## Deployment

Build with `npm run build`; serve `dist/` and proxy `/api` to the Node API. Set `CLIENT_ORIGIN` to the exact frontend HTTPS origin, configure Google with that origin, run migrations before deploying, and set all secrets on the API host. The development proxy targets port 8787. Bearer tokens are kept in browser session storage and expire according to `JWT_EXPIRES_IN` (default 7 days); sign-out clears the local token. Production deployments should also configure HTTPS, backups, document retention, monitoring, and an appropriate token lifetime.
