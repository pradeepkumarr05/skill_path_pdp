import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { prototypeSkills, prototypeUser } from './src/data/prototypeData';
import type {
  AgentEventLog,
  AgentName,
  AgentSessionContext,
  AssessmentSubmitPayload,
  EventLogLevel,
  MockInterviewSubmitPayload,
  NodeCompletePayload,
  PerformanceSummary,
  ProctorAlertPayload,
  RoadmapNode,
  SessionInitPayload,
  SessionUserPayload,
  SkillProfile,
  UserProfile,
} from './src/types/agent';

const PORT = Number(process.env.PORT ?? 3001);
const READINESS_BASELINE = 78;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  },
});

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

const activeSessions: Record<string, AgentSessionContext> = {};

const createId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

const skillLookup = new Map(prototypeSkills.map((skill) => [skill.id, skill]));

function assertUserId(payload: SessionUserPayload): string {
  if (!payload || typeof payload.userId !== 'string' || payload.userId.trim().length < 3) {
    throw new Error('A valid userId is required.');
  }

  return payload.userId.trim();
}

function logState(session: AgentSessionContext, message: string, level: EventLogLevel = 'INFO'): AgentEventLog {
  const entry: AgentEventLog = {
    id: createId('log'),
    timestamp: Date.now(),
    level,
    message,
    activeAgent: session.activeAgent,
  };

  session.eventLog = [entry, ...session.eventLog].slice(0, 80);
  session.updatedAt = Date.now();
  console.log(`[${new Date(entry.timestamp).toISOString()}] [${level}] [${session.userId}] ${session.activeAgent}: ${message}`);
  return entry;
}

function createInitialSession(userId: string, profile: UserProfile = prototypeUser): AgentSessionContext {
  const selectedSkillIds = profile.selectedSkillIds.length > 0 ? profile.selectedSkillIds : prototypeUser.selectedSkillIds;
  const normalizedProfile: UserProfile = {
    ...profile,
    selectedSkillIds,
  };

  const context: AgentSessionContext = {
    userId,
    user: normalizedProfile,
    activeAgent: 'ASSESSMENT',
    violations: [],
    skills: {},
    roadmap: [],
    notebook: [],
    isFallbackActive: false,
    eventLog: [],
    updatedAt: Date.now(),
  };

  logState(context, 'Session initialized and Assessment Agent activated.', 'SUCCESS');
  return context;
}

function ensureSession(userId: string): AgentSessionContext {
  if (!activeSessions[userId]) {
    activeSessions[userId] = createInitialSession(userId);
  }

  return activeSessions[userId];
}

function emitSync(socket: Socket, session: AgentSessionContext): void {
  socket.emit('STATE:SYNC', session);
}

function transitionAgent(session: AgentSessionContext, activeAgent: AgentName, message: string, level: EventLogLevel = 'INFO'): void {
  session.activeAgent = activeAgent;
  logState(session, message, level);
}

function calculateSkillProfiles(session: AgentSessionContext, payload: AssessmentSubmitPayload): Record<string, SkillProfile> {
  const descriptiveStrength = Math.min(2, Math.floor(payload.descriptiveAnswer.trim().length / 180));
  const answeredMcqs = Object.values(payload.mcqAnswers).filter(Boolean).length;
  const violationPenalty = Math.min(2, session.violations.length);

  return payload.claimedSkillIds.reduce<Record<string, SkillProfile>>((profiles, skillId, index) => {
    const sourceSkill = skillLookup.get(skillId) ?? prototypeSkills[index % prototypeSkills.length];
    const claimed = sourceSkill.claimed;
    const measured = Math.max(1, Math.min(5, 2 + descriptiveStrength + Math.floor(answeredMcqs / 2) - violationPenalty + (index === 1 ? 1 : 0)));
    const delta = measured - claimed;

    profiles[skillId] = {
      skillId,
      name: sourceSkill.name,
      claimed,
      measured,
      delta,
      isReady: measured >= sourceSkill.industryTarget && delta >= -1,
    };

    return profiles;
  }, {});
}

