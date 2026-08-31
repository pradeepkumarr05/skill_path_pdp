# Project Architecture

## Current Build Scope

The active app is being built one section at a time. The current implemented modules are:

- Page 1: Login / Sign Up
- Page 2: Profile Setup / Basic Details
- Page 3: Assessment Guidelines
- Page 4: Live Chatbot Assessment
- Page 5: Full Stack Skill Assessment
- Page 6: Gap Detection
- Page 7: Learning Roadmap

## Current Runtime

- Vite serves the React application.
- React local state handles page flow and client interaction state.
- Authentication is local for the current build.
- Provider login buttons simulate identity handoff.
- A Node HTTP API owns agent sessions, proctor events, answer deadlines, Gemini prompt orchestration for the chatbot, deterministic assessment keys, and skill assessment grading.
- Gemini API calls run server-side only. The browser never receives the API key.
- No database is active yet; sessions and generated answer keys are stored in memory for the prototype.
- Gap detection and learning roadmap generation are UI-only for now and do not call an LLM.

## Agentic Assessment Flow

1. Candidate profile details are submitted to the backend assessment agent.
2. If `claimedSkills` is empty, the chatbot assessment is skipped and the user moves directly to the Full Stack skill assessment.
3. If claimed skills exist, the guidelines page requests camera, microphone, screen share, and full-screen access before entering the chatbot room.
4. Gemini generates a medium question for the current claimed skill.
5. The candidate has 45 seconds per typed answer.
6. Gemini evaluates the answer using the question, transcript, profile, selected role, skill, and difficulty.
7. Weak or incorrect medium answers are scored and the agent moves on to the next claimed skill without remediation.
8. Satisfactory medium answers progress to one hard question for that skill.
9. After all claimed skills are completed, the user moves to the separate deterministic Full Stack skill assessment.
10. Tab hiding, focus loss, clipboard/context-menu attempts, full-screen exit, media-track ending, and answer timeout are logged as proctor warnings. Three warnings terminate the chatbot assessment.

## Full Stack Skill Assessment

- The current prototype supports one assessment domain: Full Stack Engineering.
- The assessment is deterministic and separate from the claimed-skill chatbot stage.
- The fixed bank has two industry-style MCQ items per skill, uniformly distributed across HTML, CSS, JavaScript, TypeScript, React, Node.js, REST APIs, Data Structures and Algorithms, PostgreSQL, MongoDB, and Git.
- The server stores the answer key in memory and sends only public question data to the browser.
- The assessment is timed and proctored with the same warning threshold as the chatbot stage.

## Gap Detection and Learning Roadmap

- The roadmap UI consumes both outputs:
  - claimed-skill chatbot score per skill when available
  - deterministic OA correctness per skill
- Weakest skills are ranked by combined score. OA-only skills are still included in the ranking.
- The roadmap is structured as `n` topics and `m` subtopics.
- Each subtopic is a 10-minute proctored session.
- The current learning session UI simulates a real-time LearnBot flow without LLM calls:
  - teach the concept
  - ask an immediate typed checkpoint
  - correct weak answers and proceed
  - ask a second application checkpoint
  - save completed sessions as notebooks with lesson notes
- Exiting or timing out during an active learning session resets progress for that subtopic.
- Completed subtopics drive roadmap progress.
- The grading endpoint returns score, level, per-skill correctness, and explanations after submission.

## Planned Module Order

1. Login / Sign Up
2. Profile Setup / Basic Details
3. Assessment Guidelines
4. Live Chatbot Assessment
5. MCQ / Skill Assessment
6. Gap Detection and Skill Scoring
7. Learning Roadmap
8. LearnBot Sessions
9. Mock and Interview
10. Performance Review
11. Final Review and Certification
12. Fallback Remediation Loop

Each module should be implemented, reviewed, and approved before moving to the next.
