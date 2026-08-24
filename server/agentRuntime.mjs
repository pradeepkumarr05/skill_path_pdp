import { randomUUID } from 'node:crypto';
import { SUPPORTED_DOMAIN, normalizeClaimedSkills } from './domainConfig.mjs';
import { SKILL_ASSESSMENT_SECONDS_PER_ITEM, buildDeterministicSkillAssessment, publicSkillAssessmentItems } from './deterministicSkillAssessment.mjs';
import { generateGeminiJson, geminiModel, isGeminiConfigured } from './geminiClient.mjs';

const sessions = new Map();
const skillAssessments = new Map();

const ANSWER_SECONDS = 45;
const PROCTOR_WARNING_LIMIT = 3;
const MEDIUM_PASS_SCORE = 65;
const HARD_PASS_SCORE = 70;

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
    selectedDomain: String(input?.domain || SUPPORTED_DOMAIN).trim() || SUPPORTED_DOMAIN,
    assessmentDomain: SUPPORTED_DOMAIN,
    interestedRoles: Array.isArray(input?.interestedRoles) ? input.interestedRoles.map(String).filter(Boolean) : [],
    claimedSkills: normalizeClaimedSkills(input),
  };
}

function summarizeTranscript(session) {
  return session.transcript
    .slice(-12)
    .map((entry) => {
      const meta = entry.meta?.skill ? ` (${entry.meta.skill}${entry.meta.difficulty ? `, ${entry.meta.difficulty}` : ''})` : '';
      return `${entry.role}${meta}: ${entry.text}`;
    })
    .join('\n');
}

function publicQuestion(question) {
  if (!question) return null;
  return {
    id: question.id,
    skill: question.skill,
    difficulty: question.difficulty,
    text: question.text,
    intent: question.intent,
    sequence: question.sequence,
    startedAt: question.startedAt,
    dueAt: question.dueAt,
    secondsAllowed: ANSWER_SECONDS,
  };
}

function publicSession(session) {
  return {
    sessionId: session.id,
    status: session.status,
    reason: session.reason,
    candidateName: session.profile.name,
    selectedDomain: session.profile.selectedDomain,
    assessmentDomain: session.profile.assessmentDomain,
    claimedSkills: session.profile.claimedSkills,
    currentQuestion: publicQuestion(session.currentQuestion),
    transcript: session.transcript,
    skillStates: session.skills.map((skill) => ({
      skill: skill.skill,
      status: skill.status,
      mediumAttempts: skill.mediumAttempts,
      hardAttempts: skill.hardAttempts,
      finalScore: skill.finalScore,
      finalLevel: skill.finalLevel,
    })),
    warningCount: session.warningCount,
    warningLimit: PROCTOR_WARNING_LIMIT,
    answerSeconds: ANSWER_SECONDS,
    aggregate: session.aggregate,
    model: geminiModel(),
    geminiConfigured: isGeminiConfigured(),
    completedAt: session.completedAt,
    terminatedAt: session.terminatedAt,
  };
}

function pushTranscript(session, role, text, meta = {}) {
  session.transcript.push({
    id: randomUUID(),
    role,
    text,
    createdAt: nowIso(),
    meta,
  });
}

function currentSkill(session) {
  return session.skills[session.currentSkillIndex] || null;
}

function buildQuestionPrompt(session, skillState, difficulty) {
  const claimedSkills = session.profile.claimedSkills.join(', ');
  const roles = session.profile.interestedRoles.join(', ') || 'not specified';

  return `
Candidate profile:
${JSON.stringify(session.profile, null, 2)}

Assessment policy:
- Product: SkillPath agentic chatbot assessment.
- Supported prototype domain: ${SUPPORTED_DOMAIN}.
- The user's selected domain is preserved, but this prototype assesses Full Stack Engineering skills only.
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
${summarizeTranscript(session) || 'No previous transcript.'}

Return JSON with:
- question: the next question exactly as the chatbot should ask it.
- intent: one sentence explaining what competency this question checks, for internal UI audit only.
`.trim();
}

