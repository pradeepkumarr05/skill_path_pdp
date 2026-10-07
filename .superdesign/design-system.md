# SkillPath Authentication Design Context

## Active Revision: 2026-10-06 (Supersedes Historical Direction Below)

User rejected the sparse panel, small UI, italic typography and redundant kickers. User selected a mix of product-focused form and substantial imagery, then explicitly asked to continue. Preserve all real authentication behavior.

- Artifact: account access for a technical-learning application, not a marketing landing page.
- Personality: clear, substantial, composed, credible. Essence: focused learning workspace.
- Typography: Manrope upright throughout the proposed authentication UI, weight 400/500/600/700. Heading 36px/1.2 desktop, 30px mobile; body and fields 16px; labels 14px; hints 13px. Letter spacing exactly zero. No Newsreader or italic-serif headings. Keep the existing SkillPath logo identity for now; do not invent an icon.
- Retain white and cool light-gray backgrounds, charcoal #20242A, muted #5F6875, blue #365F91, border #CCD3DB; semantic success #27724B, warning #8A5B13, error #B33838.
- Composition: compact top brand header, two-column main region with substantial photographic study-space visual and larger 480px form. Imagery about 42% of the main width. No empty tinted side panel. No floating form card or nested cards. Main region should fill a laptop screen without huge empty margins.
- Form remains the primary task. Inputs and buttons 48-52px, 6px radii, 44px icon hit targets. Explicit labels, visible focus, functional state hierarchy. Secondary text must remain readable, not tiny.
- Remove Technical learning kicker, redundant SkillPath footer, fluffy value propositions, promotional descriptions. Heading Sign in or Create account. Only useful field hints and genuine state feedback.
- Visual: real books/study-space photograph, subtly desaturated, clearly visible, no darkening overlay or blur. It establishes subject matter, never pretends to be an app screenshot or user data. No overlaid fabricated roadmap, badges, metrics or testimonials. A single short literal caption is optional, not a marketing pitch.
- Mobile: compact brand header; decorative image is hidden below 850px so the form remains immediately usable. Layout adapts down to 320px and allows scrolling when required; no clipped controls.
- Borrow Agenforce's Manrope type, strong hierarchy, generous control proportions and clear rules. Do NOT import its decorative grid, gigantic marketing heading, tilted dashboards, glass chips, shadows, negative tracking, pricing or sales navigation.
- This revision changes authentication only. Setup and dashboard remain later increments. Prior tokens and layouts below document history, not active design requirements.

## Scope and Workflow

Upgrade the existing SkillPath app in place. This canvas increment concerns authentication only. First reproduce the current sign-in page as a baseline; then replace that draft with the user-approved light muted-blue direction. Do not implement or design downstream modules yet. Drafts are visual proposals, not real authentication.

## Existing Baseline Reproduction

For the baseline only, faithfully use src/pages/LoginPage.tsx, src/components/SkillPathLogo.tsx, Tailwind values, and current global CSS. Keep the existing header, left marketing content and right form. Current fonts are Bricolage Grotesque Variable and Newsreader Variable italic. Current colors include dark ocean, forest, citron and teal. No design changes in the baseline generation.

## Approved Redesign Direction (For Subsequent Iteration)

User selected a Coursera-inspired form with a restrained brand panel, muted-blue accents, white/light-gray surfaces, and charcoal text. Inspiration is educational product clarity, not copying Coursera branding. The user emphasized balanced use of available space. Exact layout and tokens below are a proposed realization for review, not an approved implementation.

- Page: #FFFFFF. Secondary neutral surface: #F5F6F8. Brand-panel tint: #EDF2F8.
- Text: #22262D. Secondary text: #58616E. Border: #D6DCE4.
- Primary action and links: #365F91. Hover: #284B76. Focus: #365F91.
- Success: #27724B. Warning: #8A5B13. Error: #B33838. These are reserved for actual states.
- Proposed UI typography: system sans-serif, 14px labels, 16px fields/body, 28px form heading. Font weights 400/500/600. No viewport-scaled text or nonzero letter spacing.
- Preserve the SkillPath wordmark geometry and Newsreader italic identity from the supplied component. In the redesign use charcoal lettering with muted-blue underline, no glow. Do not invent a new logo.
- 4/8/12/16/24/32/48px spacing. Input/button height 48px; icon controls at least 44px. Radius 6px; no section-as-card, nested cards, or large decorative shadows.
- Desktop: unframed full-height composition, restrained left brand region and right white authentication region. Form width 400-440px. Use available width through balanced region proportions rather than giant empty margins or stretched inputs.
- Mobile: compact wordmark/header, then form; do not put a tall brand panel before the form. Maintain all controls at 320px width, keyboard access, and zoom-safe overflow.
- Fit the sign-in view at 1366x768 and 1440x900 without page scroll at default text size. Do not hide overflow to force this. Short/zoomed screens may scroll.
- No gradients, blobs, glows, charts, sample progress, social proof, fake learners, certification badges, feature cards, marketing hero, pre-login assessment navigation, or invented stats.

## Authentication Content

- SkillPath brand, Sign in heading, short account-access sentence only if needed.
- Continue with Google, Username or email, Password, show/hide password, Sign in, Forgot password?, Create account.
- Preserve username-or-email compatibility. No remembered-session checkbox until its behavior is agreed.
- Empty fields; no fictional identities or credentials. No placeholder success flow or simulated OAuth.
- Do not add help/legal/pricing links without an existing destination.
- Product drafts can show real form controls for layout, but must not claim a login, email delivery, or verification has occurred.

## Future Authentication States

Registration, email verification, recovery, reset, loading, and errors belong to this module, but first review the sign-in design before extending sibling screens. Preserve visual and keyboard consistency after approval. Model provider/backend terminology should not appear in the UI.
