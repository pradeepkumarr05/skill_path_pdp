export interface AssessmentAccessGrant {
  cameraGranted: boolean;
  microphoneGranted: boolean;
  screenGranted: boolean;
  fullscreenGranted: boolean;
  cameraStream?: MediaStream;
  screenStream?: MediaStream;
}

export interface ChatQuestion {
  id: string;
  skill: string;
  difficulty: 'medium' | 'hard';
  text: string;
  intent: string;
  sequence: number;
  startedAt: string;
  dueAt: string;
  secondsAllowed: number;
}

export interface ChatTranscriptEntry {
  id: string;
  role: 'system' | 'agent' | 'candidate';
  text: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface SkillState {
  skill: string;
  status: string;
  mediumAttempts: number;
  hardAttempts: number;
  finalScore: number | null;
  finalLevel: string | null;
}

export interface AgenticSession {
  skipped?: boolean;
  sessionId?: string;
  status: 'active' | 'completed' | 'terminated' | 'skipped';
  reason?: string;
  candidateName: string;
  selectedDomain: string;
  assessmentDomain: string;
  claimedSkills: string[];
  currentQuestion: ChatQuestion | null;
  transcript: ChatTranscriptEntry[];
  skillStates: SkillState[];
  warningCount: number;
  warningLimit: number;
  answerSeconds: number;
  aggregate: { score: number; level: string; skillsAssessed: number } | null;
  model: string;
  geminiConfigured: boolean;
  completedAt: string | null;
  terminatedAt: string | null;
}

export interface SkillAssessmentItem {
  id: string;
  skill: string;
  prompt: string;
  choices: string[];
}

export interface SkillAssessment {
  assessmentId: string;
  domain: string;
  selectedDomain: string;
  status: 'active' | 'submitted' | 'terminated';
  startedAt: string;
  dueAt: string;
  durationSeconds: number;
  secondsPerItem: number;
  warningCount: number;
  warningLimit: number;
  items: SkillAssessmentItem[];
}

export interface SkillAssessmentResult {
  assessmentId: string;
  domain: string;
  status: 'submitted';
  timedOut: boolean;
  score: number;
  level: string;
  correctCount: number;
  total: number;
  results: Array<{
    id: string;
    skill: string;
    selectedChoice: number | null;
    correctChoice: number;
    correct: boolean;
    explanation: string;
  }>;
}

export interface RoadmapSubtopic {
  id: string;
  skill: string;
  title: string;
  objective: string;
  minutes: number;
  checkPrompt: string;
  correction: string;
  notes: string[];
}

export interface RoadmapTopic {
  id: string;
  skill: string;
  title: string;
  priority: 'Critical' | 'High' | 'Medium';
  score: number;
  source: 'Chatbot + OA' | 'OA';
  reason: string;
  subtopics: RoadmapSubtopic[];
}

export interface NotebookEntry {
  id: string;
  subtopicId: string;
  skill: string;
  title: string;
  completedAt: string;
  notes: string[];
}
