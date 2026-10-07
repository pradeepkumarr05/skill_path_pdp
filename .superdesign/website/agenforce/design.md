---
version: "superdesign-alpha"
name: "Chalk-grid operator panel"
description: "Near-white, structural dark-on-light system built on a faint dot/line grid, with heavy Manrope display type, isometric dashboard illustrations as its only imagery, and interaction rationed to near-black solids and glass pill chips."
colors:
  background: "#FFFFFF"
  surface: "#F5F5F5"
  surface-alt: "#FAFAFA"
  text-primary: "#0A0A0A"
  text-secondary: "#737373"
  border: "#E5E5E5"
  border-soft: "#F5F5F5"
  accent-tint: "#DBEAFE"
  inverse-fill: "#171717"
  inverse-fill-strong: "#000000"
typography:
  display-lg:
    fontFamily: "Manrope"
    fontSize: "60px"
    fontWeight: 700
    lineHeight: "1"
    letterSpacing: "-1.5px"
  headline-md:
    fontFamily: "-apple-system"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: "1.56"
  body-md:
    fontFamily: "Inter"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "1.56"
  label-md:
    fontFamily: "-apple-system"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "1.5"
  body-default:
    fontFamily: "-apple-system"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.5"
spacing:
  base: "8px"
  micro: "4px"
  gap: "16px"
  gap-lg: "32px"
  section-padding: "128px"
rounded:
  control: "6px"
  control-alt: "7px"
  card: "24px"
  card-asymmetric: "24px 10px 10px 24px"
  pill: "9999px"
components:
  button-primary:
    background: "#171717"
    text-color: "#FAFAFA"
    radius: "6px"
    height: "36px"
    padding: "8px 16px"
    shadow: "rgba(0,0,0,0.01) -82px 54px 27px 0px, rgba(0,0,0,0.04) -52px 35px 25px 0px, rgba(0,0,0,0.15) -29px 19px 21px 0px, rgba(0,0,0,0.25) -13px 9px 16px 0px, rgba(0,0,0,0.29) -3px 2px 9px 0px"
    hover-background: "#171717"
  button-secondary-dark:
    background: "#000000"
    text-color: "#0A0A0A"
    radius: "7px"
    height: "36px"
    padding: "8px 16px"
  button-outline-pill:
    background: "transparent"
    text-color: "#0A0A0A"
    radius: "9999px"
    height: "40px"
    padding: "0px"
    border: "1px solid lab(90.952 0 -0.0000119209)"
  button-tint-chip:
    background: "#DBEAFE"
    text-color: "#0A0A0A"
    radius: "6px"
    height: "26px"
    padding: "4px 8px"
    border: "1px solid lab(86.15 -4.04379 -21.0797)"
  card-media-bleed:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-icon-panel:
    background: "#F5F5F5"
    radius: "24px"
    padding: "32px"
  card-asymmetric-panel:
    background: "#FAFAFA"
    radius: "24px 10px 10px 24px"
    padding: "0px"
  card-glass-pill:
    background: "rgba(245, 245, 245, 0.6)"
    radius: "9999px"
    shadow: "rgba(0,0,0,0.1) 0px 1px 3px 0px, rgba(0,0,0,0.1) 0px 1px 2px -1px"
    padding: "0px"
---
# Chalk-grid operator panel
Source: https://agenforce-marketing-template.vercel.app/

