# Implementation notes

## Branch and scope

Work is based on GitHub's `skillpath-development`, fetched at `17cc85e`. The requested name `skill-path-development` does not exist on the remote. Existing uncommitted profile/styles work on `main` was preserved in a named Git stash before switching; it was not overwritten.

The root application is the runnable source. The development branch originally tracked over 14,000 generated dependency files including Windows binaries. These are removed from the Git index, with installation governed by `package-lock.json` and the existing ignore rules.

## Authentication and setup

The original Google callback accepted a browser-side success without server verification. It now receives a Google Identity Services ID credential and sends it to `POST /api/auth/google`. `google-auth-library` verifies it against `GOOGLE_CLIENT_ID`, and accounts are linked to Google's immutable subject. Verified Google emails can link an existing account. No token or key is written to application logs.

The former email-only upsert login endpoint was removed. Registration inserts a new account and rejects duplicates; credentials login verifies a bcrypt hash. API authentication requires signed HS256 tokens, a configured secret, and an existing account. Sign-in attempts are limited per remote address; production reverse-proxy deployments should use an appropriate trusted edge rate limit as well.

`POST /api/auth/profile` updates only the authenticated account. It persists the complete setup form, keeps the account email immutable, and invalidates old active assessments if the profile changes. `GET /api/auth/me` restores setup and the latest deterministic score. The initial route after completed setup or returning login is the Learning Gap Engine.

Uploads use `POST /api/auth/document`. Extension, base64, size, PDF signature, parser validity, encryption, and page count are checked server-side. Documents are stored by account and kind, so one account cannot replace another account's PDF.

## Assessments and concurrency

Gemini generation and scoring use `@google/genai`, structured schemas, abort signals, a bounded timeout, and transient retries. The existing adaptive state machine remains in `agentRuntimeDb.mjs`. In normal mode, model failures roll back the request transaction and return 503. Offline question-bank/heuristic fallback must be enabled explicitly.

Assessment mutations run inside a PostgreSQL transaction with a candidate-level advisory lock. `AsyncLocalStorage` propagates the transaction connection to runtime helpers. Nested transactions reuse the connection. This serializes duplicate starts, submissions, and proctor events across API instances. Active starts are idempotent, submitted MCQ scores cannot be replaced by resubmission, and cross-account session fetches are denied.

MCQ grading accepts only integer choices within range; null, booleans, strings, and out-of-range values cannot become answer zero. Requests received more than five seconds after the deadline cannot supply new scored answers. The five-second allowance covers transmission of the browser's automatic timeout submission.

## Proctoring and privacy

Guidelines require a live camera, entire-screen capture, and fullscreen before entry. Stream loss listeners and periodic checks cover both assessment screens. Camera frames are sampled locally at 64x48 once per second. Sustained frame change or persistent darkness generates rate-limited review events; no pixels leave the browser.

Camera/screen/fullscreen loss terminates the server session. Focus, clipboard, and context-menu events use warning counts. Correlated chat focus events are deduplicated. The server validates event types and enforces ownership. Motion review events are stored without increasing the disqualification count.

Browser event reporting can be bypassed by a modified client and cannot prove absence of cheating. There is no face-recognition, phone detection, audio classification, or remote video-review service in this implementation. A high-assurance examination environment requires additional managed-client or human-review infrastructure. The UI and README describe the implemented behavior accurately.

## UI

The existing dark/teal/citron theme is retained with solid backgrounds. Login is a compact form with welcome-back copy, clear sign-in/signup modes, password visibility controls, pending/error states, and Google identity controls when configured. Setup removes fictional candidate values, restores education fields, locks account email, provides accessible form labels and explicit PDF errors, and keeps failed saves on the form. Heading and button contrast were corrected after screenshot review. Camera previews remain in normal document flow on small screens.

## Verification boundaries

Production policy tests cover answer validation, deterministic catalog invariants, public answer-key hiding, and event validation. The repository's 33 legacy state-machine checks are retained but duplicate some scoring logic rather than importing the database runtime. API integration tests exercise real PostgreSQL, credential login, forged Google credential rejection, document parsing, ownership, idempotency, proctor termination, and live Gemini progression.

Browser evidence uses real app/API/database paths and simulated camera/screen devices. Google consent still requires the user's configured OAuth client and account. The learning roadmap's pre-existing lesson notebook remains client-local; persistent notebooks and additional deterministic domain banks are outside the four requested modules.
