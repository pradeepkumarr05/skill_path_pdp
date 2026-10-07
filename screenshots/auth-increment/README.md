# Authentication Review Evidence

Captured from the running React application on 2026-10-06 using Chromium browser automation. These are actual browser screenshots, not Superdesign renders or terminal screenshots.

Exception: `proposal-v4-desktop.png` and `proposal-v4-mobile.png` are browser screenshots of the revised Superdesign proposal, not the running React app. They await approval and implementation. Original app captures below remain unchanged.

- `sign-in-desktop.png`: 1366x768 sign-in.
- `sign-up-desktop.png`: 1366x768 registration.
- `sign-in-mobile.png`: 390x844 sign-in.
- `sign-up-mobile.png`: 390x844 registration, no page overflow.
- `password-recovery-mobile.png`: 390x844 recovery form.
- `sign-up-narrow.png`: 320x740 registration, viewport capture; vertical scrolling is intentionally retained. No horizontal overflow.

## Executed Checks

| Command | Observed result |
| --- | --- |
| `npm run test:auth` | 12 reported tests passed, 0 failed; local HTTP, PostgreSQL and SMTP lifecycle |
| `npm run test:api` | 17 reported tests passed, 0 failed; account/profile/assessment regressions |
| `npm run test:unit` | Policy test and 33 state-machine checks passed |
| `npm run build` | TypeScript and Vite production build passed |

Test counts include parent tests. Local SMTP tests do not prove Gmail inbox delivery. Successful interactive Google sign-in has not been tested. Full-app browser tests have not been rerun; their legacy login selectors and verification assumptions need updating. Existing screenshots outside this folder are not evidence for this increment.

Next gate: configure real Gmail credentials locally, test inbox delivery and Google sign-in, then obtain user approval of authentication before proceeding to setup.