## Overview
This is a light-mode-default, structural minimalism in the Swiss/International lineage: a near-white canvas, a faint hairline dot-grid texture underneath everything, and bold grotesque display type (Manrope, 60px/700, -1.5px tracking) as the only loud element. Imagery is restricted to isometric product-dashboard illustrations rendered at low opacity, bleeding diagonally off-canvas — never full-color photography. Interaction is rationed almost entirely to near-black fills (#171717/#000000); color appears only as a single pale-blue tint chip and the faint tool-icon marks inside illustrations. The feel is "operator software, documented like a spec sheet" — confident, dense, unembellished.

## Composition
The first screen is classic centered-hero-over-diagonal-dashboard: a two-line bold headline, a muted one-paragraph subhead, a solid dark CTA beside a plain-text link, then an oblique, rotated product-screenshot collage receding into the page, cropped at the fold. Below the fold the page runs a strict alternating rhythm: a heading + supporting paragraph pair, then a content band (card row or split illustration), repeated four times, each separated by full-bleed hairline rules rather than background-color changes — a deliberate choice to keep everything on one near-white plane rather than banding sections with alternating surface tones (the rejected alternative). Density increases in the three-column icon-caption triad sections and loosens again at the FAQ, which uses a single stacked accordion column at the page's max-width. The footer closes the page as a four-column strip on a hairline-topped band, still on the same white field.

## Colors
Background is #FFFFFF, confirmed dominant at ~84% of rendered pixels, with #F0F0F0 (~13%) as the secondary surface tone used for card fills and the grid-dot ink. Text ink is #0A0A0A for primary copy and headings, #737373 for secondary/supporting paragraphs — this two-step gray hierarchy is the entire "color" system for text. Borders run hairline #E5E5E5 and #F5F5F5, nearly invisible, used only to separate stacked sections and split two-column panels. The sole hue accent is a pale blue tint (#DBEAFE) on one small chip/badge component, bordered in a faint blue-gray (lab(86.15 -4.04379 -21.0797)) — this is the single rationed color note in an otherwise achromatic system, and it is never used for large fills, only a ~26px-tall label chip. Red tokens (#FFE2E2/#FFC9C9/#FFA2A2) exist in the author's palette but are not visible in the rendered screens — treat them as an unused semantic-danger ramp, not part of the live palette. Nothing else is colored: icons, illustration line art, and dashboard mockups stay grayscale/near-black to keep the one blue note legible as the only departure from neutral.

## Typography
Manrope carries all display headlines at 60px/700/lh-1/-1.5px tracking — tight, heavy, all-caps-adjacent weight that reads as the system's single voice of emphasis; it repeats identically at the top of every major section (never downsized for subheads). Inter sits underneath at 18px/400/lh-1.56 for lede paragraphs directly below headlines. A system (-apple-system) face handles two supporting jobs: headline-md labels at 18px/500 (card titles, accordion question rows) and label-md/body-default at 16px/500 and 16px/400 (captions, nav items, footer links) — body copy renders at #0A0A0A with secondary notes dropping to #737373. There is no serif or monospace accent anywhere in this system; Manrope's weight contrast against thin-set Inter body text is the entire hierarchy mechanism.

## Layout
Content is capped at a 1280px max-width, centered, with 128px vertical section padding — generous enough that sections read as discrete chapters despite sharing one background. Card grids are measured in three distinct rhythms: a three-up feature row (rows of [3]) with equal-width icon-cards; a two-column heading-versus-illustration split (46/46 with a 40px gap) used for paired capability panels; and a dense four-item 2×2 grid (rows of [2][2] at 50/50) for smaller sub-feature callouts. The mid-page triptych of media-bleed cards reads as rows [3][3] at even 33% widths each — a uniform card grid, not bento, confirming equal visual weight across all three. The near-footer FAQ/pricing-adjacent panels run single-column full-width rows (stacked at 100% each), while two wider two-up panels near the page end (67/67) carry heavier anatomy (heading + list + icon + body + embedded tile cluster). Spacing increments of 8/16/32px govern internal card padding; the baseline grid is subtle but consistent. Nothing scrolls horizontally; everything is a vertically stacked, centered, single-track responsive column system.

## Components
- **Navbar**: edge-to-edge full-width bar, white background, hairline bottom border, no visible radius (sharp rectangular strip spanning the viewport). Contains a mark + wordmark lockup on the left, four plain-text nav items center-left, and a two-item right cluster: a bare-text "Login" link plus one solid dark CTA button (#171717 fill / #FAFAFA text / 6px radius / 36px height / 8px 16px padding) — this CTA is the nav utility action, not the hero primary.
- **Hero primary CTA**: a solid near-black pill/rectangle (observed near-black fill, ~6–8px corners, slightly-rounded) sitting directly under the hero subhead, paired with a plain underline-free text link beside it as the secondary action. This is the single most emphasized control on the first screen.
- **Button — inverse-fill (primary)**: #171717 fill, #FAFAFA text, 6px radius (slightly-rounded), 36px height, 8px 16px padding, cast with a long soft multi-layer directional drop shadow; used for the hero CTA and footer "start trial" CTA.
- **Button — near-black variant**: #000000 fill, 7px radius, 36px height, seen once near the page end as a footer-adjacent action; functionally identical role to the primary but a separate measured instance.
- **Button — outline pill**: transparent fill, full pill radius (9999px), 40px height, 1px hairline border near-white-gray, no padding reserve beyond content — used for secondary/tertiary text-button moments mid-page.
- **Button — tint chip**: #DBEAFE fill, 6px radius, 26px height, 4px 8px padding, thin blue-gray border — the system's only colored control, used as a small inline label/badge, not a CTA.
- **Feature triptych cards** (mid-page, "Built for Fast Moving Teams"): ×3 in a row (rows [3]), transparent/white ground sitting on the page field, each a tall media-bleed illustration occupying roughly the top half of the card, a bold -apple-system heading below, and a small circular "+" expand icon in the corner — media coverage dominates, text is compact.
- **Capability split panels** ("Agent Studio" / "Multi-Agent Orchestration"): ×2 side-by-side (2-column, 46/46, 40px gap), each a heading + short body paragraph on top with a large illustration panel beneath — one side a flat #F5F5F5 placeholder block, the other an orbit-style radial illustration with small app-icon satellites and floating annotation cards.
- **Sub-feature row** (Workflow Automation / Integration Fabric / Human-in-the-Loop): ×3 across in a row, no card chrome (transparent, 0px radius), each simply a small line-icon + bold label + one-line gray body caption — the lightest-weight component in the system.
- **Icon-panel cards** (near page end, FAQ-adjacent feature band): ×5 stacked full-width (rows of [1][1][1][1][1] at 100% each), #F5F5F5 fill, 24px radius, 32px padding, anatomy of heading + icon + body text — this is the "comfortable card" surface, the only one with visible fill and generous radius.
- **Asymmetric panel cards**: ×3, #FAFAFA fill, distinctive 24px 10px 10px 24px radius (rounded only on the left pair of corners), anatomy heading + icon + body text — likely paired left-right with an adjoining media panel, giving a "continuous capsule" look when docked beside imagery.
- **Glass pill cards**: ×3, translucent rgba(245,245,245,0.6) fill, full pill radius, soft shadow (`rgba(0,0,0,0.1) 0px 1px 3px 0px, rgba(0,0,0,0.1) 0px 1px 2px -1px`), no padding — small floating translucent chips layered over illustration scenes (the annotation tags seen hovering near the orbit diagram).
- **Accordion rows** (FAQ): stacked single-column list, #F5F5F5 panel fill, rounded corners, each row a bold question label plus a circular minus/plus toggle icon at the right edge — all shown expanded/flat in the capture, no visible chevron rotation state beyond the icon swap.
- **Footer**: transparent background sitting on the page's white field, hairline top rule, four-column layout — logo + one-line descriptor + dark CTA button in column one, then three link columns (17 links total) and a newsletter email-capture row with a small dark send-icon button; closes with a legal micro-row (copyright + two legal links + four social icons).

## Graphics & Effects
The background texture is a faint rectilinear dot/line grid built from two stacked linear-gradient hairline patterns (`linear-gradient(to right, lab(96.52 ...) 1px, transparent 1px)` crossed with its vertical twin), covering roughly 64% of the page as the base field, with a second, slightly darker grid variant (lab(90.952 ...)) covering ~15% for emphasis zones — this reads as a faint graph-paper/blueprint texture under the hero and feature bands, not a visible gradient wash; render it as a 1px light-gray grid at very low contrast, never as a colored gradient. A diagonal 45°-repeating hairline scrim (`repeating-linear-gradient(315deg, oklab(0.145 ... /0.05) ...)`) sits directly over the dashboard/illustration media, adding a subtle diagonal line texture to screenshots rather than a darkening overlay. Elevation is expressed through long, soft, directionally-offset drop shadows on primary buttons (multi-stop, up to `-82px 54px 27px` blur at 1% opacity, stacking to `-3px 2px 9px` at 29% opacity close-in) — a dramatic "light source upper-right" cast shadow unique to this system's CTA, plus conventional soft card shadows (`0 25px 50px -12px rgba(0,0,0,.25)`, `0 20px 25px -5px / 0 8px 10px -6px rgba(0,0,0,.1)`) for modals/popovers. Backdrop blur (`blur(17.47px)`, `blur(16.73px)`, `blur(12px)`) is applied to the glass pill annotation cards floating over illustrations, giving them a frosted lift off the flat dashboard behind them. No photographic imagery or video exists; all "media" is grayscale isometric dashboard/app-UI illustration.

## Motion
All interactive transitions share one timing contract: 0.2s cubic-bezier(0.4, 0, 0.2, 1) for color/background/shadow/transform changes on buttons and controls, with a brisker 0.15s variant for immediate micro-interactions and a slower 0.3s pass for larger state changes (accordion open/close, panel reveals). A `spin` keyframe drives loading/processing iconography, and an `orbit` keyframe animates the satellite icons circling the radial hub illustration in the multi-agent panel — continuous, slow rotation, not scroll-linked. No scroll-triggered reveal or parallax is evident; the system favors static, settled compositions with motion reserved for discrete control feedback and the one orbiting diagram.

## Guardrails
- Never tint the background with color — it is #FFFFFF with a faint gray dot-grid texture, not a gradient or dark surface.
- Do not recolor the hero CTA to match the pale-blue chip; the primary action stays near-black (#171717/#000000) and the blue tint remains a single small label accent only.
- Preserve the asymmetric 24px/10px mixed-corner radius on its specific card family — do not round all four corners equally.
- Keep illustration media grayscale/low-saturation; do not insert photographic or saturated-color imagery into the dashboard/orbit panels.
- Do not merge the outline-pill, tint-chip, and inverse-fill buttons into one variant — each has a distinct radius, height, and fill that must stay separate.
- Maintain hairline-rule section separation on one continuous white plane; do not introduce alternating dark/light section bands.