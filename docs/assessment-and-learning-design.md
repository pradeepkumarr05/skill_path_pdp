# Assessment and Learning Design

## Implemented Full Stack Workflow

1. Email/password accounts verify email before setup. Google sign-in verifies the Google credential on the backend. Sessions are stored and revocable; password reset revokes existing sessions.
2. Setup saves education, target roles and claimed skills against the authenticated account. Uploaded PDFs are parsed server-side. Documents and gender are optional.
3. The technical interview evaluates each normalized claimed skill separately. No claimed skills means this stage is skipped, not failed.
4. The knowledge assessment presents 22 questions, two per supported skill, one question at a time. Answer keys stay on the server until submission. Submitted results are immutable on retry.
5. The dashboard shows both assessment modalities and per-skill evidence. Hugging Face receives only the domain and anonymous skill evidence to generate study content.
6. A validated plan is stored before it is displayed. Ten-minute sessions require live heartbeats and a correct checkpoint. Exiting abandons the current attempt, not previous completed sessions. Completed content can be reviewed again without earning duplicate credit.

## Interview Algorithm

Each claimed skill starts with one medium question. A score of at least 65 unlocks one hard question; otherwise that skill ends with its medium score. After a hard question, the skill score is rounded from 45% medium plus 55% hard. Thus a skill receives one or two questions, with a maximum of twice the number of normalized claimed skills. The hard pass threshold is 70. The server derives progression and level from numeric scores; model-provided pass/next-action labels cannot bypass these thresholds.

Gemini generates questions and grades typed answers. The per-answer window is 45 seconds. Timing and critical proctor access-loss rules are server checked where observable. The overall interview average is a summary only; roadmap decisions use the individual skill scores.

This is adaptive difficulty routing, not a psychometrically calibrated item-response model. Model grading can vary. A small question sample cannot establish professional competence; do not present these scores as hiring certification.

## Per-Skill Evidence

- Knowledge score = correct answers for that skill / questions for that skill, as a percentage.
- With both modalities: combined score = rounded 60% knowledge + 40% interview.
- With only one modality: show the available score and explicitly mark the other as not assessed.
- Optional review requires knowledge >= 80 and, if interview evidence exists, interview >= 80. A high blended score cannot hide a weak modality.
- With two MCQs per skill, available knowledge scores are coarse: 0, 50 or 100. This limitation is deliberate and should be mentioned during review.

## Roadmap Validation and Privacy

`learningService.mjs` reads saved scores, never browser-supplied scores. Each provider request contains at most two required skills, with at most two concurrent calls, to limit response size and latency. The prompt requests two lessons per skill; validation supports 2-4. A response must cover every requested skill once, with teaching content, a practical exercise, four distinct checkpoint choices, a valid answer index, and an explanation. All batches must validate before any plan is stored.

The model controls instructional content and topic ordering within batches. The server controls skip eligibility, lesson duration, ownership and completion. Output validation verifies structure, not factual correctness. Human curriculum review is still necessary.

No names, email addresses, typed assessment answers, documents or camera frames are sent to Hugging Face. Gemini assessment prompts use technical context and typed answers, with name/email fields removed. Browser camera frame analysis remains local.

## Session Guarantees and Limits

The server requires 600 elapsed seconds and a heartbeat no older than 25 seconds. The client sends heartbeats every eight seconds. Browser tab/window departure, required media loss and fullscreen exit discard the attempt. The checkpoint answer is checked on the backend and completion persists in PostgreSQL. Repeated completion does not grant extra credit.

Browser proctoring is a deterrent, not tamper-proof monitoring. A modified client can fabricate heartbeats; camera motion does not establish cheating. Real-device and accessibility testing remain necessary. Estimated lesson duration is a fixed study allocation, not a learned prediction of individual reading speed.

## Evidence

See `prototype-refresh-verification.md` and `../screenshots/prototype-refresh/`. Live provider checks, database fixtures, simulated devices, and real elapsed-time tests are identified separately. Never describe fixture roadmap screenshots as live model output.
