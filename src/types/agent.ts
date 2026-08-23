export type AgentName =
  | 'IDLE'
  | 'ASSESSMENT'
  | 'REASONING'
  | 'LEARNBOT'
  | 'INTERVIEWER'
  | 'FINAL_REVIEW'
  | 'FALLBACK';

export type ProctorViolationType = 'TAB_SWITCH' | 'CLIPBOARD_PASTE';

export type RoadmapNodeStatus = 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'REMEDIATION';

export type EventLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface UserProfile {
  name: string;
  role: string;
  domain: string;
  experienceLevel: 'Student' | 'Fresher' | 'Professional';
  selectedSkillIds: string[];
}

export interface ProctorLog {
  id: string;
  type: ProctorViolationType;
  timestamp: number;
  metadata: {
    source: 'visibilitychange' | 'clipboard' | 'manual';
    pageHidden?: boolean;
    userAgent?: string;
  };
}

export interface SkillProfile {
  skillId: string;
  name: string;
  claimed: number;
  measured: number;
  delta: number;
  isReady: boolean;
}

export interface RoadmapNode {
  id: string;
  skillId: string;
  topic: string;
  duration: number;
  status: RoadmapNodeStatus;
  subtopics: string[];
  remediationInstructions?: string;
}

export interface AssessmentAnswers {
  descriptiveAnswer: string;
  mcqAnswers: Record<string, string>;
  claimedSkillIds: string[];
  submittedAt: number;
}

export interface NotebookEntry {
  id: string;
  nodeId: string;
  title: string;
  markdown: string;
  createdAt: number;
}

export interface PerformanceSummary {
  mockScore: number;
  interviewScore: number;
  aggregateScore: number;
  readinessScore: number;
  strengths: string[];
  weakAreas: string[];
  finalAdvice: string;
  certificateAvailable: boolean;
}

export interface AgentEventLog {
  id: string;
  timestamp: number;
  level: EventLogLevel;
  message: string;
  activeAgent: AgentName;
}

export interface AgentSessionContext {
  userId: string;
  user: UserProfile;
  activeAgent: AgentName;
  violations: ProctorLog[];
  skills: Record<string, SkillProfile>;
  roadmap: RoadmapNode[];
  assessment?: AssessmentAnswers;
  notebook: NotebookEntry[];
  performance?: PerformanceSummary;
  isFallbackActive: boolean;
  eventLog: AgentEventLog[];
  updatedAt: number;
}

export interface SessionInitPayload {
  userId: string;
  profile: UserProfile;
}

export interface AssessmentSubmitPayload {
  userId: string;
  descriptiveAnswer: string;
  mcqAnswers: Record<string, string>;
  claimedSkillIds: string[];
}

export interface ProctorAlertPayload {
  userId: string;
  type: ProctorViolationType;
  metadata: ProctorLog['metadata'];
}

export interface NodeCompletePayload {
  userId: string;
  nodeId: string;
}

export interface MockInterviewSubmitPayload {
  userId: string;
  mockScore: number;
  interviewScore: number;
}

export interface SessionUserPayload {
  userId: string;
}