async function createQuestion(session, skillState, difficulty) {
  const response = await generateGeminiJson({
    systemInstruction:
      'You are the SkillPath assessment chatbot. Your job is to generate the next candidate-facing question in an adaptive technical interview. You must be precise, practical, and concise. Return only valid JSON.',
    prompt: buildQuestionPrompt(session, skillState, difficulty),
    schema: questionSchema,
    temperature: difficulty === 'hard' ? 0.45 : 0.35,
    maxOutputTokens: 700,
  });

  const startedAt = Date.now();
  return {
    id: randomUUID(),
    skill: skillState.skill,
    difficulty,
    text: String(response.question || '').trim(),
    intent: String(response.intent || '').trim(),
    sequence: session.questionSequence + 1,
    startedAt: new Date(startedAt).toISOString(),
    dueAt: new Date(startedAt + ANSWER_SECONDS * 1000).toISOString(),
  };
}

function buildEvaluationPrompt(session, question, answer, timedOut) {
  return `
Candidate profile:
${JSON.stringify(session.profile, null, 2)}

Current assessment state:
${JSON.stringify(
  {
    skill: question.skill,
    difficulty: question.difficulty,
    mediumPassScore: MEDIUM_PASS_SCORE,
    hardPassScore: HARD_PASS_SCORE,
    mediumAttemptsUsed: currentSkill(session)?.mediumAttempts ?? 0,
    progression: 'Pass medium to get one hard question. Fail medium and the runtime moves on to the next skill.',
  },
  null,
  2,
)}

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

async function evaluateAnswer(session, question, answer, timedOut) {
  const response = await generateGeminiJson({
    systemInstruction:
      'You are the SkillPath assessment evaluator. You evaluate typed technical answers for job readiness. Return only strict JSON matching the requested schema.',
    prompt: buildEvaluationPrompt(session, question, answer, timedOut),
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

function recordWarning(session, type, detail) {
  if (session.status !== 'active') return;

  session.warningCount += 1;
  session.proctorEvents.push({
    id: randomUUID(),
    type,
    detail: String(detail || ''),
    createdAt: nowIso(),
  });

  pushTranscript(session, 'system', `${proctorLabel(type)}. Warning ${session.warningCount}/${PROCTOR_WARNING_LIMIT}.`, {
    type: 'proctor_warning',
    violationType: type,
  });

  if (session.warningCount >= PROCTOR_WARNING_LIMIT) {
    terminateSession(session, 'Assessment terminated after repeated proctoring violations.');
  }
}

function terminateSession(session, reason) {
  session.status = 'terminated';
  session.reason = reason;
  session.terminatedAt = nowIso();
  session.currentQuestion = null;
  pushTranscript(session, 'system', reason, { type: 'terminated' });
}

function completeSession(session) {
  const completedSkills = session.skills.filter((skill) => Number.isFinite(skill.finalScore));
  const aggregateScore = completedSkills.length
    ? clampScore(completedSkills.reduce((sum, skill) => sum + skill.finalScore, 0) / completedSkills.length)
    : 0;

  session.status = 'completed';
  session.completedAt = nowIso();
  session.currentQuestion = null;
  session.aggregate = {
    score: aggregateScore,
    level: levelFromScore(aggregateScore),
    skillsAssessed: completedSkills.length,
  };

  pushTranscript(session, 'agent', `Chatbot assessment complete. Overall chatbot readiness level: ${session.aggregate.level.replace('_', ' ')}.`, {
    type: 'complete',
  });
}

async function askNextQuestion(session, skillState, difficulty) {
  session.currentQuestion = await createQuestion(session, skillState, difficulty);
  session.questionSequence += 1;

  pushTranscript(session, 'agent', session.currentQuestion.text, {
    type: 'question',
    skill: session.currentQuestion.skill,
    difficulty: session.currentQuestion.difficulty,
    questionId: session.currentQuestion.id,
    intent: session.currentQuestion.intent,
  });
}

async function moveToNextSkill(session) {
  session.currentSkillIndex += 1;
  const nextSkill = currentSkill(session);

  if (!nextSkill) {
    completeSession(session);
    return;
  }

  nextSkill.status = 'medium';
  await askNextQuestion(session, nextSkill, 'medium');
}

async function advanceAfterEvaluation(session, evaluation) {
  const skillState = currentSkill(session);
  const question = session.currentQuestion;
  if (!skillState || !question) return;

  skillState.attempts.push({
    questionId: question.id,
    difficulty: question.difficulty,
    score: evaluation.score,
    level: evaluation.level,
    feedback: evaluation.feedback,
    strengths: evaluation.strengths,
    gaps: evaluation.gaps,
    createdAt: nowIso(),
  });

  if (question.difficulty === 'medium') {
    skillState.mediumAttempts += 1;

    if (evaluation.pass || evaluation.nextAction === 'ask_hard') {
      skillState.status = 'hard';
      await askNextQuestion(session, skillState, 'hard');
      return;
    }

    skillState.status = 'completed_medium_only';
    skillState.finalScore = evaluation.score;
    skillState.finalLevel = evaluation.level;
    await moveToNextSkill(session);
    return;
  }

  skillState.hardAttempts += 1;
  const mediumScores = skillState.attempts.filter((attempt) => attempt.difficulty === 'medium').map((attempt) => attempt.score);
  const bestMediumScore = mediumScores.length ? Math.max(...mediumScores) : 0;
  skillState.finalScore = clampScore(bestMediumScore * 0.45 + evaluation.score * 0.55);
  skillState.finalLevel = levelFromScore(skillState.finalScore);
  skillState.status = 'completed';
  await moveToNextSkill(session);
}

export async function startAgenticSession(profileInput) {
  const profile = sanitizeProfile(profileInput);

  if (!profile.claimedSkills.length) {
    return {
      skipped: true,
      status: 'skipped',
      reason: 'No claimed skills were submitted, so chatbot assessment is skipped.',
      candidateName: profile.name,
      selectedDomain: profile.selectedDomain,
      assessmentDomain: profile.assessmentDomain,
      claimedSkills: [],
      model: geminiModel(),
      geminiConfigured: isGeminiConfigured(),
    };
  }

  const session = {
    id: randomUUID(),
    status: 'active',
    reason: '',
    profile,
    skills: profile.claimedSkills.map((skill) => ({
      skill,
      status: 'pending',
      mediumAttempts: 0,
      hardAttempts: 0,
      attempts: [],
      finalScore: null,
      finalLevel: null,
    })),
    currentSkillIndex: 0,
    currentQuestion: null,
    questionSequence: 0,
    transcript: [],
    proctorEvents: [],
    warningCount: 0,
    aggregate: null,
    createdAt: nowIso(),
    completedAt: null,
    terminatedAt: null,
  };

  sessions.set(session.id, session);
  pushTranscript(session, 'system', `Gemini-backed SkillPath chatbot started for ${profile.claimedSkills.join(', ')}.`, {
    type: 'session_started',
    model: geminiModel(),
  });

  const firstSkill = currentSkill(session);
  firstSkill.status = 'medium';
  await askNextQuestion(session, firstSkill, 'medium');

  return publicSession(session);
}

export async function submitAgenticAnswer(sessionId, payload) {
  const session = sessions.get(sessionId);
  if (!session) {
    const error = new Error('Assessment session was not found.');
    error.statusCode = 404;
    throw error;
  }

  if (session.status !== 'active') {
    return publicSession(session);
  }

  const question = session.currentQuestion;
  if (!question || payload?.questionId !== question.id) {
    const error = new Error('Question is no longer active.');
    error.statusCode = 409;
    throw error;
  }

  const timedOut = Boolean(payload?.timedOut) || Date.now() > new Date(question.dueAt).getTime();
  const answer = timedOut ? '' : String(payload?.answer || '').trim();

  if (timedOut) {
    recordWarning(session, 'answer_timeout', 'Candidate did not submit within the per-answer timer.');
  }

  pushTranscript(session, 'candidate', answer || '[No answer submitted]', {
    type: 'answer',
    questionId: question.id,
    timedOut,
    skill: question.skill,
    difficulty: question.difficulty,
  });

  if (session.status !== 'active') {
    return publicSession(session);
  }

  const evaluation = await evaluateAnswer(session, question, answer, timedOut);
  pushTranscript(session, 'agent', evaluation.feedback, {
    type: 'evaluation',
    questionId: question.id,
    skill: question.skill,
    difficulty: question.difficulty,
    score: evaluation.score,
    level: evaluation.level,
    strengths: evaluation.strengths,
    gaps: evaluation.gaps,
  });

  await advanceAfterEvaluation(session, evaluation);
  return publicSession(session);
}

export function recordProctorEvent(sessionId, payload) {
  const session = sessions.get(sessionId);
  if (!session) {
    const error = new Error('Assessment session was not found.');
    error.statusCode = 404;
    throw error;
  }

  recordWarning(session, String(payload?.type || 'proctor_event'), payload?.detail || '');
  return publicSession(session);
}

export function getAgenticSession(sessionId) {
  const session = sessions.get(sessionId);
  return session ? publicSession(session) : null;
}

function publicSkillAssessment(assessment) {
  return {
    assessmentId: assessment.assessmentId,
    domain: assessment.domain,
    selectedDomain: assessment.selectedDomain,
    status: assessment.status,
    startedAt: assessment.startedAt,
    dueAt: assessment.dueAt,
    durationSeconds: assessment.durationSeconds,
    secondsPerItem: SKILL_ASSESSMENT_SECONDS_PER_ITEM,
    warningCount: assessment.warningCount,
    warningLimit: PROCTOR_WARNING_LIMIT,
    items: publicSkillAssessmentItems(assessment.items),
  };
}

export async function createSkillAssessment(profileInput) {
  const profile = sanitizeProfile(profileInput);
  const assessmentId = randomUUID();
  const items = buildDeterministicSkillAssessment();
  const startedAt = Date.now();

  const assessment = {
    assessmentId,
    profile,
    domain: SUPPORTED_DOMAIN,
    selectedDomain: profile.selectedDomain,
    status: 'active',
    items,
    warningCount: 0,
    proctorEvents: [],
    startedAt: new Date(startedAt).toISOString(),
    dueAt: new Date(startedAt + items.length * SKILL_ASSESSMENT_SECONDS_PER_ITEM * 1000).toISOString(),
    durationSeconds: items.length * SKILL_ASSESSMENT_SECONDS_PER_ITEM,
    createdAt: nowIso(),
    submittedAt: null,
    terminatedAt: null,
  };

  skillAssessments.set(assessmentId, assessment);
  return publicSkillAssessment(assessment);
}

export function recordSkillAssessmentProctorEvent(assessmentId, payload) {
  const assessment = skillAssessments.get(assessmentId);
  if (!assessment) {
    const error = new Error('Skill assessment was not found.');
    error.statusCode = 404;
    throw error;
  }

  if (assessment.status !== 'active') {
    return publicSkillAssessment(assessment);
  }

  assessment.warningCount += 1;
  assessment.proctorEvents.push({
    id: randomUUID(),
    type: String(payload?.type || 'proctor_event'),
    detail: String(payload?.detail || ''),
    createdAt: nowIso(),
  });

  if (assessment.warningCount >= PROCTOR_WARNING_LIMIT) {
    assessment.status = 'terminated';
    assessment.terminatedAt = nowIso();
  }

  return publicSkillAssessment(assessment);
}

export function submitSkillAssessment(assessmentId, answersInput, timedOut = false) {
  const assessment = skillAssessments.get(assessmentId);
  if (!assessment) {
    const error = new Error('Skill assessment was not found.');
    error.statusCode = 404;
    throw error;
  }

  if (assessment.status === 'terminated') {
    const error = new Error('Skill assessment was terminated by proctoring rules.');
    error.statusCode = 409;
    throw error;
  }

  const answers = answersInput && typeof answersInput === 'object' ? answersInput : {};
  const results = assessment.items.map((item) => {
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

  const correctCount = results.filter((result) => result.correct).length;
  const score = results.length ? clampScore((correctCount / results.length) * 100) : 0;
  assessment.status = 'submitted';
  assessment.submittedAt = nowIso();

  return {
    assessmentId,
    domain: assessment.domain,
    status: assessment.status,
    timedOut: Boolean(timedOut) || Date.now() > new Date(assessment.dueAt).getTime(),
    score,
    level: levelFromScore(score),
    correctCount,
    total: results.length,
    results,
  };
}
