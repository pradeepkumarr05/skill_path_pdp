import type { AuthCandidateProfile, AuthUser } from '../api/authApi';
import type { ProfileSetupResult } from '../pages/ProfileSetupPage';

export type PostLoginDestination = 'profile' | 'assessment-guidelines' | 'learning-roadmap';

export function firstNameFromDisplayName(name: string | null | undefined): string {
  return String(name || '').trim().split(/\s+/)[0] || 'Candidate';
}

export function profileFromCandidate(candidate: AuthCandidateProfile | null | undefined, user?: AuthUser | null): ProfileSetupResult | null {
  if (!candidate) return null;

  return {
    name: candidate.name || user?.fullName || firstNameFromDisplayName(user?.email),
    email: candidate.email || user?.email || '',
    qualification: (candidate.qualification || 'Bachelor Degree') as ProfileSetupResult['qualification'],
    domain: (candidate.selectedDomain || candidate.assessmentDomain || 'Full Stack Engineering') as ProfileSetupResult['domain'],
    interestedRoles: candidate.interestedRoles || [],
    claimedSkills: candidate.claimedSkills || [],
    resumeFileName: candidate.resumeFileName || undefined,
    transcriptFileName: candidate.transcriptFileName || undefined,
  };
}

export function resolvePostLoginDestination(user: AuthUser): PostLoginDestination {
  if (!user.profileComplete || !user.candidate) {
    return 'profile';
  }

  if (user.latestSkillResult) {
    return 'learning-roadmap';
  }

  return 'assessment-guidelines';
}
