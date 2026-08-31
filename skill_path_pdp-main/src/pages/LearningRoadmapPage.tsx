import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  ChatCircleText,
  CheckCircle,
  Clock,
  ListChecks,
  LockKey,
  Notebook,
  PaperPlaneTilt,
  Play,
  ShieldWarning,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import { buildRoadmap } from '../data/roadmap';
import type { AgenticSession, AssessmentAccessGrant, NotebookEntry, RoadmapSubtopic, SkillAssessmentResult } from '../types/assessment';
import type { ProfileSetupResult } from './ProfileSetupPage';

interface LearningRoadmapPageProps {
  profile: ProfileSetupResult;
  access: AssessmentAccessGrant;
  chatSession: AgenticSession | null;
  skillResult: SkillAssessmentResult;
  onBack: () => void;
}

type LessonPhase = 'checkpoint-one' | 'checkpoint-two' | 'completed';
type LessonRole = 'system' | 'bot' | 'candidate';

interface LessonMessage {
  id: string;
  role: LessonRole;
  text: string;
}

const SESSION_SECONDS = 600;
const LESSON_WARNING_LIMIT = 3;

export function LearningRoadmapPage({ profile, access, chatSession, skillResult, onBack }: LearningRoadmapPageProps) {
  const roadmap = useMemo(() => buildRoadmap(chatSession, skillResult), [chatSession, skillResult]);
  const [completedSubtopics, setCompletedSubtopics] = useState<Record<string, boolean>>({});
  const [notebooks, setNotebooks] = useState<NotebookEntry[]>([]);
  const [activeSubtopic, setActiveSubtopic] = useState<RoadmapSubtopic | null>(null);
  const [lessonMessages, setLessonMessages] = useState<LessonMessage[]>([]);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('checkpoint-one');
  const [answer, setAnswer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [warningCount, setWarningCount] = useState(0);
  const [sessionAlert, setSessionAlert] = useState<string | null>(null);

  const totalSubtopics = roadmap.reduce((total, topic) => total + topic.subtopics.length, 0);
  const completedCount = Object.keys(completedSubtopics).length;
  const completion = totalSubtopics ? Math.round((completedCount / totalSubtopics) * 100) : 0;
  const weakestTopic = roadmap[0];
  const active = Boolean(activeSubtopic && lessonPhase !== 'completed');

  const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const addMessage = useCallback((role: LessonRole, text: string) => {
    setLessonMessages((current) => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text }]);
  }, []);

  const resetActiveSession = useCallback((message?: string) => {
    setActiveSubtopic(null);
    setLessonMessages([]);
    setLessonPhase('checkpoint-one');
    setAnswer('');
    setSecondsLeft(SESSION_SECONDS);
    setWarningCount(0);
    setSessionAlert(message ?? null);
  }, []);

  const startSession = (subtopic: RoadmapSubtopic) => {
    setActiveSubtopic(subtopic);
    setLessonPhase('checkpoint-one');
    setAnswer('');
    setSecondsLeft(SESSION_SECONDS);
    setWarningCount(0);
    setSessionAlert(null);
    setLessonMessages([
      {
        id: createId(),
        role: 'system',
        text: `Proctored 10-minute learning session started for ${subtopic.skill}.`,
      },
      {
        id: createId(),
        role: 'bot',
        text: `Lesson focus: ${subtopic.title}\n\n${subtopic.objective}\n\n${subtopic.notes.map((note) => `- ${note}`).join('\n')}`,
      },
      {
        id: createId(),
        role: 'bot',
        text: subtopic.checkPrompt,
      },
    ]);
  };

  const saveNotebook = (subtopic: RoadmapSubtopic) => {
    const completedAt = new Date().toLocaleString();
    setNotebooks((current) => [
      {
        id: createId(),
        subtopicId: subtopic.id,
        skill: subtopic.skill,
        title: subtopic.title,
        completedAt,
        notes: [
          `Objective: ${subtopic.objective}`,
          ...subtopic.notes,
          `Checkpoint: ${subtopic.checkPrompt}`,
          `Correction pattern: ${subtopic.correction}`,
        ],
      },
      ...current.filter((entry) => entry.subtopicId !== subtopic.id),
    ]);
  };

  const answerLooksRight = (subtopic: RoadmapSubtopic, response: string) => {
    const normalized = response.toLowerCase();
    const tokens = [...subtopic.title.split(/\W+/), ...subtopic.objective.split(/\W+/), ...subtopic.notes.join(' ').split(/\W+/)]
      .map((token) => token.toLowerCase())
      .filter((token) => token.length > 5);
    const matches = new Set(tokens.filter((token) => normalized.includes(token))).size;
    return response.trim().split(/\s+/).length >= 12 && matches >= 2;
  };

  const submitLessonAnswer = () => {
    if (!activeSubtopic || lessonPhase === 'completed' || !answer.trim()) return;

    const currentAnswer = answer.trim();
    const passed = answerLooksRight(activeSubtopic, currentAnswer);
    addMessage('candidate', currentAnswer);

    if (lessonPhase === 'checkpoint-one') {
      addMessage(
        'bot',
        passed
          ? `Good. You connected the concept to the right operating behavior. Next check: explain how you would apply ${activeSubtopic.title.toLowerCase()} during a production bug review.`
          : `${activeSubtopic.correction}\n\nNext check: explain how you would apply ${activeSubtopic.title.toLowerCase()} during a production bug review.`,
      );
      setLessonPhase('checkpoint-two');
      setAnswer('');
      return;
    }

    addMessage(
      'bot',
      passed
        ? `Session complete. ${activeSubtopic.title} is marked complete and the notebook has been saved.`
        : `${activeSubtopic.correction}\n\nSession complete. The correction has been saved into the notebook before moving forward.`,
    );
    setCompletedSubtopics((current) => ({ ...current, [activeSubtopic.id]: true }));
    saveNotebook(activeSubtopic);
    setLessonPhase('completed');
    setAnswer('');
  };

  const recordLessonWarning = useCallback(
    (type: string, detail: string) => {
      if (!activeSubtopic || lessonPhase === 'completed') return;

      setWarningCount((current) => {
        const next = current + 1;
        setLessonMessages((messages) => [
          ...messages,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'system',
            text: `${detail} Warning ${next}/${LESSON_WARNING_LIMIT}.`,
          },
        ]);

        if (next >= LESSON_WARNING_LIMIT) {
          window.setTimeout(() => resetActiveSession('Learning session reset after repeated proctoring warnings.'), 0);
        }

        return next;
      });
    },
    [activeSubtopic, lessonPhase, resetActiveSession],
  );

  useEffect(() => {
    if (!activeSubtopic || lessonPhase === 'completed') return undefined;

    const tick = () => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.setTimeout(() => resetActiveSession('Learning session timed out. Progress for that subtopic was reset.'), 0);
          return 0;
        }
        return current - 1;
      });
    };

    const timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [activeSubtopic, lessonPhase, resetActiveSession]);

  useEffect(() => {
    if (!activeSubtopic || lessonPhase === 'completed') return undefined;

    const preventClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      recordLessonWarning(event.type, `${event.type} attempt blocked during learning session.`);
    };
    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      recordLessonWarning('contextmenu', 'Context menu attempt blocked during learning session.');
    };
    const onVisibilityChange = () => {
      if (document.hidden) recordLessonWarning('tab_hidden', 'Tab switch detected during learning session.');
    };
    const onBlur = () => {
      recordLessonWarning('window_blur', 'Assessment window lost focus during learning session.');
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) recordLessonWarning('fullscreen_exit', 'Full-screen exit detected during learning session.');
    };

    document.addEventListener('copy', preventClipboard);
    document.addEventListener('cut', preventClipboard);
    document.addEventListener('paste', preventClipboard);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('copy', preventClipboard);
      document.removeEventListener('cut', preventClipboard);
      document.removeEventListener('paste', preventClipboard);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeSubtopic, lessonPhase, recordLessonWarning]);

  useEffect(() => {
    if (!activeSubtopic || lessonPhase === 'completed') return undefined;

    const cameraTracks = access.cameraStream?.getTracks() ?? [];
    const screenTracks = access.screenStream?.getTracks() ?? [];
    const handlers = [
      ...cameraTracks.map((track) => ({
        track,
        handler: () => recordLessonWarning(track.kind === 'audio' ? 'microphone_track_ended' : 'camera_track_ended', `${track.kind} track ended during learning session.`),
      })),
      ...screenTracks.map((track) => ({
        track,
        handler: () => recordLessonWarning('screen_track_ended', `${track.kind} track ended during learning session.`),
      })),
    ];

    handlers.forEach(({ track, handler }) => track.addEventListener('ended', handler));
    return () => handlers.forEach(({ track, handler }) => track.removeEventListener('ended', handler));
  }, [access.cameraStream, access.screenStream, activeSubtopic, lessonPhase, recordLessonWarning]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-skillpath-night p-4 text-skillpath-cream sm:p-5 lg:p-6">
      <div className="flex min-h-[calc(100vh-32px)] w-full flex-col rounded-lg border border-white/10 bg-skillpath-night shadow-panel sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)]">
        <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <SkillPathLogo />
            <span className="rounded-full bg-skillpath-teal px-3 py-1.5 text-sm font-black text-skillpath-night lg:hidden">Roadmap</span>
          </div>
          <div className="grid gap-2 text-sm font-black text-skillpath-cream sm:grid-cols-3 lg:min-w-[520px]">
            <StatusPill label="Camera" active={access.cameraGranted} />
            <StatusPill label="Mic" active={access.microphoneGranted} />
            <StatusPill label="Screen" active={access.screenGranted && access.fullscreenGranted} />
          </div>
        </header>

        <div className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,430px)] lg:p-8">
          <section className="min-w-0">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-tight text-skillpath-cream sm:text-5xl">Gap Detection and Learning Roadmap</h1>
                <p className="mt-3 max-w-4xl text-base font-medium leading-7 text-skillpath-cream/70">
                  SkillPath combines the chatbot signal with the deterministic assessment result to rank weak points and build 10-minute recovery sessions.
                </p>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/8 px-4 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal"
                type="button"
                onClick={() => {
                  if (active) resetActiveSession();
                  onBack();
                }}
              >
                <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                Back
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Metric icon={<Brain className="h-5 w-5" weight="bold" />} label="Weakest" value={weakestTopic?.skill ?? 'None'} />
              <Metric icon={<ListChecks className="h-5 w-5" weight="bold" />} label="Topics" value={String(roadmap.length)} />
              <Metric icon={<Clock className="h-5 w-5" weight="bold" />} label="Subtopics" value={String(totalSubtopics)} />
              <Metric icon={<Notebook className="h-5 w-5" weight="bold" />} label="Notebooks" value={String(notebooks.length)} />
            </div>

            <section className="mt-5 rounded-lg border border-white/10 bg-white/8 shadow-panel">
              <div className="border-b border-white/10 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black">Roadmap progress</h2>
                    <p className="mt-1 text-sm font-bold text-skillpath-cream/64">{completedCount}/{totalSubtopics} subtopics completed</p>
                  </div>
                  <span className="rounded-md bg-skillpath-teal px-3 py-2 text-sm font-black text-skillpath-night">{completion}%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/14">
                  <div className="h-full rounded-full bg-skillpath-teal transition-all" style={{ width: `${completion}%` }} />
                </div>
              </div>

              {activeSubtopic ? (
                <LessonSession
                  subtopic={activeSubtopic}
                  phase={lessonPhase}
                  messages={lessonMessages}
                  answer={answer}
                  secondsLeft={secondsLeft}
                  warningCount={warningCount}
                  onAnswerChange={setAnswer}
                  onSubmit={submitLessonAnswer}
                  onExit={() => resetActiveSession('Learning session exited. Progress for that subtopic was reset.')}
                  onCloseCompleted={() => resetActiveSession()}
                />
              ) : (
                <div className="space-y-4 p-4 sm:p-5">
                  {sessionAlert ? (
                    <div className="flex gap-3 rounded-md border border-skillpath-danger bg-white p-4 text-sm font-bold text-skillpath-danger">
                      <WarningCircle className="mt-0.5 h-5 w-5 flex-none" weight="bold" aria-hidden="true" />
                      {sessionAlert}
                    </div>
                  ) : null}

                  {roadmap.map((topic) => (
                    <article key={topic.id} className="rounded-lg border border-white/10 bg-skillpath-night p-4 text-skillpath-cream shadow-soft">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-skillpath-teal px-2.5 py-1.5 text-xs font-black text-skillpath-night">{topic.priority}</span>
                            <span className="rounded-md border border-white/14 bg-white/8 px-2.5 py-1.5 text-xs font-black">{topic.source}</span>
                          </div>
                          <h2 className="mt-3 text-2xl font-black">{topic.title}</h2>
                          <p className="mt-2 text-sm font-bold leading-6 text-skillpath-cream/68">{topic.reason}</p>
                        </div>
                        <div className="rounded-md bg-white/8 px-4 py-3 text-center">
                          <p className="text-xs font-black uppercase text-skillpath-cream/58">Readiness</p>
                          <p className="text-2xl font-black">{topic.score}%</p>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        {topic.subtopics.map((subtopic) => {
                          const done = Boolean(completedSubtopics[subtopic.id]);
                          return (
                            <div key={subtopic.id} className={`rounded-md border p-4 ${done ? 'border-skillpath-teal bg-skillpath-teal text-skillpath-night' : 'border-white/12 bg-white/8 text-skillpath-cream'}`}>
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-base font-black">{subtopic.title}</h3>
                                  <p className={`mt-1 text-sm font-bold leading-5 ${done ? 'text-skillpath-night/72' : 'text-skillpath-cream/64'}`}>{subtopic.objective}</p>
                                </div>
                                {done ? <CheckCircle className="h-6 w-6 flex-none" weight="fill" aria-hidden="true" /> : <BookOpen className="h-6 w-6 flex-none text-skillpath-teal" weight="bold" aria-hidden="true" />}
                              </div>
                              <button
                                className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-black transition ${
                                  done ? 'bg-skillpath-night text-skillpath-cream' : 'bg-skillpath-teal text-skillpath-night hover:bg-skillpath-cream'
                                }`}
                                type="button"
                                onClick={() => (done ? undefined : startSession(subtopic))}
                                disabled={done}
                              >
                                {done ? 'Notebook saved' : 'Start 10-min session'}
                                {done ? <Notebook className="h-4 w-4" weight="bold" aria-hidden="true" /> : <Play className="h-4 w-4" weight="bold" aria-hidden="true" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

          <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-lg border border-skillpath-teal/40 bg-skillpath-cream p-5 text-skillpath-night shadow-panel">
              <h2 className="text-2xl font-black">Gap summary</h2>
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label="Candidate" value={profile.name} />
                <SummaryRow label="OA score" value={`${skillResult.score}% (${skillResult.level.replace('_', ' ')})`} />
                <SummaryRow label="Chatbot score" value={chatSession?.aggregate ? `${chatSession.aggregate.score}% (${chatSession.aggregate.level.replace('_', ' ')})` : 'Skipped or pending'} />
                <SummaryRow label="Roadmap load" value={`${roadmap.length} topics, ${totalSubtopics} subtopics`} />
              </div>

              <div className="mt-5 rounded-lg bg-skillpath-night p-4 text-skillpath-cream">
                <div className="mb-3 flex items-center gap-2">
                  <LockKey className="h-5 w-5 text-skillpath-teal" weight="bold" aria-hidden="true" />
                  <p className="text-sm font-black">Session proctoring</p>
                </div>
                <div className="grid gap-2 text-xs font-black">
                  <StatusRow label="Camera" done={access.cameraGranted} />
                  <StatusRow label="Microphone" done={access.microphoneGranted} />
                  <StatusRow label="Screen + full-screen" done={access.screenGranted && access.fullscreenGranted} />
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-skillpath-night p-4 text-skillpath-cream">
                <div className="mb-3 flex items-center gap-2">
                  <Notebook className="h-5 w-5 text-skillpath-teal" weight="bold" aria-hidden="true" />
                  <p className="text-sm font-black">Notebooks</p>
                </div>
                <div className="space-y-3">
                  {notebooks.length ? (
                    notebooks.map((entry) => (
                      <article key={entry.id} className="rounded-md bg-white/8 p-3">
                        <p className="text-sm font-black">{entry.title}</p>
                        <p className="mt-1 text-xs font-bold text-skillpath-cream/58">{entry.skill} · {entry.completedAt}</p>
                        <ul className="mt-2 space-y-1 text-xs font-bold leading-5 text-skillpath-cream/78">
                          {entry.notes.slice(0, 3).map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-md bg-white/8 p-3 text-sm font-bold text-skillpath-cream/70">Completed sessions appear here.</p>
                  )}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function LessonSession({
  subtopic,
  phase,
  messages,
  answer,
  secondsLeft,
  warningCount,
  onAnswerChange,
  onSubmit,
  onExit,
  onCloseCompleted,
}: {
  subtopic: RoadmapSubtopic;
  phase: LessonPhase;
  messages: LessonMessage[];
  answer: string;
  secondsLeft: number;
  warningCount: number;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  onExit: () => void;
  onCloseCompleted: () => void;
}) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric icon={<ChatCircleText className="h-5 w-5" weight="bold" />} label="Session" value={subtopic.skill} />
        <Metric icon={<Clock className="h-5 w-5" weight="bold" />} label="Time left" value={phase === 'completed' ? 'Saved' : formatTime(secondsLeft)} danger={phase !== 'completed' && secondsLeft <= 120} />
        <Metric icon={<ShieldWarning className="h-5 w-5" weight="bold" />} label="Warnings" value={`${warningCount}/${LESSON_WARNING_LIMIT}`} danger={warningCount > 0} />
      </div>

      <section className="rounded-lg border border-white/10 bg-skillpath-night shadow-soft">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black">{subtopic.title}</h2>
            <p className="mt-1 text-sm font-bold text-skillpath-cream/64">10-minute proctored learning session</p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/8 px-3 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal"
            type="button"
            onClick={phase === 'completed' ? onCloseCompleted : onExit}
          >
            {phase === 'completed' ? 'Close session' : 'Exit and reset'}
            <X className="h-4 w-4" weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[440px] space-y-4 overflow-y-auto p-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[760px] rounded-lg p-4 ${
                  message.role === 'candidate'
                    ? 'bg-skillpath-teal text-skillpath-night'
                    : message.role === 'system'
                      ? 'border border-white/10 bg-white/8 text-skillpath-cream'
                      : 'bg-skillpath-cream text-skillpath-night'
                }`}
              >
                <p className="mb-2 text-xs font-black uppercase">{message.role === 'bot' ? 'LearnBot' : message.role}</p>
                <p className="whitespace-pre-wrap text-sm font-bold leading-6">{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        {phase !== 'completed' ? (
          <div className="border-t border-white/10 p-4">
            <textarea
              className="min-h-[112px] w-full resize-none rounded-md border border-white/12 bg-skillpath-cream px-4 py-3 text-base font-bold leading-6 text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-teal"
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              placeholder="Type your explanation"
            />
            <button
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-teal px-4 text-base font-black text-skillpath-night transition hover:bg-skillpath-cream disabled:cursor-not-allowed disabled:bg-skillpath-muted"
              type="button"
              onClick={onSubmit}
              disabled={answer.trim().length === 0}
            >
              Submit checkpoint
              <PaperPlaneTilt className="h-5 w-5" weight="bold" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="border-t border-white/10 p-4">
            <div className="rounded-md bg-skillpath-teal p-4 text-sm font-black text-skillpath-night">
              Notebook saved for this subtopic.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`rounded-md px-3 py-2 text-center ${active ? 'bg-skillpath-teal text-skillpath-night' : 'bg-white/8 text-skillpath-cream'}`}>
      {label}
    </span>
  );
}

function Metric({ icon, label, value, danger = false }: { icon: ReactNode; label: string; value: string; danger?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-md p-3 ${danger ? 'bg-skillpath-danger text-white' : 'bg-skillpath-night text-skillpath-cream'}`}>
      <div className={`grid h-9 w-9 place-items-center rounded-md ${danger ? 'bg-white text-skillpath-danger' : 'bg-skillpath-teal text-skillpath-night'}`}>{icon}</div>
      <div>
        <p className={`text-xs font-black ${danger ? 'text-white/78' : 'text-skillpath-cream/60'}`}>{label}</p>
        <p className="text-base font-black">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-skillpath-line bg-white p-3">
      <p className="font-black text-skillpath-muted">{label}</p>
      <p className="mt-1 font-black text-skillpath-night">{value}</p>
    </div>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white/8 px-3 py-2">
      <span>{label}</span>
      <span className={done ? 'text-skillpath-teal' : 'text-skillpath-cream/54'}>{done ? 'Active' : 'Missing'}</span>
    </div>
  );
}
