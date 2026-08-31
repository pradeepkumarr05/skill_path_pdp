/**
 * src/api/skillpathApi.ts
 * Frontend API client with JWT authentication.
 *
 * Auth flow:
 *  1. login(profile) → stores token in module-level var + sessionStorage
 *  2. All subsequent calls attach Bearer token header automatically
 *  3. logout() clears the stored token
 */
import type { AgenticSession, SkillAssessment, SkillAssessmentResult } from '../types/assessment';
import type { ProfileSetupResult } from '../pages/ProfileSetupPage';

// ── Token Storage ─────────────────────────────────────────────────────────
let _token: string | null = null;

function getStoredToken(): string | null {
  if (_token) return _token;
  try {
    _token = sessionStorage.getItem('skillpath_jwt');
  } catch {
    // sessionStorage unavailable in some environments
  }
  return _token;
}

function storeToken(token: string) {
  _token = token;
  try {
    sessionStorage.setItem('skillpath_jwt', token);
  } catch {
    // ignore
  }
}

export function clearToken() {
  _token = null;
  try {
    sessionStorage.removeItem('skillpath_jwt');
  } catch {
    // ignore
  }
}

export function hasToken(): boolean {
  return Boolean(getStoredToken());
}

// ── HTTP Helpers ──────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string })?.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    headers: {
      ...authHeaders(),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string })?.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

// ── Auth APIs ─────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    qualification: string;
    selectedDomain: string;
    assessmentDomain: string;
    interestedRoles: string[];
    claimedSkills: string[];
  };
}

/**
 * Login / register a candidate by email.
 * Stores the returned JWT for subsequent calls.
 */
export async function login(profile: ProfileSetupResult): Promise<LoginResponse> {
  const response = await postJson<LoginResponse>('/api/auth/login', {
    email: profile.email,
    name: profile.name,
    qualification: profile.qualification,
    domain: profile.domain,
    interestedRoles: profile.interestedRoles,
    claimedSkills: profile.claimedSkills,
  });

  storeToken(response.token);
  return response;
}

export function logout() {
  clearToken();
}

// ── Chatbot Assessment APIs ───────────────────────────────────────────────

export function startAgentSession(profile: ProfileSetupResult) {
  return postJson<AgenticSession>('/api/agent/start', { profile });
}

export function submitAgentAnswer(sessionId: string, questionId: string, answer: string, timedOut = false) {
  return postJson<AgenticSession>('/api/agent/answer', { sessionId, questionId, answer, timedOut });
}

export function recordProctorEvent(sessionId: string, type: string, detail = '') {
  return postJson<AgenticSession>('/api/agent/proctor', { sessionId, type, detail });
}

export function getAgentSession(sessionId: string) {
  return getJson<AgenticSession>(`/api/agent/session?sessionId=${encodeURIComponent(sessionId)}`);
}

// ── MCQ Skill Assessment APIs ─────────────────────────────────────────────

export function createSkillAssessment(profile: ProfileSetupResult) {
  return postJson<SkillAssessment>('/api/skill-assessment', { profile });
}

export function recordSkillAssessmentProctorEvent(assessmentId: string, type: string, detail = '') {
  return postJson<SkillAssessment>('/api/skill-assessment/proctor', { assessmentId, type, detail });
}

export function submitSkillAssessment(assessmentId: string, answers: Record<string, number>, timedOut = false) {
  return postJson<SkillAssessmentResult>('/api/skill-assessment/submit', { assessmentId, answers, timedOut });
}
