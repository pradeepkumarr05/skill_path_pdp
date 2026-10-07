# Extractable Components

## SkillPathLogo
- Source: src/components/SkillPathLogo.tsx
- Category: basic
- Existing SVG wordmark; tone is light or dark.
- Hardcoded: wordmark text, path, viewBox, typography.
- Keep source context for auth reproduction. No reusable remote logo asset exists yet.

## DashboardNavigation
- Source: src/App.tsx (Dashboard function)
- Category: layout
- Workspace navigation is embedded in Dashboard, not shared with authentication.
- Future props: active view, candidate display identity.
- Not needed for the authentication draft; do not extract it during this increment.

Page-local inputs/buttons/status summaries are not existing shared primitives. Do not invent shared components in baseline documentation.

