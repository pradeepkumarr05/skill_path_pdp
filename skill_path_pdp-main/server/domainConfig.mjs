export const SUPPORTED_DOMAIN = 'Full Stack Engineering';

export const FULL_STACK_SKILLS = [
  'HTML',
  'CSS',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'REST APIs',
  'Data Structures and Algorithms',
  'PostgreSQL',
  'MongoDB',
  'Git',
];

export function normalizeClaimedSkills(profile) {
  const claimedSkills = Array.isArray(profile?.claimedSkills) ? profile.claimedSkills : [];
  return claimedSkills.map((skill) => String(skill).trim()).filter(Boolean);
}

export function supportedAssessmentSkills() {
  return FULL_STACK_SKILLS;
}
