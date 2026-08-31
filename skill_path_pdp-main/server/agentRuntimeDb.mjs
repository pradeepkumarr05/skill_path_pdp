/**
 * server/agentRuntimeDb.mjs
 * PostgreSQL-backed implementation of all assessment runtime functions.
 *
 * Replaces the in-memory Maps in agentRuntime.mjs with full DB persistence.
 * Sessions survive server restarts. All writes are atomic via transactions.
 *
 * Exports (same interface as agentRuntime.mjs):
 *   startAgenticSession(profileInput, candidateId)
 *   submitAgenticAnswer(sessionId, payload, candidateId)
 *   recordProctorEvent(sessionId, payload, candidateId)
 *   getAgenticSession(sessionId)
 *   createSkillAssessment(profileInput, candidateId)
 *   submitSkillAssessment(assessmentId, answersInput, timedOut, candidateId)
 *   recordSkillAssessmentProctorEvent(assessmentId, payload, candidateId)
 *   getOrCreateCandidate(profileInput)
 */
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from './db.mjs';
import { SUPPORTED_DOMAIN, normalizeClaimedSkills } from './domainConfig.mjs';
import {
  SKILL_ASSESSMENT_SECONDS_PER_ITEM,
  buildDeterministicSkillAssessment,
  publicSkillAssessmentItems,
} from './deterministicSkillAssessment.mjs';
import { generateGeminiJson, geminiModel, isGeminiConfigured } from './geminiClient.mjs';

// ── Constants ─────────────────────────────────────────────────────────────
const ANSWER_SECONDS = 45;
const PROCTOR_WARNING_LIMIT = 3;
const MEDIUM_PASS_SCORE = 65;
const HARD_PASS_SCORE = 70;

// ── Schemas for Gemini structured output ──────────────────────────────────
const questionSchema = {
  type: 'OBJECT',
  properties: {
    question: { type: 'STRING' },
    intent: { type: 'STRING' },
  },
  required: ['question', 'intent'],
};

const evaluationSchema = {
  type: 'OBJECT',
  properties: {
    score: { type: 'NUMBER' },
    level: { type: 'STRING', enum: ['novice', 'developing', 'job_ready', 'strong'] },
    pass: { type: 'BOOLEAN' },
    feedback: { type: 'STRING' },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    gaps: { type: 'ARRAY', items: { type: 'STRING' } },
    nextAction: { type: 'STRING', enum: ['ask_hard', 'complete_skill'] },
  },
  required: ['score', 'level', 'pass', 'feedback', 'strengths', 'gaps', 'nextAction'],
};

