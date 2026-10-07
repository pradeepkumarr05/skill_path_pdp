# SkillPath UI Direction

## Active Implementation: 2026-10-07

The user's supplied Area/Modern Product Launch screenshot resolves the visual-reference blocker. Latest instruction: soft muted colors, full-width pages, real dashboard content, no neon, and a welcome page that briefly explains the product. Implement directly in React; no Superdesign or Figma prototype.

- Locally hosted Manrope for interface text; upright Newsreader for welcome/auth headings. These are visual matches, not fonts extracted from Figma.
- White #ffffff, page #f7f8f7, sage #456653, soft sage #eaf1eb, muted blue #506f8d/#eaf0f7, charcoal #242e29, borders #dce2df. No glow, grain, gradient, or neon.
- Full-width workspace with 240px sidebar, responsive navigation, data tables, unframed sections, restrained 6-8px controls. No fake scores, testimonials, partner logos, or simulated integrations.
- Welcome is explicitly requested by the user. Its real landscape photograph is local at public/images/auth-landscape.jpg, sourced from https://images.unsplash.com/photo-1469474968028-56623f02e42e (replacement photo, not extracted Figma artwork). Asset is used under the Unsplash license: https://unsplash.com/license.
- Original stepped-path SkillPath logo; not the reference's Area wordmark.
- Authenticated screenshots with fixture in their filename are test-account evidence, not real learner outcomes or live Hugging Face generation.

Everything below is historical and superseded by this section.

## Latest Direction: Figma References Supersede This Proposal

Latest source link uses Sites key `pYSlELtXm1igNsR5Z4YrtJ`, node `0:1`. Read-only design-context retrieval returned an access error despite confirmed authentication. Sites compatibility is unresolved. Need published preview/screenshots; do not keep requesting permission changes. User explicitly forbids spending time on a Figma prototype: implement directly in React once visual reference is available.

Confirmed primary: Modern Product Launch, Sites file `wALfMDQNopOxterXseDinL`. User explicitly chose this over Attio. Access check returned no edit access; no styles or assets from the primary have been extracted. TOP 50 design file `iGpb3AFcqZTU797uLCY8O5` is readable. Attio section `1:6265` was inspected as a candidate only and is NOT approved for implementation. Do not import its fonts/colors into SkillPath or substitute the rejected bookshelf proposal.

User rejected Superdesign and requested a new logo and a UI closely based on these exact files:

- https://www.figma.com/community/file/1573023525218599861/modern-clean-saas-company
- https://www.figma.com/community/file/1487309170684591074/modern-product-launch

No Figma tokens/assets have been extracted yet: plugin connection is pending and public page access failed. Do not claim any font, color, component or animation below came from Figma. Do not implement the rejected bookshelf proposal. Preserve the historical notes below only for traceability. Next design work must inspect source frames and authorized assets, distinguish marketing composition from application workflows, and replace proposed tokens with verified values. A new SkillPath logo is explicitly authorized, but do not copy either template's brand identity.

## Current Increment

Authentication revision, 2026-10-06. Existing prototype only; preserve real auth and saved data. User requested a mix of substantial imagery and product-focused UI and authorized continuing. Do not redesign setup/dashboard until the authentication checkpoint.

## Direction

Clear, substantial, composed, credible. Focused learning workspace.

Use upright Manrope for interface headings and body. Replace the italic editorial headings and tiny forms. Keep the existing logo identity separately until a logo change is agreed. Compact brand header, useful content, substantial image region, prominent form; no empty brand billboard. No kickers, redundant footer branding, fake metrics, fake progress or decorative status indicators.

## Proposed Tokens

| Role | Value |
| --- | --- |
| Font | Manrope, sans-serif fallback |
| Text scale | 13, 14, 16, 20, 30, 36px; compact UI scale, not viewport-based |
| Heading/body weight | 700 / 400-500 |
| Page/surface | white / cool light gray |
| Text/muted | #20242A / #5F6875 |
| Accent/hover | #365F91 / #284B76 |
| Border | #CCD3DB |
| Success/warning/error | #27724B / #8A5B13 / #B33838 |
| Spacing | 4px base; 8, 12, 16, 24, 32, 48px |
| Radius | 6px controls, 0px page regions |
| Elevation | defined edges, no decorative shadow |
| Controls | 48-52px tall; icon targets at least 44px |
| Motion | 150ms state feedback; respect reduced motion |

## Layout and States

Main desktop composition fills available height, roughly 42% visual and 58% account-access area. Form maximum 480px. Study-space imagery must be genuine photography, not fake product data. Mobile prioritizes form and hides decorative imagery. No forced overflow hiding. Keep all account states (signup, verification, recovery/reset, errors, loading) consistent. No changes to server authentication in this visual revision.

## References

- User: https://aiagentskills.net/skill/samber-cc-skills-frontend-design-deslop
- Original skill consulted after directory timed out: https://github.com/samber/cc-skills/blob/main/skills/frontend-design-deslop/SKILL.md
- https://ui.aceternity.com/templates/agenforce-marketing-template
- Live reference: https://agenforce-marketing-template.vercel.app/
- Extracted design analysis: `.superdesign/website/agenforce/design.md`. This is reference material, not binding tokens; skip incompatible marketing effects.

## Verification

Superdesign v4 rendered and inspected at 1366x768 and 390x844. Mobile has no document overflow; photo loads; Manrope is the computed heading font. Preview screenshots in `screenshots/auth-increment/proposal-v4-*.png`. This is a proposal, not implemented React UI. Previous authentication test results are documented in `docs/prototype-progress.md`; they do not constitute visual approval of this revision. Next: user visual approval, then implementation and full auth-state checks.
