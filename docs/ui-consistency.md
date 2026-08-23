# SkillPath UI Consistency Guide

## Product Feel

SkillPath should feel like a serious assessment and career-readiness product with a distinct identity. The interface should be confident, structured, and visually owned. Each page must feel like part of a real product flow, not a generic dashboard or architecture diagram.

## Palette

The palette uses strong solids, high contrast, and controlled accent color. Avoid washed-out neutrals and default SaaS blues.

| Token | Hex | Role |
| --- | --- | --- |
| `skillpath.ink` | `#151515` | Main text |
| `skillpath.night` | `#101314` | App shell, brand panel, primary CTA |
| `skillpath.forest` | `#123D35` | Secondary solid brand block |
| `skillpath.teal` | `#00A884` | Active progress and successful interaction |
| `skillpath.citron` | `#D7FF4F` | Signature highlight and status emphasis |
| `skillpath.cream` | `#F7F0E6` | Dark-panel text and input surfaces |
| `skillpath.paper` | `#FFFCF6` | Form surface |
| `skillpath.line` | `#D9CDBE` | Borders and separators |
| `skillpath.muted` | `#6E665D` | Secondary copy |
| `skillpath.danger` | `#BC3930` | Validation and risk states |
| `skillpath.focus` | `#007A63` | Keyboard and input focus |

## Typography

- Product UI uses `Bricolage Grotesque Variable`.
- The SkillPath wordmark uses `Newsreader Variable` italic with a custom underline.
- Do not use Inter or generic system-only typography for final page designs.
- Do not use viewport-based font sizing.
- Letter spacing remains `0`; use weight, scale, and color for hierarchy.

## Layout Rules

- Build one step per page.
- Use the full available desktop width. Avoid narrow centered app shells unless the page is a focused modal or document.
- Every page must be mobile responsive, with controls stacking cleanly below tablet widths.
- Do not expose the full pipeline as a diagram inside the UI.
- Progress should appear like a professional product status: `1/4 complete`, a compact progress bar, or a concise next-step marker.
- Every page must have one primary action and one clear next transition.
- Use 8px radius for cards, forms, buttons, and panels.
- Keep surfaces stable. Buttons, inputs, and progress indicators must not shift when state changes.
- Use responsive grids with explicit minimum widths so the UI remains composed on mobile.
- Avoid decorative kicker labels above headings unless the label carries essential product state.

## Components

- Inputs: 48px height, solid fill, clear focus border.
- Buttons: strong solid primary action; provider buttons should be equal weight and visually balanced.
- Icons: use Phosphor icons for app UI unless a page has a specific reason to use another set.
- Progress indicators: concise product status, not an architecture pipeline.
- Validation: inline, close to the field or action that caused it.

## What To Avoid

- Mentions that the product is a demo or temporary build in user-facing UI.
- Generic purple/blue gradients.
- Thin, pale, low-contrast palettes.
- Stock-photo login panels.
- Oversized marketing pages.
- Floating decorative blobs, orbs, bokeh, or abstract AI-looking shapes.
- Exposing all architecture modules at once.
- Placeholder text that looks like final product copy.
- Filler status labels that do not map to real product objects.
