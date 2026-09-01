import type { AgenticSession, SkillAssessmentResult } from '../types/assessment';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export interface AuthCandidateProfile {
  id: string;
  name: string;
  email: string;
  qualification: string;
  selectedDomain: string;
  assessmentDomain: string;
  interestedRoles: string[];
  claimedSkills: string[];
  resumeFileName?: string | null;
  transcriptFileName?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string | null;
  profileComplete: boolean;
  candidate?: AuthCandidateProfile | null;
  latestSkillResult?: SkillAssessmentResult | null;
  latestChatSession?: AgenticSession | null;
}

export class AuthApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfTokenPromise: Promise<string> | null = null;

/**
 * Fetches (and caches) the CSRF token issued by the server. The token also
 * lands in a readable cookie; we read it back out so every mutating
 * request can echo it in the X-CSRF-Token header (double-submit pattern).
 */
async function getCsrfToken(): Promise<string> {
  const existing = readCookie('csrf_token');
  if (existing) return existing;

  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => data.csrfToken as string)
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
}

async function request<T>(path: string, options: RequestInit = {}, withCsrf = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (withCsrf) {
    headers['X-CSRF-Token'] = await getCsrfToken();
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    throw new AuthApiError(body.error || 'Something went wrong. Please try again.', response.status, body.code);
  }

  return body as T;
}

export async function login(email: string, password: string, rememberDevice = true): Promise<{ user: AuthUser; token?: string }> {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, rememberDevice }) }, true);
}

export async function loginWithGoogle(idToken: string): Promise<{ user: AuthUser }> {
  return request('/api/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }, true);
}

export async function register(
  email: string,
  password: string,
  fullName?: string,
  rememberDevice = true,
): Promise<{ user: AuthUser }> {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName, rememberDevice }) }, true);
}

export async function saveProfile(profile: {
  name: string;
  email: string;
  qualification: string;
  domain: string;
  interestedRoles: string[];
  claimedSkills: string[];
  resumeFileName?: string;
  transcriptFileName?: string;
}): Promise<{ user: AuthUser }> {
  return request('/api/auth/profile', { method: 'POST', body: JSON.stringify(profile) }, true);
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, true);
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<{ message: string }> {
  return request(
    '/api/auth/reset-password',
    { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) },
    true,
  );
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' }, true);
}

export async function getCurrentUser(): Promise<{ user: AuthUser } | null> {
  try {
    return await request('/api/auth/me', { method: 'GET' });
  } catch {
    return null;
  }
}
