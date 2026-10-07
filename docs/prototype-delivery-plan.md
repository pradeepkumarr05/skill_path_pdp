# Single-Domain Prototype Delivery

## Scope and Current Status

Upgrade `/home/anj/skill_path_pdp` in place. User requests Figma-based UI and a new logo, with a complete working domain delivered incrementally. Superdesign is rejected and must not be used. User confirmed Full Stack Engineering as the first end-to-end domain. Limit new active assessment/setup choices to the supported path while preserving existing profiles and records in other domains.

Figma connection is now verified. Public reference pages were inaccessible, and the provided Community listing URLs are not the design-file URLs required by extraction tools. Request accessible opened/duplicated `/design/...` links with the desired frame selected (`node-id`). Exact components, colors, fonts and assets are not yet available. Then inspect frame hierarchy, typography, fills, spacing, components and exportable assets. Respect each file's asset/font license; do not scrape paid source or evade access restrictions.

## Sequence and Completion Gates

1. **UI foundation, new logo and authentication.** Derive tokens from accessible Figma source, adapt its style to operational screens, create an original SkillPath mark, then implement actual React auth screens. Preserve verification/reset/logout behavior. Check keyboard access, focus, loading/error states and desktop/mobile screenshots. User reviews the running app, not another isolated marketing mockup.
2. **Setup.** Clear required/optional fields, supported domain shown honestly, useful skill/role choices, real document upload states, saved profile editing. Existing profiles remain intact. Verify new user routing and reload persistence.
3. **Application navigation and dashboard.** Stable navigation to assessments, results, learning plan, progress and profile; working logout. Dashboard derives data from saved records and exposes the correct next action. Empty states must be honest, with no invented progress. Review and test returning-user routes.
4. **Assessment preparation and execution.** Compact consent/device checks, professional names, visible camera/proctor state. Conversational assessment retains per-skill evidence. MCQ assessment presents one question at a time. Confirm timing/navigation/proctor rules before implementing. Test ownership, interruption, repeat submission and saved results.
5. **Results and roadmap.** Server-persisted per-skill results and a versioned personalized plan with evidence, estimated duration and mastered/skippable topics. Missing evidence is not a zero or a mastered skill. Hugging Face model/runtime and failure behavior require an explicit decision and real evaluation; no fake model integration.
6. **Learning sessions and progress.** Server-owned session lifecycle, ten-minute topic units, agreed checkpoint success criteria, explicit abandon/timeout/proctor behavior. Interrupted session progress is discarded; previous completions remain. Persist notebook/progress and resume the next unfinished session. Confirm voice/transcription and detector tolerances at this increment.
7. **Full-domain review run.** New account -> verification -> setup -> both assessments -> skill results -> roadmap -> lesson -> logout/reload -> resume. Capture real screenshots and test output with limitations clearly identified.

Each increment requires implementation, focused tests, updated durable context, screenshots and user review before advancing. Do not present future modules as completed features.

## Source-Confirmed Gaps

- `server/domainConfig.mjs` declares only Full Stack Engineering as the supported domain, with 11 skills. Setup currently offers six domains, creating a misleading selection surface.
- `src/pages/LearningRoadmapPage.tsx` stores completed subtopics and notebooks in component state. No learning/roadmap persistence routes or tables were found in `server/index.mjs` or `server/migrate.mjs`.
- Its `answerLooksRight` is a word-count/keyword heuristic, not validated semantic assessment. `submitLessonAnswer` marks completion after the second response regardless of passing that check. Replace this behavior when defining the learning module's actual success criteria.
- `src/data/roadmap.ts` computes a per-skill blend of MCQ (60%) and chat (40%) where available, selects scores below80, limits to five topics, and still selects topics when all scores meet80. This is a heuristic plan, not Hugging Face personalization or a demonstrated mastery/skip policy.
- Authentication backend and its earlier tests exist; successful real-provider Google/Gmail verification must not be inferred from integration tests.
- Legacy browser workflow has old auth selectors/verification assumptions and pre-existing user edits. Preserve those edits while updating the workflow in the relevant increment.

## Current Checkpoint

Full Stack Engineering confirmed. Figma connected and verified. TOP 50 design file `iGpb3AFcqZTU797uLCY8O5` is readable, but user selected Modern Product Launch Sites file `wALfMDQNopOxterXseDinL` as the primary reference. Its read-only inspection returned no edit access. Need access for the connected account or an accessible Design copy; Sites extraction support is not yet verified. Attio design context was inspected only as an unselected candidate. No visual source recreation, new logo, or new runtime module was implemented during this checkpoint. Existing user data and working-tree changes were preserved.
