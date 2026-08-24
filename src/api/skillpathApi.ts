import type { AgenticSession, SkillAssessment, SkillAssessmentResult } from '../types/assessment';
import type { ProfileSetupResult } from '../pages/ProfileSetupPage';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export function startAgentSession(profile: ProfileSetupResult) {
  return postJson<AgenticSession>('/api/agent/start', { profile });
}

export function submitAgentAnswer(sessionId: string, questionId: string, answer: string, timedOut = false) {
  return postJson<AgenticSession>('/api/agent/answer', { sessionId, questionId, answer, timedOut });
}

export function recordProctorEvent(sessionId: string, type: string, detail = '') {
  return postJson<AgenticSession>('/api/agent/proctor', { sessionId, type, detail });
}

export function createSkillAssessment(profile: ProfileSetupResult) {
  return postJson<SkillAssessment>('/api/skill-assessment', { profile });
}

export function recordSkillAssessmentProctorEvent(assessmentId: string, type: string, detail = '') {
  return postJson<SkillAssessment>('/api/skill-assessment/proctor', { assessmentId, type, detail });
}

export function submitSkillAssessment(assessmentId: string, answers: Record<string, number>, timedOut = false) {
  return postJson<SkillAssessmentResult>('/api/skill-assessment/submit', { assessmentId, answers, timedOut });
}