function buildRoadmap(skills: Record<string, SkillProfile>): RoadmapNode[] {
  const profiles = Object.values(skills);
  const weakProfiles = profiles.filter((skill) => !skill.isReady || skill.delta < 0);
  const targetProfiles = weakProfiles.length > 0 ? weakProfiles : profiles;

  return targetProfiles.flatMap((skill, skillIndex) => {
    const baseStatus = skillIndex === 0 ? 'AVAILABLE' : 'LOCKED';

    return [
      {
        id: `${skill.skillId}-node-01`,
        skillId: skill.skillId,
        topic: `${skill.name}: Concept Repair`,
        duration: 10,
        status: baseStatus,
        subtopics: ['Industry baseline', 'Common misconception', 'Worked example'],
        remediationInstructions: `Rebuild the concept foundation for ${skill.name} before moving to applied practice.`,
      },
      {
        id: `${skill.skillId}-node-02`,
        skillId: skill.skillId,
        topic: `${skill.name}: Applied Practice`,
        duration: 10,
        status: 'LOCKED',
        subtopics: ['Scenario prompt', 'Implementation tradeoff', 'Checkpoint quiz'],
        remediationInstructions: `Use targeted practice to close the measured delta for ${skill.name}.`,
      },
    ];
  });
}

function completeRoadmapNode(session: AgentSessionContext, nodeId: string): void {
  const nodeIndex = session.roadmap.findIndex((node) => node.id === nodeId);

  if (nodeIndex < 0) {
    throw new Error(`Unknown roadmap node: ${nodeId}`);
  }

  const node = session.roadmap[nodeIndex];
  if (node.status === 'LOCKED') {
    throw new Error('Locked roadmap nodes cannot be completed.');
  }

  session.roadmap = session.roadmap.map((currentNode, index) => {
    if (index === nodeIndex) {
      return { ...currentNode, status: 'COMPLETED' };
    }

    if (index === nodeIndex + 1 && currentNode.status === 'LOCKED') {
      return { ...currentNode, status: 'AVAILABLE' };
    }

    return currentNode;
  });

  session.notebook = [
    {
      id: createId('note'),
      nodeId: node.id,
      title: node.topic,
      markdown: `## ${node.topic}\n\n- Completed a ${node.duration}-minute guided LearnBot session.\n- Reviewed: ${node.subtopics.join(', ')}.\n- Next action: apply the concept in the mock assessment loop.`,
      createdAt: Date.now(),
    },
    ...session.notebook,
  ];

  const allDone = session.roadmap.length > 0 && session.roadmap.every((currentNode) => currentNode.status === 'COMPLETED');
  transitionAgent(session, allDone ? 'INTERVIEWER' : 'LEARNBOT', allDone ? 'Roadmap complete. Interviewer Agent unlocked.' : `LearnBot completed node ${node.topic}.`, 'SUCCESS');
}

function summarizePerformance(session: AgentSessionContext, mockScore: number, interviewScore: number): PerformanceSummary {
  const aggregateScore = Math.round((mockScore * 0.45 + interviewScore * 0.45 + Math.max(0, 100 - session.violations.length * 6) * 0.1));
  const skillProfiles = Object.values(session.skills);
  const weakAreas = skillProfiles.filter((skill) => !skill.isReady || skill.delta < 0).map((skill) => skill.name);
  const strengths = skillProfiles.filter((skill) => skill.isReady).map((skill) => skill.name);
  const readinessScore = Math.max(0, Math.min(100, aggregateScore - weakAreas.length * 4));
  const certificateAvailable = readinessScore >= READINESS_BASELINE && weakAreas.length === 0;

  return {
    mockScore,
    interviewScore,
    aggregateScore,
    readinessScore,
    strengths: strengths.length > 0 ? strengths : ['Assessment completion discipline'],
    weakAreas: weakAreas.length > 0 ? weakAreas : ['No critical weak areas detected'],
    finalAdvice: certificateAvailable
      ? 'Industry-ready baseline cleared. Generate completion certificate.'
      : 'Baseline not cleared. Continue remediation and retake mock/interview loops.',
    certificateAvailable,
  };
}

function activateFallback(session: AgentSessionContext, reason: string): void {
  session.isFallbackActive = true;
  session.roadmap = session.roadmap.map((node) => ({
    ...node,
    status: node.status === 'COMPLETED' ? 'COMPLETED' : 'REMEDIATION',
  }));
  transitionAgent(session, 'FALLBACK', reason, 'WARN');
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'skillpath-agent-runtime' });
});

app.post('/api/session/init', (req: Request<unknown, unknown, SessionInitPayload>, res: Response) => {
  try {
    const userId = assertUserId(req.body);
    activeSessions[userId] = createInitialSession(userId, req.body.profile);
    res.status(200).json({ status: 'SUCCESS', context: activeSessions[userId] });
  } catch (error) {
    res.status(400).json({ status: 'ERROR', message: error instanceof Error ? error.message : 'Session initialization failed.' });
  }
});

