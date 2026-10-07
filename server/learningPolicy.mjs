import { FULL_STACK_SKILLS } from './domainConfig.mjs';

export const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export function skillEvidence(results, chatStates) {
  return FULL_STACK_SKILLS.map(skill => {
    const items = results.filter(item => item.skill === skill);
    const mcq = items.length ? Math.round(items.filter(item => item.correct).length / items.length * 100) : null;
    const state = chatStates.find(item => item.skill === skill && item.final_score !== null);
    const chat = state ? Number(state.final_score) : null;
    const score = mcq === null ? chat : chat === null ? mcq : Math.round(mcq * .6 + chat * .4);
    // A strong answer in one modality must not hide weakness in the other.
    const skippable = mcq !== null && mcq >= 80 && (chat === null || chat >= 80);
    return { skill, mcq, chat, score, questions: items.length, skippable, status: score === null ? 'Not assessed' : skippable ? 'Review optional' : 'Practice recommended' };
  });
}

export function validatePlan(value, evidence) {
  const required = evidence.filter(item => !item.skippable).map(item => item.skill);
  if (!value || !Array.isArray(value.topics) || value.topics.length !== required.length) throw fail('The learning provider returned an incomplete plan. Please retry.', 502);
  const seen = new Set();
  const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
  const topics = value.topics.map((topic, ti) => {
    if (!required.includes(topic.skill) || seen.has(topic.skill) || !text(topic.reason, 20, 700) || !Array.isArray(topic.sessions) || topic.sessions.length < 2 || topic.sessions.length > 4) throw fail('The learning provider returned an invalid topic. Please retry.', 502);
    seen.add(topic.skill);
    return { id: `topic-${ti}`, skill: topic.skill, reason: topic.reason, sessions: topic.sessions.map((session, si) => {
      if (!text(session.title, 5, 120) || !text(session.objective, 15, 500) || !text(session.content, 300, 8000) || !text(session.exercise, 25, 1500) || !text(session.question, 15, 700) || !Array.isArray(session.choices) || session.choices.length !== 4 || session.choices.some(c => !text(c, 1, 500)) || new Set(session.choices).size !== 4 || !Number.isInteger(session.correctChoice) || session.correctChoice < 0 || session.correctChoice > 3 || !text(session.explanation, 30, 1500)) throw fail('The learning provider returned an invalid lesson. Please retry.', 502);
      return { id: `topic-${ti}-session-${si}`, title: session.title, objective: session.objective, content: session.content, exercise: session.exercise, question: session.question, choices: session.choices, correctChoice: session.correctChoice, explanation: session.explanation, minutes: 10 };
    }) };
  });
  return { topics, evidence, estimatedMinutes: topics.reduce((n, t) => n + t.sessions.length * 10, 0) };
}

export function publicPlan(row, completed = []) {
  if (!row) return null;
  return { id: row.id, createdAt: row.created_at, model: row.model, ...row.plan, completed,
    topics: row.plan.topics.map(t => ({ ...t, sessions: t.sessions.map(({ correctChoice, explanation, ...s }) => s) })) };
}

export function completionAllowed(session, now = Date.now()) {
  return session.status === 'active' && now - new Date(session.started_at).getTime() >= 600000 && now - new Date(session.last_seen_at).getTime() <= 25000;
}
