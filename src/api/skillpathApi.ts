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
    profileComplete: boolean;
    setup: Record<string, string>;
    latestResult?: { score: number; level: string; total: number; correct_count: number } | null;
    assessmentHistory: Array<{
      type: 'chatbot' | 'deterministic'; id: string; status: string; reason?: string; aggregate?: { score: number; level: string; skillsAssessed: number } | null;
      model?: string; geminiConfigured?: boolean; warningCount?: number; score?: number | null; level?: string; total?: number; correctCount?: number; timedOut?: boolean;
      createdAt: string; completedAt?: string | null; terminatedAt?: string | null;
    }>;
  };
}

/**
 * Login / register a candidate by email.
 * Stores the returned JWT for subsequent calls.
 */
export async function login(profile: ProfileSetupResult & { username?: string; password?: string }): Promise<LoginResponse> {
  const response = await postJson<LoginResponse>('/api/auth/profile', {
    email: profile.email,
    name: profile.name,
    username: profile.username,
    password: profile.password,
    qualification: profile.qualification,
    domain: profile.domain,
    interestedRoles: profile.interestedRoles,
    claimedSkills: profile.claimedSkills,
    setup: profile.setup,
    resumeFileName: profile.resumeFileName,
    transcriptFileName: profile.transcriptFileName,
  });

  return response;
}

export async function register(username: string, email: string, password: string) {
  const response = await postJson<LoginResponse>('/api/auth/register', { username, email, password });
  storeToken(response.token);
  return response;
}

export async function googleLogin(credential: string) {
  const response = await postJson<LoginResponse>('/api/auth/google', { credential });
  storeToken(response.token);
  return response;
}

export function currentUser() { return getJson<LoginResponse['candidate']>('/api/auth/me'); }

export async function uploadDocument(file: File, kind: 'resume' | 'transcript') {
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return postJson<{ filename: string }>('/api/auth/document', { kind, filename: file.name, content });
}

export async function loginCredentials(username: string, password: string): Promise<LoginResponse> {
  const response = await postJson<LoginResponse>('/api/auth/login_credentials', {
    username,
    password,
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