// ── Utility ───────────────────────────────────────────────────────────────
function nowIso() {
  return new Date().toISOString();
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function levelFromScore(score) {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'job_ready';
  if (score >= 45) return 'developing';
  return 'novice';
}

function sanitizeProfile(input) {
  return {
    name: String(input?.name || 'Candidate').trim() || 'Candidate',
    email: String(input?.email || '').trim(),
    qualification: String(input?.qualification || '').trim(),
    selectedDomain: String(input?.domain || input?.selectedDomain || SUPPORTED_DOMAIN).trim() || SUPPORTED_DOMAIN,
    assessmentDomain: SUPPORTED_DOMAIN,
    interestedRoles: Array.isArray(input?.interestedRoles) ? input.interestedRoles.map(String).filter(Boolean) : [],
    claimedSkills: normalizeClaimedSkills(input),
  };
}

function proctorLabel(type) {
  const labels = {
    tab_hidden: 'Tab switching detected',
    window_blur: 'Assessment window lost focus',
    copy: 'Copy attempt blocked',
    paste: 'Paste attempt blocked',
    cut: 'Cut attempt blocked',
    contextmenu: 'Context menu attempt blocked',
    fullscreen_exit: 'Fullscreen exit detected',
    answer_timeout: 'Answer timer expired',
    camera_track_ended: 'Camera access ended',
    microphone_track_ended: 'Microphone access ended',
    screen_track_ended: 'Screen share ended',
  };
  return labels[type] || 'Proctoring event detected';
}

// ── Candidate Management ──────────────────────────────────────────────────

/**
 * Upsert a candidate record by email. Returns candidate row.
 */
export async function getOrCreateCandidate(profileInput) {
  const profile = sanitizeProfile(profileInput);

  if (!profile.email) {
    const err = new Error('Candidate email is required.');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(
    `INSERT INTO candidates (name, email, qualification, selected_domain, assessment_domain, interested_roles, claimed_skills)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO UPDATE SET
       name              = EXCLUDED.name,
       qualification     = EXCLUDED.qualification,
       selected_domain   = EXCLUDED.selected_domain,
       interested_roles  = EXCLUDED.interested_roles,
       claimed_skills    = EXCLUDED.claimed_skills,
       updated_at        = NOW()
     RETURNING *`,
    [
      profile.name,
      profile.email,
      profile.qualification,
      profile.selectedDomain,
      profile.assessmentDomain,
      profile.interestedRoles,
      profile.claimedSkills,
    ],
  );

  return rows[0];
}

/**
 * Upsert candidate (simpler version that handles DB column names correctly).
 */
export async function upsertCandidate(profileInput) {
  const profile = sanitizeProfile(profileInput);

  if (!profile.email) {
    const err = new Error('Candidate email is required.');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await query(
    `INSERT INTO candidates (name, email, qualification, selected_domain, assessment_domain, interested_roles, claimed_skills)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO UPDATE SET
       name              = EXCLUDED.name,
       qualification     = EXCLUDED.qualification,
       selected_domain   = EXCLUDED.selected_domain,
       interested_roles  = EXCLUDED.interested_roles,
       claimed_skills    = EXCLUDED.claimed_skills,
       updated_at        = NOW()
     RETURNING *`,
    [
      profile.name,
      profile.email,
      profile.qualification,
      profile.selectedDomain,
      profile.assessmentDomain,
      profile.interestedRoles,
      profile.claimedSkills,
    ],
  );

  return rows[0];
}

// ── Session Reconstruction from DB ───────────────────────────────────────

/**
 * Load a full session from DB and return the public-facing shape.
 */
async function loadPublicSession(sessionId) {
  // Load session + candidate
  const { rows: sessionRows } = await query(
    `SELECT s.*, c.name AS candidate_name, c.email AS candidate_email,
            c.qualification, c.selected_domain, c.claimed_skills, c.interested_roles
     FROM chat_sessions s
     JOIN candidates c ON c.id = s.candidate_id
     WHERE s.id = $1`,
    [sessionId],
  );

  if (!sessionRows.length) return null;
  const session = sessionRows[0];

  // Load transcript
  const { rows: transcriptRows } = await query(
    `SELECT id, role, text, meta, created_at FROM chat_transcript
     WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId],
  );

  // Load skill states
  const { rows: skillStateRows } = await query(
    `SELECT id, skill, status, medium_attempts, hard_attempts, final_score, final_level, skill_index
     FROM chat_skill_states WHERE session_id = $1 ORDER BY skill_index ASC`,
    [sessionId],
  );

  // Load current question
  let currentQuestion = null;
  if (session.current_question_id) {
    const { rows: qRows } = await query(
      `SELECT id, skill, difficulty, text, intent, sequence, started_at, due_at
       FROM chat_questions WHERE id = $1`,
      [session.current_question_id],
    );
    if (qRows.length) {
      const q = qRows[0];
      currentQuestion = {
        id: q.id,
        skill: q.skill,
        difficulty: q.difficulty,
        text: q.text,
        intent: q.intent,
        sequence: q.sequence,
        startedAt: q.started_at,
        dueAt: q.due_at,
        secondsAllowed: ANSWER_SECONDS,
      };
    }
  }

  return {
    sessionId: session.id,
    status: session.status,
    reason: session.reason,
    candidateName: session.candidate_name,
    selectedDomain: session.selected_domain,
    assessmentDomain: SUPPORTED_DOMAIN,
    claimedSkills: session.claimed_skills || [],
    currentQuestion,
    transcript: transcriptRows.map((t) => ({
      id: t.id,
      role: t.role,
      text: t.text,
      meta: t.meta || {},
      createdAt: t.created_at,
    })),
    skillStates: skillStateRows.map((s) => ({
      skill: s.skill,
      status: s.status,
      mediumAttempts: s.medium_attempts,
      hardAttempts: s.hard_attempts,
      finalScore: s.final_score !== null ? Number(s.final_score) : null,
      finalLevel: s.final_level,
    })),
    warningCount: session.warning_count,
    warningLimit: PROCTOR_WARNING_LIMIT,
    answerSeconds: ANSWER_SECONDS,
    aggregate: session.aggregate,
    model: session.model || geminiModel(),
    geminiConfigured: session.gemini_configured || isGeminiConfigured(),
    completedAt: session.completed_at,
    terminatedAt: session.terminated_at,
  };
}

// ── Gemini Prompt Builders ─────────────────────────────────────────────────

function buildQuestionPrompt(session, skillState, difficulty, recentTranscript) {
  const claimedSkills = (session.claimed_skills || []).join(', ');
  const roles = (session.interested_roles || []).join(', ') || 'not specified';

  return `
Candidate profile:
${JSON.stringify({
  name: session.candidate_name,
  email: session.candidate_email,
  qualification: session.qualification,
  selectedDomain: session.selected_domain,
  assessmentDomain: SUPPORTED_DOMAIN,
  claimedSkills: session.claimed_skills || [],
  interestedRoles: session.interested_roles || [],
}, null, 2)}

Assessment policy:
- Product: SkillPath agentic chatbot assessment.
- Supported prototype domain: ${SUPPORTED_DOMAIN}.
- Claimed skills to assess in this chatbot pass: ${claimedSkills}.
- Current target skill: ${skillState.skill}.
- Current difficulty: ${difficulty}.
- Candidate target roles: ${roles}.
- The user must answer each question in ${ANSWER_SECONDS} seconds.
- Start medium. If the user passes medium, progress to hard. If the medium answer is weak or incorrect, move on to the next skill without a repair follow-up.
- Ask exactly one question. Do not include an answer key, rubric, or multiple questions.
- The question must be answerable by typing a concise technical answer in 30 to 45 seconds.
- Make the question specific to ${skillState.skill}, practical, and suitable for a job-readiness assessment.
- Do not reuse previous questions.

Recent transcript:
${recentTranscript || 'No previous transcript.'}

Return JSON with:
- question: the next question exactly as the chatbot should ask it.
- intent: one sentence explaining what competency this question checks, for internal UI audit only.
`.trim();
}

function buildEvaluationPrompt(session, question, skillState, answer, timedOut) {
  return `
Candidate profile:
${JSON.stringify({
  name: session.candidate_name,
  selectedDomain: session.selected_domain,
}, null, 2)}

Current assessment state:
${JSON.stringify({
  skill: question.skill,
  difficulty: question.difficulty,
  mediumPassScore: MEDIUM_PASS_SCORE,
  hardPassScore: HARD_PASS_SCORE,
  mediumAttemptsUsed: skillState.medium_attempts || 0,
  progression: 'Pass medium to get one hard question. Fail medium and the runtime moves on to the next skill.',
}, null, 2)}

Question asked:
${question.text}

Candidate answer:
${answer || '[No answer submitted]'}

Timing:
- Allowed seconds: ${ANSWER_SECONDS}
- Timed out: ${timedOut ? 'yes' : 'no'}

Evaluate the answer as the assessment agent.
Rules:
- Be strict. Reward concrete implementation reasoning, tradeoffs, correct terminology, and production judgment.
- Penalize vague answers, memorized definitions without application, and missing key constraints.
- If timed out, empty, weak, or incorrect, score accordingly and move on without a remediation question.
- For medium questions, pass normally requires score >= ${MEDIUM_PASS_SCORE}.
- For hard questions, pass normally requires score >= ${HARD_PASS_SCORE}.
- nextAction must be:
  - ask_hard when the current medium answer is satisfactory.
  - complete_skill when the current medium answer is not satisfactory, or when hard has been answered.
- feedback must be candidate-facing, concise, and must not reveal a hidden answer key.
`.trim();
}

// ── Chatbot Assessment — startAgenticSession ──────────────────────────────

export async function startAgenticSession(profileInput, candidateId) {
  const profile = sanitizeProfile(profileInput);

  // If no candidateId provided, upsert by email
  let resolvedCandidateId = candidateId;
  if (!resolvedCandidateId) {
    const candidate = await upsertCandidate(profileInput);
    resolvedCandidateId = candidate.id;
  }

  if (!profile.claimedSkills.length) {
    // Create a skipped session record for traceability
    const { rows } = await query(
      `INSERT INTO chat_sessions
         (candidate_id, status, reason, model, gemini_configured)
       VALUES ($1, 'skipped', $2, $3, $4)
       RETURNING *`,
      [
        resolvedCandidateId,
        'No claimed skills were submitted, so chatbot assessment is skipped.',
        geminiModel(),
        isGeminiConfigured(),
      ],
    );

    return {
      skipped: true,
      sessionId: rows[0].id,
      status: 'skipped',
      reason: 'No claimed skills were submitted, so chatbot assessment is skipped.',
      candidateName: profile.name,
      selectedDomain: profile.selectedDomain,
      assessmentDomain: SUPPORTED_DOMAIN,
      claimedSkills: [],
      currentQuestion: null,
      transcript: [],
      skillStates: [],
      warningCount: 0,
      warningLimit: PROCTOR_WARNING_LIMIT,
      answerSeconds: ANSWER_SECONDS,
      aggregate: null,
      model: geminiModel(),
      geminiConfigured: isGeminiConfigured(),
      completedAt: null,
      terminatedAt: null,
    };
  }

  // ── Phase 1: DB writes (inside transaction) ──
  const sessionSetup = await withTransaction(async (client) => {
    // Create session
    const { rows: sessionRows } = await client.query(
      `INSERT INTO chat_sessions
         (candidate_id, status, model, gemini_configured, warning_limit, answer_seconds)
       VALUES ($1, 'active', $2, $3, $4, $5)
       RETURNING *`,
      [resolvedCandidateId, geminiModel(), isGeminiConfigured(), PROCTOR_WARNING_LIMIT, ANSWER_SECONDS],
    );
    const sessionId = sessionRows[0].id;

    // Create skill states
    for (let i = 0; i < profile.claimedSkills.length; i++) {
      await client.query(
        `INSERT INTO chat_skill_states (session_id, skill, status, skill_index) VALUES ($1, $2, 'pending', $3)`,
        [sessionId, profile.claimedSkills[i], i],
      );
    }

    // System transcript: session started
    await client.query(
      `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'system', $2, $3)`,
      [
        sessionId,
        `Gemini-backed SkillPath chatbot started for ${profile.claimedSkills.join(', ')}.`,
        JSON.stringify({ type: 'session_started', model: geminiModel() }),
      ],
    );

    // Set first skill to medium
    await client.query(
      `UPDATE chat_skill_states SET status = 'medium' WHERE session_id = $1 AND skill_index = 0`,
      [sessionId],
    );

    // Load the first skill state
    const { rows: firstSkillRows } = await client.query(
      `SELECT * FROM chat_skill_states WHERE session_id = $1 AND skill_index = 0`,
      [sessionId],
    );

    // Load candidate data for prompts
    const { rows: candidateRows } = await client.query(
      `SELECT * FROM candidates WHERE id = $1`,
      [resolvedCandidateId],
    );
    const candidateData = candidateRows[0];

    return {
      sessionId,
      firstSkill: firstSkillRows[0],
      sessionData: {
        ...sessionRows[0],
        candidate_name: candidateData.name,
        candidate_email: candidateData.email,
        qualification: candidateData.qualification,
        selected_domain: candidateData.selected_domain,
        claimed_skills: candidateData.claimed_skills,
        interested_roles: candidateData.interested_roles,
      },
    };
  });

  // ── Phase 2: Gemini call (outside transaction) ──
  const { sessionId, firstSkill, sessionData } = sessionSetup;
  const questionData = await generateQuestion(sessionData, firstSkill, 'medium', '');

  // ── Phase 3: Persist question result (outside transaction — non-critical atomicity) ──
  const { rows: qRows } = await query(
    `INSERT INTO chat_questions (session_id, skill, difficulty, text, intent, sequence, started_at, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [sessionId, firstSkill.skill, 'medium', questionData.text, questionData.intent, 1, questionData.startedAt, questionData.dueAt],
  );
  const questionId = qRows[0].id;

  await query(
    `UPDATE chat_sessions SET current_question_id = $1, question_sequence = 1 WHERE id = $2`,
    [questionId, sessionId],
  );

  await query(
    `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'agent', $2, $3)`,
    [
      sessionId,
      questionData.text,
      JSON.stringify({ type: 'question', skill: firstSkill.skill, difficulty: 'medium', questionId, intent: questionData.intent }),
    ],
  );

  return loadPublicSession(sessionId);
}

// ── Generate a question via Gemini ─────────────────────────────────────────

async function generateQuestion(sessionData, skillState, difficulty, recentTranscript) {
  const response = await generateGeminiJson({
    systemInstruction:
      'You are the SkillPath assessment chatbot. Your job is to generate the next candidate-facing question in an adaptive technical interview. You must be precise, practical, and concise. Return only valid JSON.',
    prompt: buildQuestionPrompt(sessionData, skillState, difficulty, recentTranscript),
    schema: questionSchema,
    temperature: difficulty === 'hard' ? 0.45 : 0.35,
    maxOutputTokens: 700,
  });

  const startedAt = Date.now();
  return {
    text: String(response.question || '').trim(),
    intent: String(response.intent || '').trim(),
    startedAt: new Date(startedAt).toISOString(),
    dueAt: new Date(startedAt + ANSWER_SECONDS * 1000).toISOString(),
  };
}

// ── Chatbot Assessment — submitAgenticAnswer ──────────────────────────────

export async function submitAgenticAnswer(sessionId, payload, candidateId) {
  // Load the session
  const { rows: sessionRows } = await query(
    `SELECT s.*, c.name AS candidate_name, c.email AS candidate_email,
            c.qualification, c.selected_domain, c.claimed_skills, c.interested_roles
     FROM chat_sessions s
     JOIN candidates c ON c.id = s.candidate_id
     WHERE s.id = $1`,
    [sessionId],
  );

  if (!sessionRows.length) {
    const err = new Error('Assessment session was not found.');
    err.statusCode = 404;
    throw err;
  }

  const session = sessionRows[0];

  // Authorization check
  if (candidateId && session.candidate_id !== candidateId) {
    const err = new Error('Not authorized to submit answers for this session.');
    err.statusCode = 403;
    throw err;
  }

  if (session.status !== 'active') {
    return loadPublicSession(sessionId);
  }

  // Validate the question
  const questionId = payload?.questionId;
  if (!questionId || session.current_question_id !== questionId) {
    const err = new Error('Question is no longer active.');
    err.statusCode = 409;
    throw err;
  }

  // Load the question
  const { rows: qRows } = await query(`SELECT * FROM chat_questions WHERE id = $1`, [questionId]);
  if (!qRows.length) {
    const err = new Error('Question not found.');
    err.statusCode = 404;
    throw err;
  }
  const question = qRows[0];

  const timedOut = Boolean(payload?.timedOut) || Date.now() > new Date(question.due_at).getTime();
  const answer = timedOut ? '' : String(payload?.answer || '').trim();

  // Record timeout warning
  if (timedOut) {
    await insertProctorEvent(sessionId, null, 'chat', 'answer_timeout', 'Candidate did not submit within the per-answer timer.');
    await incrementWarning(sessionId);
  }

  // Add candidate answer to transcript
  await query(
    `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'candidate', $2, $3)`,
    [
      sessionId,
      answer || '[No answer submitted]',
      JSON.stringify({
        type: 'answer',
        questionId,
        timedOut,
        skill: question.skill,
        difficulty: question.difficulty,
      }),
    ],
  );

  // Check if session was terminated by warning
  const { rows: updatedSession } = await query(`SELECT status FROM chat_sessions WHERE id = $1`, [sessionId]);
  if (updatedSession[0].status !== 'active') {
    return loadPublicSession(sessionId);
  }

  // Evaluate via Gemini
  const skillStateRows = await query(
    `SELECT * FROM chat_skill_states WHERE session_id = $1 AND skill_index = (
       SELECT current_skill_index FROM chat_sessions WHERE id = $1
     )`,
    [sessionId],
  );
  const skillState = skillStateRows.rows[0];

  const evaluation = await evaluateWithGemini(session, question, skillState, answer, timedOut);

  // Add evaluation feedback to transcript
  await query(
    `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'agent', $2, $3)`,
    [
      sessionId,
      evaluation.feedback,
      JSON.stringify({
        type: 'evaluation',
        questionId,
        skill: question.skill,
        difficulty: question.difficulty,
        score: evaluation.score,
        level: evaluation.level,
        strengths: evaluation.strengths,
        gaps: evaluation.gaps,
      }),
    ],
  );

  // Record the attempt
  await query(
    `INSERT INTO chat_skill_attempts (skill_state_id, session_id, question_id, difficulty, score, level, feedback, strengths, gaps)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      skillState.id,
      sessionId,
      questionId,
      question.difficulty,
      evaluation.score,
      evaluation.level,
      evaluation.feedback,
      evaluation.strengths,
      evaluation.gaps,
    ],
  );

  // Advance the session state machine
  await advanceSessionStateMachine(session, question, skillState, evaluation);

  return loadPublicSession(sessionId);
}

// ── Evaluate answer via Gemini ─────────────────────────────────────────────

async function evaluateWithGemini(session, question, skillState, answer, timedOut) {
  const response = await generateGeminiJson({
    systemInstruction:
      'You are the SkillPath assessment evaluator. You evaluate typed technical answers for job readiness. Return only strict JSON matching the requested schema.',
    prompt: buildEvaluationPrompt(session, question, skillState, answer, timedOut),
    schema: evaluationSchema,
    temperature: 0.2,
    maxOutputTokens: 900,
  });

  const score = clampScore(response.score);
  return {
    score,
    level: ['novice', 'developing', 'job_ready', 'strong'].includes(response.level) ? response.level : levelFromScore(score),
    pass: Boolean(response.pass) || score >= (question.difficulty === 'hard' ? HARD_PASS_SCORE : MEDIUM_PASS_SCORE),
    feedback: String(response.feedback || '').trim(),
    strengths: Array.isArray(response.strengths) ? response.strengths.map(String).slice(0, 4) : [],
    gaps: Array.isArray(response.gaps) ? response.gaps.map(String).slice(0, 4) : [],
    nextAction: ['ask_hard', 'complete_skill'].includes(response.nextAction) ? response.nextAction : 'complete_skill',
  };
}

// ── Session state machine ──────────────────────────────────────────────────

async function advanceSessionStateMachine(session, question, skillState, evaluation) {
  const sessionId = session.id;

  if (question.difficulty === 'medium') {
    // Update medium attempt count
    await query(
      `UPDATE chat_skill_states SET medium_attempts = medium_attempts + 1 WHERE id = $1`,
      [skillState.id],
    );

    if (evaluation.pass || evaluation.nextAction === 'ask_hard') {
      // Upgrade to hard
      await query(`UPDATE chat_skill_states SET status = 'hard' WHERE id = $1`, [skillState.id]);
      await askNextQuestion(sessionId, session, skillState, 'hard');
    } else {
      // Complete the skill at medium only
      await query(
        `UPDATE chat_skill_states SET status = 'completed_medium_only', final_score = $1, final_level = $2 WHERE id = $3`,
        [evaluation.score, evaluation.level, skillState.id],
      );
      await moveToNextSkill(sessionId, session);
    }
  } else {
    // Hard question completed
    await query(
      `UPDATE chat_skill_states SET hard_attempts = hard_attempts + 1 WHERE id = $1`,
      [skillState.id],
    );

    // Calculate final score: 45% medium best + 55% hard
    const { rows: attemptsRows } = await query(
      `SELECT difficulty, score FROM chat_skill_attempts WHERE skill_state_id = $1`,
      [skillState.id],
    );
    const mediumScores = attemptsRows.filter((a) => a.difficulty === 'medium').map((a) => Number(a.score));
    const bestMedium = mediumScores.length ? Math.max(...mediumScores) : 0;
    const finalScore = clampScore(bestMedium * 0.45 + evaluation.score * 0.55);
    const finalLevel = levelFromScore(finalScore);

    await query(
      `UPDATE chat_skill_states SET status = 'completed', final_score = $1, final_level = $2 WHERE id = $3`,
      [finalScore, finalLevel, skillState.id],
    );

    await moveToNextSkill(sessionId, session);
  }
}

async function askNextQuestion(sessionId, session, skillState, difficulty) {
  // Get recent transcript for context
  const { rows: transcriptRows } = await query(
    `SELECT role, text, meta FROM chat_transcript WHERE session_id = $1 ORDER BY created_at DESC LIMIT 12`,
    [sessionId],
  );
  const recentTranscript = transcriptRows
    .reverse()
    .map((t) => {
      const meta = t.meta?.skill ? ` (${t.meta.skill}${t.meta.difficulty ? `, ${t.meta.difficulty}` : ''})` : '';
      return `${t.role}${meta}: ${t.text}`;
    })
    .join('\n');

  // Get updated sequence number
  const { rows: seqRows } = await query(
    `SELECT question_sequence FROM chat_sessions WHERE id = $1`,
    [sessionId],
  );
  const newSequence = (seqRows[0]?.question_sequence || 0) + 1;

  const questionData = await generateQuestion(session, skillState, difficulty, recentTranscript);

  const { rows: qRows } = await query(
    `INSERT INTO chat_questions (session_id, skill, difficulty, text, intent, sequence, started_at, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [sessionId, skillState.skill, difficulty, questionData.text, questionData.intent, newSequence, questionData.startedAt, questionData.dueAt],
  );
  const newQuestionId = qRows[0].id;

  await query(
    `UPDATE chat_sessions SET current_question_id = $1, question_sequence = $2 WHERE id = $3`,
    [newQuestionId, newSequence, sessionId],
  );

  await query(
    `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'agent', $2, $3)`,
    [
      sessionId,
      questionData.text,
      JSON.stringify({
        type: 'question',
        skill: skillState.skill,
        difficulty,
        questionId: newQuestionId,
        intent: questionData.intent,
      }),
    ],
  );
}

async function moveToNextSkill(sessionId, session) {
  // Increment current_skill_index
  const { rows: updatedSession } = await query(
    `UPDATE chat_sessions SET current_skill_index = current_skill_index + 1 WHERE id = $1
     RETURNING current_skill_index`,
    [sessionId],
  );
  const newIndex = updatedSession[0].current_skill_index;

  // Check if there's a next skill
  const { rows: nextSkillRows } = await query(
    `SELECT * FROM chat_skill_states WHERE session_id = $1 AND skill_index = $2`,
    [sessionId, newIndex],
  );

  if (!nextSkillRows.length) {
    // All skills done — complete session
    await completeSession(sessionId);
    return;
  }

  const nextSkill = nextSkillRows[0];
  await query(`UPDATE chat_skill_states SET status = 'medium' WHERE id = $1`, [nextSkill.id]);
  await askNextQuestion(sessionId, session, nextSkill, 'medium');
}

async function completeSession(sessionId) {
  // Calculate aggregate score from completed skills
  const { rows: skillRows } = await query(
    `SELECT final_score FROM chat_skill_states
     WHERE session_id = $1 AND final_score IS NOT NULL`,
    [sessionId],
  );

  const scores = skillRows.map((r) => Number(r.final_score));
  const aggregateScore = scores.length ? clampScore(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0;
  const aggregate = {
    score: aggregateScore,
    level: levelFromScore(aggregateScore),
    skillsAssessed: scores.length,
  };

  await query(
    `UPDATE chat_sessions SET status = 'completed', completed_at = NOW(), current_question_id = NULL, aggregate = $1 WHERE id = $2`,
    [JSON.stringify(aggregate), sessionId],
  );

  const message = `Chatbot assessment complete. Overall chatbot readiness level: ${aggregate.level.replace('_', ' ')}.`;
  await query(
    `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'agent', $2, $3)`,
    [sessionId, message, JSON.stringify({ type: 'complete' })],
  );
}

// ── Proctor Events ─────────────────────────────────────────────────────────

async function insertProctorEvent(sessionId, assessmentId, targetType, type, detail) {
  await query(
    `INSERT INTO proctor_events (session_id, assessment_id, target_type, type, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, assessmentId, targetType, type, detail || ''],
  );
}

async function incrementWarning(sessionId) {
  const { rows } = await query(
    `UPDATE chat_sessions SET warning_count = warning_count + 1 WHERE id = $1
     RETURNING warning_count, warning_limit, status`,
    [sessionId],
  );

  if (!rows.length) return;
  const { warning_count, warning_limit, status } = rows[0];

  // Add proctor transcript entry
  await query(
    `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'system', $2, $3)`,
    [
      sessionId,
      `Proctoring event detected. Warning ${warning_count}/${warning_limit}.`,
      JSON.stringify({ type: 'proctor_warning' }),
    ],
  );

  // Terminate if over limit
  if (warning_count >= warning_limit && status === 'active') {
    await query(
      `UPDATE chat_sessions SET status = 'terminated', terminated_at = NOW(),
       current_question_id = NULL, reason = $1 WHERE id = $2`,
      ['Assessment terminated after repeated proctoring violations.', sessionId],
    );
    await query(
      `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'system', $2, $3)`,
      [
        sessionId,
        'Assessment terminated after repeated proctoring violations.',
        JSON.stringify({ type: 'terminated' }),
      ],
    );
  }
}

export async function recordProctorEvent(sessionId, payload, candidateId) {
  const { rows } = await query(`SELECT status, candidate_id FROM chat_sessions WHERE id = $1`, [sessionId]);

  if (!rows.length) {
    const err = new Error('Assessment session was not found.');
    err.statusCode = 404;
    throw err;
  }

  if (candidateId && rows[0].candidate_id !== candidateId) {
    const err = new Error('Not authorized for this session.');
    err.statusCode = 403;
    throw err;
  }

  if (rows[0].status !== 'active') {
    return loadPublicSession(sessionId);
  }

  const type = String(payload?.type || 'proctor_event');
  const detail = String(payload?.detail || '');
  const label = proctorLabel(type);

  await insertProctorEvent(sessionId, null, 'chat', type, detail);

  // Update warning count and add transcript
  const { rows: updated } = await query(
    `UPDATE chat_sessions SET warning_count = warning_count + 1 WHERE id = $1
     RETURNING warning_count, warning_limit`,
    [sessionId],
  );

  const { warning_count, warning_limit } = updated[0];

  await query(
    `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'system', $2, $3)`,
    [
      sessionId,
      `${label}. Warning ${warning_count}/${warning_limit}.`,
      JSON.stringify({ type: 'proctor_warning', violationType: type }),
    ],
  );

  if (warning_count >= warning_limit) {
    await query(
      `UPDATE chat_sessions SET status = 'terminated', terminated_at = NOW(),
       current_question_id = NULL, reason = $1 WHERE id = $2`,
      ['Assessment terminated after repeated proctoring violations.', sessionId],
    );
    await query(
      `INSERT INTO chat_transcript (session_id, role, text, meta) VALUES ($1, 'system', $2, $3)`,
      [
        sessionId,
        'Assessment terminated after repeated proctoring violations.',
        JSON.stringify({ type: 'terminated' }),
      ],
    );
  }

  return loadPublicSession(sessionId);
}

export async function getAgenticSession(sessionId) {
  return loadPublicSession(sessionId);
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILL ASSESSMENT (Deterministic MCQ)
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeSkillProfile(input) {
  return {
    name: String(input?.name || 'Candidate').trim() || 'Candidate',
    email: String(input?.email || '').trim(),
    selectedDomain: String(input?.domain || input?.selectedDomain || SUPPORTED_DOMAIN).trim() || SUPPORTED_DOMAIN,
    assessmentDomain: SUPPORTED_DOMAIN,
  };
}

async function loadPublicSkillAssessment(assessmentId) {
  const { rows } = await query(
    `SELECT * FROM skill_assessments WHERE id = $1`,
    [assessmentId],
  );
  if (!rows.length) return null;
  const assessment = rows[0];

  return {
    assessmentId: assessment.id,
    domain: assessment.domain,
    selectedDomain: assessment.selected_domain,
    status: assessment.status,
    startedAt: assessment.started_at,
    dueAt: assessment.due_at,
    durationSeconds: assessment.duration_seconds,
    secondsPerItem: SKILL_ASSESSMENT_SECONDS_PER_ITEM,
    warningCount: assessment.warning_count,
    warningLimit: PROCTOR_WARNING_LIMIT,
    items: publicSkillAssessmentItems(buildDeterministicSkillAssessment()),
  };
}

export async function createSkillAssessment(profileInput, candidateId) {
  // Upsert candidate if needed
  let resolvedCandidateId = candidateId;
  if (!resolvedCandidateId) {
    const candidate = await upsertCandidate(profileInput);
    resolvedCandidateId = candidate.id;
  }

  const profile = sanitizeSkillProfile(profileInput);
  const items = buildDeterministicSkillAssessment();
  const durationSeconds = items.length * SKILL_ASSESSMENT_SECONDS_PER_ITEM;
  const startedAt = new Date();
  const dueAt = new Date(startedAt.getTime() + durationSeconds * 1000);

  const { rows } = await query(
    `INSERT INTO skill_assessments (candidate_id, domain, selected_domain, duration_seconds, started_at, due_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      resolvedCandidateId,
      SUPPORTED_DOMAIN,
      profile.selectedDomain,
      durationSeconds,
      startedAt.toISOString(),
      dueAt.toISOString(),
    ],
  );

  return loadPublicSkillAssessment(rows[0].id);
}

export async function recordSkillAssessmentProctorEvent(assessmentId, payload, candidateId) {
  const { rows } = await query(`SELECT * FROM skill_assessments WHERE id = $1`, [assessmentId]);

  if (!rows.length) {
    const err = new Error('Skill assessment was not found.');
    err.statusCode = 404;
    throw err;
  }

  const assessment = rows[0];

  if (candidateId && assessment.candidate_id !== candidateId) {
    const err = new Error('Not authorized for this assessment.');
    err.statusCode = 403;
    throw err;
  }

  if (assessment.status !== 'active') {
    return loadPublicSkillAssessment(assessmentId);
  }

  const type = String(payload?.type || 'proctor_event');
  const detail = String(payload?.detail || '');

  await insertProctorEvent(null, assessmentId, 'skill', type, detail);

  const { rows: updated } = await query(
    `UPDATE skill_assessments SET warning_count = warning_count + 1 WHERE id = $1
     RETURNING warning_count, warning_limit`,
    [assessmentId],
  );

  const { warning_count, warning_limit } = updated[0];

  if (warning_count >= warning_limit) {
    await query(
      `UPDATE skill_assessments SET status = 'terminated', terminated_at = NOW() WHERE id = $1`,
      [assessmentId],
    );
  }

  return loadPublicSkillAssessment(assessmentId);
}

export async function submitSkillAssessment(assessmentId, answersInput, timedOut = false, candidateId) {
  const { rows } = await query(`SELECT * FROM skill_assessments WHERE id = $1`, [assessmentId]);

  if (!rows.length) {
    const err = new Error('Skill assessment was not found.');
    err.statusCode = 404;
    throw err;
  }

  const assessment = rows[0];

  if (candidateId && assessment.candidate_id !== candidateId) {
    const err = new Error('Not authorized for this assessment.');
    err.statusCode = 403;
    throw err;
  }

  if (assessment.status === 'terminated') {
    const err = new Error('Skill assessment was terminated by proctoring rules.');
    err.statusCode = 409;
    throw err;
  }

  if (assessment.status === 'submitted') {
    // Return existing result
    const { rows: resultRows } = await query(
      `SELECT * FROM skill_assessment_results WHERE assessment_id = $1`,
      [assessmentId],
    );
    if (resultRows.length) {
      return {
        assessmentId,
        domain: assessment.domain,
        status: 'submitted',
        timedOut: resultRows[0].timed_out,
        score: Number(resultRows[0].score),
        level: resultRows[0].level,
        correctCount: resultRows[0].correct_count,
        total: resultRows[0].total,
        results: resultRows[0].results,
      };
    }
  }

  const answers = answersInput && typeof answersInput === 'object' ? answersInput : {};
  const items = buildDeterministicSkillAssessment();

  const results = items.map((item) => {
    const selectedChoice = Number(answers[item.id]);
    const correct = selectedChoice === item.correctChoice;
    return {
      id: item.id,
      skill: item.skill,
      selectedChoice: Number.isInteger(selectedChoice) ? selectedChoice : null,
      correctChoice: item.correctChoice,
      correct,
      explanation: item.explanation,
    };
  });

  const correctCount = results.filter((r) => r.correct).length;
  const score = items.length ? clampScore((correctCount / items.length) * 100) : 0;
  const level = levelFromScore(score);
  const isTimedOut = Boolean(timedOut) || Date.now() > new Date(assessment.due_at).getTime();

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE skill_assessments SET status = 'submitted', submitted_at = NOW() WHERE id = $1`,
      [assessmentId],
    );
    await client.query(
      `INSERT INTO skill_assessment_results
         (assessment_id, timed_out, score, level, correct_count, total, results)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (assessment_id) DO UPDATE SET
         timed_out = EXCLUDED.timed_out,
         score = EXCLUDED.score,
         level = EXCLUDED.level,
         correct_count = EXCLUDED.correct_count,
         total = EXCLUDED.total,
         results = EXCLUDED.results`,
      [assessmentId, isTimedOut, score, level, correctCount, items.length, JSON.stringify(results)],
    );
  });

  return {
    assessmentId,
    domain: assessment.domain,
    status: 'submitted',
    timedOut: isTimedOut,
    score,
    level,
    correctCount,
    total: items.length,
    results,
  };
}
