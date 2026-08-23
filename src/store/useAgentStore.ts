import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { prototypeUser } from '../data/prototypeData';
import type {
  AgentEventLog,
  AgentName,
  AgentSessionContext,
  AssessmentSubmitPayload,
  MockInterviewSubmitPayload,
  NotebookEntry,
  PerformanceSummary,
  ProctorViolationType,
  RoadmapNode,
  SkillProfile,
  UserProfile,
} from '../types/agent';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface AgentStore {
  userId: string;
  activeAgent: AgentName;
  violations: AgentSessionContext['violations'];
  skills: Record<string, SkillProfile>;
  roadmap: RoadmapNode[];
  notebook: NotebookEntry[];
  performance?: PerformanceSummary;
  isFallbackActive: boolean;
  eventLog: AgentEventLog[];
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
  initializeSession: (userId: string, profile?: UserProfile) => Promise<void>;
  connectSystem: (userId: string) => void;
  disconnectSystem: () => void;
  emitProctorViolation: (userId: string, type: ProctorViolationType, source: 'visibilitychange' | 'clipboard' | 'manual') => void;
  submitAssessment: (payload: AssessmentSubmitPayload) => void;
  completeRoadmapNode: (userId: string, nodeId: string) => void;
  submitMockInterview: (payload: MockInterviewSubmitPayload) => void;
  triggerFallbackManual: (userId: string) => void;
  resetSession: (userId: string) => void;
}

const API_BASE = import.meta.env.VITE_AGENT_API_URL ?? 'http://localhost:3001';
const SOCKET_BASE = import.meta.env.VITE_AGENT_SOCKET_URL ?? 'http://localhost:3001';

function validateUserId(userId: string): string {
  if (typeof userId !== 'string' || userId.trim().length < 3) {
    throw new Error('A valid userId is required before dispatching agent events.');
  }

  return userId.trim();
}

function validateScore(score: number, label: string): number {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`${label} must be a number from 0 to 100.`);
  }

  return Math.round(score);
}

function mapContext(set: (partial: Partial<AgentStore>) => void, context: AgentSessionContext): void {
  set({
    userId: context.userId,
    activeAgent: context.activeAgent,
    violations: context.violations,
    skills: context.skills,
    roadmap: context.roadmap,
    notebook: context.notebook,
    performance: context.performance,
    isFallbackActive: context.isFallbackActive,
    eventLog: context.eventLog,
    error: null,
  });
}

function getConnectedSocket(get: () => AgentStore): Socket {
  const socket = get().socket;

  if (!socket || !socket.connected) {
    throw new Error('Agent socket is not connected.');
  }

  return socket;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  userId: 'prototype-user-001',
  activeAgent: 'IDLE',
  violations: [],
  skills: {},
  roadmap: [],
  notebook: [],
  performance: undefined,
  isFallbackActive: false,
  eventLog: [],
  socket: null,
  connectionStatus: 'idle',
  error: null,

  initializeSession: async (userId, profile = prototypeUser) => {
    try {
      const normalizedUserId = validateUserId(userId);
      const response = await fetch(`${API_BASE}/api/session/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: normalizedUserId,
          profile,
        }),
      });

      if (!response.ok) {
        throw new Error(`Session initialization failed with ${response.status}.`);
      }

      const body = (await response.json()) as { context: AgentSessionContext };
      mapContext(set, body.context);
    } catch (error) {
      set({
        connectionStatus: 'error',
        error: error instanceof Error ? error.message : 'Session initialization failed.',
      });
    }
  },

  connectSystem: (userId) => {
    try {
      const normalizedUserId = validateUserId(userId);
      const existingSocket = get().socket;
      existingSocket?.disconnect();

      const socketInstance = io(SOCKET_BASE, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 6,
      });

      set({
        socket: socketInstance,
        connectionStatus: 'connecting',
        error: null,
      });

      socketInstance.on('connect', () => {
        set({ connectionStatus: 'connected', error: null });
        socketInstance.emit('EVENT:SESSION_JOIN', { userId: normalizedUserId });
      });

      socketInstance.on('disconnect', () => {
        set({ connectionStatus: 'idle' });
      });

      socketInstance.on('connect_error', (error) => {
        set({
          connectionStatus: 'error',
          error: error.message,
        });
      });

      socketInstance.on('STATE:SYNC', (context: AgentSessionContext) => {
        mapContext(set, context);
      });

      socketInstance.on('STATE:ERROR', (payload: { message: string }) => {
        set({ error: payload.message, connectionStatus: 'error' });
      });
    } catch (error) {
      set({
        connectionStatus: 'error',
        error: error instanceof Error ? error.message : 'Unable to connect to agent runtime.',
      });
    }
  },

  disconnectSystem: () => {
    get().socket?.disconnect();
    set({ socket: null, connectionStatus: 'idle' });
  },

  emitProctorViolation: (userId, type, source) => {
    try {
      const normalizedUserId = validateUserId(userId);
      if (type !== 'TAB_SWITCH' && type !== 'CLIPBOARD_PASTE') {
        throw new Error('Unsupported proctor violation type.');
      }

      getConnectedSocket(get).emit('EVENT:PROCTOR_ALERT', {
        userId: normalizedUserId,
        type,
        metadata: {
          source,
          pageHidden: typeof document !== 'undefined' ? document.hidden : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        },
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to emit proctor violation.' });
    }
  },

  submitAssessment: (payload) => {
    try {
      const normalizedUserId = validateUserId(payload.userId);
      if (payload.descriptiveAnswer.trim().length < 40) {
        throw new Error('Descriptive answer must contain at least 40 characters.');
      }

      if (payload.claimedSkillIds.length === 0) {
        throw new Error('At least one claimed skill is required.');
      }

      getConnectedSocket(get).emit('EVENT:ASSESSMENT_SUBMIT', {
        ...payload,
        userId: normalizedUserId,
        descriptiveAnswer: payload.descriptiveAnswer.trim(),
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to submit assessment.' });
    }
  },

  completeRoadmapNode: (userId, nodeId) => {
    try {
      const normalizedUserId = validateUserId(userId);
      if (nodeId.trim().length < 3) {
        throw new Error('A valid roadmap node id is required.');
      }

      getConnectedSocket(get).emit('EVENT:LEARNBOT_NODE_COMPLETE', {
        userId: normalizedUserId,
        nodeId,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to complete roadmap node.' });
    }
  },

  submitMockInterview: (payload) => {
    try {
      const normalizedUserId = validateUserId(payload.userId);
      getConnectedSocket(get).emit('EVENT:MOCK_INTERVIEW_SUBMIT', {
        userId: normalizedUserId,
        mockScore: validateScore(payload.mockScore, 'Mock score'),
        interviewScore: validateScore(payload.interviewScore, 'Interview score'),
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to submit performance scores.' });
    }
  },

  triggerFallbackManual: (userId) => {
    try {
      const normalizedUserId = validateUserId(userId);
      getConnectedSocket(get).emit('EVENT:TRIGGER_FALLBACK', { userId: normalizedUserId });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to activate fallback.' });
    }
  },

  resetSession: (userId) => {
    try {
      const normalizedUserId = validateUserId(userId);
      getConnectedSocket(get).emit('EVENT:RESET_SESSION', { userId: normalizedUserId });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to reset session.' });
    }
  },
}));