io.on('connection', (socket) => {
  console.log(`Agent socket connected: ${socket.id}`);

  socket.on('EVENT:SESSION_JOIN', (payload: SessionUserPayload) => {
    try {
      const userId = assertUserId(payload);
      const session = ensureSession(userId);
      logState(session, `Socket ${socket.id} joined session.`, 'INFO');
      emitSync(socket, session);
    } catch (error) {
      socket.emit('STATE:ERROR', { message: error instanceof Error ? error.message : 'Unable to join session.' });
    }
  });

  socket.on('EVENT:PROCTOR_ALERT', (payload: ProctorAlertPayload) => {
    try {
      const userId = assertUserId(payload);
      if (payload.type !== 'TAB_SWITCH' && payload.type !== 'CLIPBOARD_PASTE') {
        throw new Error('Unsupported proctor violation type.');
      }

      const session = ensureSession(userId);
      session.violations = [
        {
          id: createId('violation'),
          type: payload.type,
          timestamp: Date.now(),
          metadata: payload.metadata,
        },
        ...session.violations,
      ];
      logState(session, `Assessment Agent recorded ${payload.type}.`, 'WARN');
      emitSync(socket, session);
    } catch (error) {
      socket.emit('STATE:ERROR', { message: error instanceof Error ? error.message : 'Unable to record proctor alert.' });
    }
  });

  socket.on('EVENT:ASSESSMENT_SUBMIT', (payload: AssessmentSubmitPayload) => {
    try {
      const userId = assertUserId(payload);
      if (payload.descriptiveAnswer.trim().length < 40) {
        throw new Error('Descriptive answer must contain at least 40 characters.');
      }

      const session = ensureSession(userId);
      session.assessment = {
        descriptiveAnswer: payload.descriptiveAnswer.trim(),
        mcqAnswers: payload.mcqAnswers,
        claimedSkillIds: payload.claimedSkillIds,
        submittedAt: Date.now(),
      };

      transitionAgent(session, 'REASONING', 'Assessment submitted. Reasoning Agent calculating deltas.');
      emitSync(socket, session);

      setTimeout(() => {
        session.skills = calculateSkillProfiles(session, payload);
        session.roadmap = buildRoadmap(session.skills);
        transitionAgent(session, 'LEARNBOT', 'Reasoning complete. Learning roadmap generated.', 'SUCCESS');
        emitSync(socket, session);
      }, 900);
    } catch (error) {
      socket.emit('STATE:ERROR', { message: error instanceof Error ? error.message : 'Unable to submit assessment.' });
    }
  });

  socket.on('EVENT:LEARNBOT_NODE_COMPLETE', (payload: NodeCompletePayload) => {
    try {
      const userId = assertUserId(payload);
      const session = ensureSession(userId);
      completeRoadmapNode(session, payload.nodeId);
      emitSync(socket, session);
    } catch (error) {
      socket.emit('STATE:ERROR', { message: error instanceof Error ? error.message : 'Unable to complete roadmap node.' });
    }
  });

  socket.on('EVENT:MOCK_INTERVIEW_SUBMIT', (payload: MockInterviewSubmitPayload) => {
    try {
      const userId = assertUserId(payload);
      const session = ensureSession(userId);
      const mockScore = Math.max(0, Math.min(100, Number(payload.mockScore)));
      const interviewScore = Math.max(0, Math.min(100, Number(payload.interviewScore)));

      session.performance = summarizePerformance(session, mockScore, interviewScore);
      if (!session.performance.certificateAvailable) {
        activateFallback(session, 'Readiness baseline failed. Fallback remediation loop activated.');
      } else {
        transitionAgent(session, 'FINAL_REVIEW', 'Readiness baseline cleared. Final review available.', 'SUCCESS');
      }

      emitSync(socket, session);
    } catch (error) {
      socket.emit('STATE:ERROR', { message: error instanceof Error ? error.message : 'Unable to submit mock and interview scores.' });
    }
  });

  socket.on('EVENT:TRIGGER_FALLBACK', (payload: SessionUserPayload) => {
    try {
      const userId = assertUserId(payload);
      const session = ensureSession(userId);
      activateFallback(session, 'Manual fallback trigger received from operator.');
      emitSync(socket, session);
    } catch (error) {
      socket.emit('STATE:ERROR', { message: error instanceof Error ? error.message : 'Unable to activate fallback.' });
    }
  });

  socket.on('EVENT:RESET_SESSION', (payload: SessionUserPayload) => {
    try {
      const userId = assertUserId(payload);
      activeSessions[userId] = createInitialSession(userId);
      emitSync(socket, activeSessions[userId]);
    } catch (error) {
      socket.emit('STATE:ERROR', { message: error instanceof Error ? error.message : 'Unable to reset session.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Agent socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Agent Core Server operating on port ${PORT}`);
});
