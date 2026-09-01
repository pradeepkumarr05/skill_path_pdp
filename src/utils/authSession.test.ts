import { describe, expect, it } from 'vitest';
import type { AuthCandidateProfile, AuthUser } from '../api/authApi';
import { firstNameFromDisplayName, profileFromCandidate, resolvePostLoginDestination } from './authSession';

const candidate: AuthCandidateProfile = {
  id: 'candidate-1',
  name: 'Ananya Rao',
  email: 'ananya@example.com',
  qualification: 'Bachelor Degree',
  selectedDomain: 'Full Stack Engineering',
  assessmentDomain: 'Full Stack Engineering',
  interestedRoles: ['Associate Software Engineer'],
  claimedSkills: ['React', 'Node.js'],
  resumeFileName: 'resume.pdf',
  transcriptFileName: 'transcript.pdf',
};

function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'ananya@example.com',
    fullName: 'Ananya Rao',
    profileComplete: false,
    candidate: null,
    latestSkillResult: null,
    latestChatSession: null,
    ...overrides,
  };
}

describe('authSession helpers', () => {
  it('builds a profile setup result from a persisted candidate row', () => {
    expect(profileFromCandidate(candidate, authUser({ candidate }))).toEqual({
      name: 'Ananya Rao',
      email: 'ananya@example.com',
      qualification: 'Bachelor Degree',
      domain: 'Full Stack Engineering',
      interestedRoles: ['Associate Software Engineer'],
      claimedSkills: ['React', 'Node.js'],
      resumeFileName: 'resume.pdf',
      transcriptFileName: 'transcript.pdf',
    });
  });

  it('routes incomplete users to profile setup', () => {
    expect(resolvePostLoginDestination(authUser())).toBe('profile');
  });

  it('routes profile-complete users without results to assessment entry', () => {
    expect(resolvePostLoginDestination(authUser({ profileComplete: true, candidate }))).toBe('assessment-guidelines');
  });

  it('routes returning users with a latest result to the learning gap engine', () => {
    expect(
      resolvePostLoginDestination(
        authUser({
          profileComplete: true,
          candidate,
          latestSkillResult: {
            assessmentId: 'assessment-1',
            domain: 'Full Stack Engineering',
            status: 'submitted',
            timedOut: false,
            score: 73,
            level: 'job_ready',
            correctCount: 16,
            total: 22,
            results: [],
          },
        }),
      ),
    ).toBe('learning-roadmap');
  });

  it('extracts a professional first-name greeting fallback', () => {
    expect(firstNameFromDisplayName('Ananya Rao')).toBe('Ananya');
    expect(firstNameFromDisplayName('')).toBe('Candidate');
  });
});
