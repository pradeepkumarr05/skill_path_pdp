# SkillPath UI Consistency Guide

## Product Feel

SkillPath should feel like a serious assessment and career-readiness product, not a generic dashboard. The interface should be calm, precise, and credible. The login page sets the standard: enough visual character to feel owned, but restrained enough for repeated professional use.

## Palette

The palette avoids common purple/blue SaaS gradients and avoids a one-note monochrome theme. It is built around deep pine, verdigris, muted saffron, and copper.

| Token | Hex | Role |
| --- | --- | --- |
| `skillpath.ink` | `#182522` | Main text |
| `skillpath.pine` | `#102A27` | Primary brand, main CTA, high-emphasis blocks |
| `skillpath.jade` | `#2B8073` | Active progress, links, successful motion |
| `skillpath.copper` | `#C87941` | Warm secondary emphasis |
| `skillpath.saffron` | `#C6A34A` | Progress marker and selective highlight |
| `skillpath.mist` | `#F4F7F5` | App background |
| `skillpath.paper` | `#FFFFFF` | Forms and primary surfaces |
| `skillpath.line` | `#D7E0DB` | Borders and separators |
| `skillpath.muted` | `#66756F` | Secondary copy |
| `skillpath.danger` | `#B94A48` | Validation and risk states |
| `skillpath.focus` | `#1D6F64` | Keyboard focus and input focus |

## Layout Rules

- Build one step per page. Do not expose future modules as a single dashboard.
- Every page must have one primary action and one clear next transition.
- Use 8px radius for cards, forms, buttons, and panels.
- Avoid cards inside cards. If a section needs internal grouping, use rows, separators, or subtle background bands.
- Keep surfaces stable. Buttons, step indicators, inputs, and provider buttons must not shift when state changes.
- Use responsive grids with explicit minimum widths so the UI remains composed on mobile.

## Typography

- Use `Inter` with system fallbacks.
- Do not use viewport-based font sizing.
- Letter spacing remains `0`; use weight, color, and spacing for hierarchy.
- Login page display text may be large, but forms and operational pages should use compact headings.

## Components

- Inputs: 48px height, left icon when useful, clear focus border.
- Buttons: icon plus text for commands; icon-only only when the icon is universally understood and has an accessible label.
- Provider buttons: same height, same border, no decorative provider cards.
- Progress indicators: short labels, visible state, and no oversized timeline graphics.
- Validation: inline, close to the field or action that caused it.

## What To Avoid

- Generic purple/blue gradients.
- Beige or brown-dominant editorial palettes.
- Stock-photo login panels.
- Oversized marketing hero copy.
- Floating decorative blobs, orbs, bokeh, or abstract AI-looking shapes.
- Exposing all architecture modules at once.
- Placeholder text that looks like final product copy.
