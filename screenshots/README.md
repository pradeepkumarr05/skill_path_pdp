# Screenshot evidence

The browser captures cover sign-in, sign-up, invalid and valid PDF selection, profile setup/review, dashboard restoration, access guidelines, the Gemini interview, deterministic MCQ assessment, results, roadmap, and returning-user restoration. Each checkpoint has desktop and mobile images where the browser flow permits it.

`browser-results-desktop.json` and `browser-results-mobile.json` record the checks. Camera and screen capture use Chromium's simulated media devices for repeatable CI evidence; the app still requests the real browser permissions in production.

The `test-output/` directory contains terminal output text and rendered screenshots for unit policy tests, legacy state-machine tests, API integration tests, and the production build. The API evidence run sets `ALLOW_DETERMINISTIC_AI_FALLBACK=true` so it remains repeatable when a provider request times out; the separate browser evidence used the configured Gemini SDK.
