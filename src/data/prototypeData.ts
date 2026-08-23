import type { UserProfile } from '../types/agent';

export interface PrototypeSkill {
  id: string;
  name: string;
  domain: string;
  claimed: number;
  industryTarget: number;
  description: string;
}

export interface PrototypeModule {
  id: string;
  title: string;
  status: string;
  summary: string;
}

export const prototypeUser: UserProfile = {
  name: 'Aarav Mehta',
  role: 'Junior Software Engineer',
  domain: 'Software Development',
  experienceLevel: 'Fresher',
  selectedSkillIds: ['se-101', 'se-102', 'se-103'],
};

export const prototypeSkills: PrototypeSkill[] = [
  {
    id: 'se-101',
    name: 'Software Design and SOLID',
    domain: 'Software Development',
    claimed: 4,
    industryTarget: 4,
    description: 'Dependency boundaries, inversion of control, and maintainable service design.',
  },
  {
    id: 'se-102',
    name: 'React State Architecture',
    domain: 'Software Development',
    claimed: 5,
    industryTarget: 4,
    description: 'Predictable client state, async data flow, and UI synchronization.',
  },
  {
    id: 'se-103',
    name: 'API and Event Contracts',
    domain: 'Software Development',
    claimed: 4,
    industryTarget: 4,
    description: 'REST routing, event payload validation, and service boundary design.',
  },
  {
    id: 'se-104',
    name: 'Testing and Debugging',
    domain: 'Software Development',
    claimed: 3,
    industryTarget: 4,
    description: 'Component validation, regression checks, and operational debugging.',
  },
];

export const pipelineModules: PrototypeModule[] = [
  {
    id: 'entry',
    title: 'Login and Profile',
    status: 'Prototype',
    summary: 'Local session identity, domain selection, and claimed skill capture.',
  },
  {
    id: 'assessment',
    title: 'Proctored Assessment',
    status: 'Active',
    summary: 'Descriptive response, MCQ submission, timer context, and violation logging.',
  },
  {
    id: 'reasoning',
    title: 'Gap Detection',
    status: 'Computed',
    summary: 'Claimed vs measured skill scoring and industry readiness deltas.',
  },
  {
    id: 'learnbot',
    title: 'Learning Roadmap',
    status: 'Generated',
    summary: '10-minute remediation nodes with notebook entries for revision.',
  },
  {
    id: 'review',
    title: 'Mock and Interview',
    status: 'Gate',
    summary: 'Mock scores, interview scores, final readiness, and fallback loop.',
  },
];

export const assessmentQuestions = [
  {
    id: 'descriptive',
    prompt:
      'Explain how you would split responsibilities between a React UI, a Zustand store, and an Express event backend in a proctored assessment system.',
  },
  {
    id: 'mcq-1',
    prompt: 'Which event should be emitted when the browser tab becomes hidden during assessment?',
    options: ['EVENT:PROCTOR_ALERT', 'STATE:SYNC', 'EVENT:RESET_SESSION', 'EVENT:LEARNBOT_NODE_COMPLETE'],
    answer: 'EVENT:PROCTOR_ALERT',
  },
  {
    id: 'mcq-2',
    prompt: 'What should the reasoning layer output after assessment completion?',
    options: ['A learning roadmap', 'A login token', 'A static PDF only', 'A browser cookie'],
    answer: 'A learning roadmap',
  },
  {
    id: 'mcq-3',
    prompt: 'What happens when final readiness is below the baseline?',
    options: ['Fallback remediation activates', 'The certificate is always issued', 'All nodes are deleted', 'The session exits'],
    answer: 'Fallback remediation activates',
  },
];
