# UI Theme And Layout Consistency

## Design Direction

The prototype uses a quiet operational dashboard style. The first screen is the working agent console, not a marketing landing page. The visual hierarchy emphasizes repeated use: dense module summaries, status chips, event logs, assessment controls, roadmap progression, and performance review.

## Theme Tokens

The Tailwind token source is `tailwind.config.js`.

| Token | Value | Use |
| --- | --- | --- |
| `agent.canvas` | `#f5f7fb` | Application background |
| `agent.surface` | `#ffffff` | Primary working surfaces |
| `agent.panel` | `#eef5f6` | Low-emphasis grouped panels |
| `agent.bg` | `#0f172a` | Terminal rail and high-contrast headers |
| `agent.border` | `#cbd5e1` | Card and section borders |
| `agent.ink` | `#172033` | Primary text |
| `agent.muted` | `#64748b` | Secondary text |
| `agent.assessment` | `#2563eb` | Assessment lifecycle |
| `agent.reasoning` | `#7c3aed` | Reasoning and scoring |
| `agent.learnbot` | `#0f766e` | Learning sessions |
| `agent.fallback` | `#e11d48` | Remediation and blocking state |
| `agent.success` | `#059669` | Completion and readiness |
| `agent.warning` | `#d97706` | Timers and risk states |

## Layout Rules

- Use full-width bands and constrained inner content for primary page sections.
- Use cards only for repeated modules, console panels, and framed tool surfaces.
- Keep card radius at 8px or less.
- Use icon buttons or icon-plus-text buttons for direct commands.
- Keep typography stable across viewport sizes. Do not scale font size using viewport width.
- Preserve stable dimensions for the pipeline cards, radar panel, event log, and roadmap nodes so live state changes do not shift the layout.
- Fallback mode must be visible through border color, banner text, disabled final actions, and roadmap remediation states.

## Module Mapping

- Entry and profile gathering: compact profile card and session initialization controls.
- Assessment phase: `AssessmentWorkspace` handles descriptive answer, MCQ answer, timer metadata, and proctoring listeners.
- Analysis and gap detection: `ReasoningDashboard` renders claimed vs measured skill deltas.
- Learning path generation: `LearnBotWorkspace` renders 10-minute roadmap nodes and notebook output.
- Mock and interview review: `FinalReview` captures mock/interview score submissions.
- Fallback loop: global `isFallbackActive` state changes layout borders, remediation banners, node states, and final certification availability.
