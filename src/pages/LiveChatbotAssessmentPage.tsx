import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowsOut,
  CameraSlash,
  CheckCircle,
  CircleNotch,
  Clock,
  LockKey,
  PaperPlaneTilt,
  ShieldWarning,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import { recordProctorEvent, startAgentSession, submitAgentAnswer } from '../api/skillpathApi';
import type { AssessmentAccessGrant, AgenticSession, SkillState } from '../types/assessment';
import type { ProfileSetupResult } from './ProfileSetupPage';

interface LiveChatbotAssessmentPageProps {
  profile: ProfileSetupResult;
  access: AssessmentAccessGrant;
  onBack: () => void;
  onComplete: (session: AgenticSession) => void;
}

export function LiveChatbotAssessmentPage({ profile, access, onBack, onComplete }: LiveChatbotAssessmentPageProps) {
  const [session, setSession] = useState<AgenticSession | null>(null);
  const [answer, setAnswer] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const submittedQuestionRef = useRef<string | null>(null);
  const proctorPendingRef = useRef(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  const activeQuestion = session?.currentQuestion ?? null;
  const canSubmit = Boolean(session?.sessionId && session.status === 'active' && activeQuestion && answer.trim().length > 0 && !submitting);

  const currentSkill = useMemo(() => {
    if (!activeQuestion) return null;
    return session?.skillStates.find((skill) => skill.skill === activeQuestion.skill) ?? null;
  }, [activeQuestion, session?.skillStates]);

  const latestFeedback = useMemo(() => {
    if (!session) return null;
    for (let i = session.transcript.length - 1; i >= 0; i -= 1) {
      const entry = session.transcript[i];
      if (entry.role === 'agent' && entry.meta?.type === 'evaluation') return entry;
    }
    return null;
  }, [session]);

  const skillIndex = useMemo(() => {
    if (!session || !activeQuestion) return -1;
    return session.skillStates.findIndex((skill) => skill.skill === activeQuestion.skill);
  }, [session, activeQuestion]);

  // ── Live camera preview: proves the camera stream is genuinely active ──
  useEffect(() => {
    if (cameraVideoRef.current && access.cameraStream) {
      cameraVideoRef.current.srcObject = access.cameraStream;
    }
  }, [access.cameraStream, session?.status]);

  // ── Best-effort fullscreen re-entry on mount if it was lost in transit ──
  useEffect(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootSession() {
      setLoading(true);
      setError(null);

      try {
        const nextSession = await startAgentSession(profile);
        if (cancelled) return;

        if (nextSession.status === 'skipped') {
          onComplete(nextSession);
          return;
        }

        setSession(nextSession);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to start the assessment session. Retrying may help.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootSession();

    return () => {
      cancelled = true;
    };
  }, [onComplete, profile]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [session?.transcript.length]);

  useEffect(() => {
    submittedQuestionRef.current = null;
    setAnswer('');
  }, [activeQuestion?.id]);

  const reportProctorEvent = useCallback(
    async (type: string, detail = '') => {
      if (!session?.sessionId || session.status !== 'active' || proctorPendingRef.current) return;

      proctorPendingRef.current = true;
      try {
        const nextSession = await recordProctorEvent(session.sessionId, type, detail);
        setSession(nextSession);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to record proctoring event.');
      } finally {
        proctorPendingRef.current = false;
      }
    },
    [session?.sessionId, session?.status],
  );

  const submitCurrentAnswer = useCallback(
    async (timedOut = false) => {
      if (!session?.sessionId || session.status !== 'active' || !activeQuestion || submitting) return;
      if (submittedQuestionRef.current === activeQuestion.id) return;

      submittedQuestionRef.current = activeQuestion.id;
      setSubmitting(true);
      setError(null);

      try {
        const nextSession = await submitAgentAnswer(session.sessionId, activeQuestion.id, timedOut ? '' : answer.trim(), timedOut);
        setSession(nextSession);
        setAnswer('');
      } catch (nextError) {
        submittedQuestionRef.current = null;
        setError(nextError instanceof Error ? nextError.message : 'Unable to submit the answer. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [activeQuestion, answer, session?.sessionId, session?.status, submitting],
  );

  useEffect(() => {
    if (!activeQuestion || session?.status !== 'active') return undefined;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(activeQuestion.dueAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        void submitCurrentAnswer(true);
      }
    };

    tick();
    const timerId = window.setInterval(tick, 250);
    return () => window.clearInterval(timerId);
  }, [activeQuestion, session?.status, submitCurrentAnswer]);

  useEffect(() => {
    if (!session?.sessionId || session.status !== 'active') return undefined;

    const preventClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportProctorEvent(event.type, `${event.type} attempt was blocked.`);
    };
    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void reportProctorEvent('contextmenu', 'Context menu attempt was blocked.');
    };
    const onVisibilityChange = () => {
      if (document.hidden) void reportProctorEvent('tab_hidden', 'Browser tab became hidden.');
    };
    const onBlur = () => {
      void reportProctorEvent('window_blur', 'Assessment window lost focus.');
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) void reportProctorEvent('fullscreen_exit', 'Candidate exited full-screen mode.');
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
  }, [reportProctorEvent, session?.sessionId, session?.status]);

  useEffect(() => {
    if (!session?.sessionId || session.status !== 'active') return undefined;

    const cameraTracks = access.cameraStream?.getTracks() ?? [];
    const screenTracks = access.screenStream?.getTracks() ?? [];

    const trackHandlers = [
      ...cameraTracks.map((track) => ({
        track,
        handler: () => void reportProctorEvent(track.kind === 'audio' ? 'microphone_track_ended' : 'camera_track_ended', `${track.kind} track ended.`),
      })),
      ...screenTracks.map((track) => ({
        track,
        handler: () => void reportProctorEvent('screen_track_ended', `${track.kind} track ended.`),
      })),
    ];

    trackHandlers.forEach(({ track, handler }) => track.addEventListener('ended', handler));
    return () => trackHandlers.forEach(({ track, handler }) => track.removeEventListener('ended', handler));
  }, [access.cameraStream, access.screenStream, reportProctorEvent, session?.sessionId, session?.status]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      void submitCurrentAnswer(false);
    }
  };

  const timerPct = activeQuestion ? Math.max(0, Math.min(100, (secondsLeft / activeQuestion.secondsAllowed) * 100)) : 100;
  const timerUrgency = secondsLeft <= 10 ? 'danger' : secondsLeft <= 20 ? 'warn' : 'ok';

  return (
    <main className="min-h-screen bg-skillpath-night text-skillpath-cream select-none">
      {/* Non-blocking fullscreen nudge — the real enforcement happens server-side via proctor events */}
      {!isFullscreen && session?.status === 'active' && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-skillpath-danger px-4 py-2 text-sm font-black text-white">
          <ArrowsOut className="h-4 w-4" weight="bold" aria-hidden="true" />
          You are not in full-screen mode. Re-enter full-screen immediately to avoid termination.
          <button
            type="button"
            className="ml-2 rounded-md bg-white/20 px-3 py-1 text-xs font-black hover:bg-white/30"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
          >
            Re-enter full screen
          </button>
        </div>
      )}

      <header className="border-b border-white/10 bg-skillpath-night/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <SkillPathLogo />
            <span className="hidden rounded-full border border-skillpath-teal/40 bg-skillpath-teal/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-skillpath-teal sm:inline-flex">
              Proctored session
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-black sm:grid-cols-4 lg:min-w-[560px]">
            <ProctorChip label="Camera" active={access.cameraGranted} />
            <ProctorChip label="Microphone" active={access.microphoneGranted} />
            <ProctorChip label="Screen share" active={access.screenGranted} />
            <ProctorChip label="Full screen" active={isFullscreen} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black leading-tight text-skillpath-cream sm:text-4xl">Live Chatbot Assessment</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-skillpath-cream/65">
              An AI examiner asks adaptive medium-to-hard questions across your claimed skills and grades each answer before advancing.
            </p>
          </div>
          <button
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md border border-white/14 bg-white/8 px-4 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onBack}
            disabled={session?.status === 'active'}
          >
            <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
            Back
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_320px] lg:items-start">
          {/* ── Left rail: skill progress stepper ── */}
          <aside className="order-2 lg:order-1 lg:sticky lg:top-24">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="mb-4 text-xs font-black uppercase tracking-wide text-skillpath-cream/50">Skill progress</h2>
              <ol className="space-y-1">
                {(session?.skillStates ?? profile.claimedSkills.map((skill) => ({ skill, status: 'pending' } as SkillState))).map((skill, index) => (
                  <SkillStep key={skill.skill} skill={skill} isCurrent={index === skillIndex} />
                ))}
              </ol>
            </section>
          </aside>

          {/* ── Center: question + answer panel ── */}
          <section className="order-1 min-w-0 lg:order-2">
            <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-skillpath-cream/55">
                  <Sparkle className="h-4 w-4 text-skillpath-teal" weight="fill" aria-hidden="true" />
                  {session?.model ?? 'AI examiner'}
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-skillpath-cream/55">
                  <ShieldWarning className="h-4 w-4" weight="bold" aria-hidden="true" />
                  Warnings {session?.warningCount ?? 0}/{session?.warningLimit ?? 3}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5" ref={transcriptRef}>
                {loading ? (
                  <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-skillpath-cream/60">
                    <CircleNotch className="h-8 w-8 animate-spin text-skillpath-teal" weight="bold" aria-hidden="true" />
                    <p className="text-sm font-bold">Preparing your first question…</p>
                  </div>
                ) : null}

                {error ? (
                  <div className="mb-4 flex gap-3 rounded-md border border-skillpath-danger bg-white p-4 text-sm font-bold text-skillpath-danger">
                    <WarningCircle className="mt-0.5 h-5 w-5 flex-none" weight="bold" aria-hidden="true" />
                    {error}
                  </div>
                ) : null}

                {activeQuestion && !loading ? (
                  <div className="animate-fade-in">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Badge>{activeQuestion.skill}</Badge>
                      <Badge tone={activeQuestion.difficulty === 'hard' ? 'accent' : 'default'}>
                        {activeQuestion.difficulty === 'hard' ? 'Hard' : 'Medium'} difficulty
                      </Badge>
                      <Badge>Question {activeQuestion.sequence}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-lg font-bold leading-8 text-skillpath-cream">{activeQuestion.text}</p>
                  </div>
                ) : null}

                {!activeQuestion && !loading && session?.status === 'active' ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-skillpath-cream/60">
                    <CircleNotch className="h-8 w-8 animate-spin text-skillpath-teal" weight="bold" aria-hidden="true" />
                    <p className="text-sm font-bold">Preparing the next question…</p>
                  </div>
                ) : null}

                {latestFeedback && session?.status !== 'completed' ? (
                  <FeedbackCard
                    score={typeof latestFeedback.meta?.score === 'number' ? (latestFeedback.meta.score as number) : null}
                    level={typeof latestFeedback.meta?.level === 'string' ? (latestFeedback.meta.level as string) : null}
                    text={latestFeedback.text}
                    strengths={(latestFeedback.meta?.strengths as string[] | undefined) ?? []}
                    gaps={(latestFeedback.meta?.gaps as string[] | undefined) ?? []}
                  />
                ) : null}

                {session?.status === 'completed' ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
                    <CheckCircle className="h-14 w-14 text-skillpath-teal" weight="fill" aria-hidden="true" />
                    <h3 className="text-2xl font-black text-skillpath-cream">Chatbot assessment complete</h3>
                    <p className="max-w-sm text-sm font-medium text-skillpath-cream/65">
                      Overall readiness level:{' '}
                      <span className="font-black text-skillpath-teal">{session.aggregate?.level?.replace('_', ' ') ?? '—'}</span>
                    </p>
                  </div>
                ) : null}
              </div>

              {session?.status === 'active' && activeQuestion ? (
                <form className="border-t border-white/10 bg-white/[0.03] p-4 sm:p-5" onSubmit={handleSubmit}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wide text-skillpath-cream/50">Your answer</span>
                    <TimerReadout secondsLeft={secondsLeft} pct={timerPct} urgency={timerUrgency} />
                  </div>
                  <textarea
                    className="min-h-[140px] w-full resize-none rounded-md border border-white/12 bg-skillpath-cream px-4 py-3 font-mono text-sm leading-6 text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-teal disabled:cursor-not-allowed disabled:opacity-70"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your answer here — be specific and concise."
                    disabled={submitting}
                    autoFocus
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-skillpath-cream/45">
                      {currentSkill ? `${currentSkill.mediumAttempts} medium attempt(s) recorded` : 'Adaptive round'}
                    </p>
                    <button
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-skillpath-teal px-6 text-sm font-black text-skillpath-night transition hover:bg-skillpath-cream disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                      type="submit"
                      disabled={!canSubmit}
                    >
                      {submitting ? 'Grading…' : 'Submit answer'}
                      <PaperPlaneTilt className="h-5 w-5" weight="bold" aria-hidden="true" />
                    </button>
                  </div>
                </form>
              ) : null}

              {session?.status === 'completed' ? (
                <div className="border-t border-white/10 p-4 sm:p-5">
                  <button
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-teal px-4 text-base font-black text-skillpath-night transition hover:bg-skillpath-cream"
                    type="button"
                    onClick={() => onComplete(session)}
                  >
                    Continue to skill assessment
                    <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </section>
          </section>

          {/* ── Right rail: candidate + proctoring summary ── */}
          <aside className="order-3 min-w-0 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-lg border border-skillpath-teal/40 bg-skillpath-cream p-5 text-skillpath-night shadow-panel">
              <h2 className="text-lg font-black">Candidate summary</h2>
              <div className="mt-4 space-y-2.5 text-sm">
                <SummaryRow label="Candidate" value={profile.name} />
                <SummaryRow label="Domain" value={session?.assessmentDomain ?? 'Full Stack Engineering'} />
                <SummaryRow label="Status" value={session?.status ?? 'Starting'} />
              </div>

              <div className="mt-5 rounded-lg bg-skillpath-night p-4 text-skillpath-cream">
                <div className="mb-3 flex items-center gap-2">
                  <LockKey className="h-5 w-5 text-skillpath-teal" weight="bold" aria-hidden="true" />
                  <p className="text-sm font-black">Claimed skills</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.claimedSkills.map((skill) => (
                    <span key={skill} className="rounded-md border border-white/14 bg-white/8 px-2.5 py-1.5 text-xs font-black">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {session?.status === 'terminated' ? (
                <div className="mt-5 rounded-md border border-skillpath-danger bg-white p-4 text-sm font-bold leading-6 text-skillpath-danger">
                  {session.reason || 'Assessment terminated.'}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>

      {/* ── Floating live camera proctoring preview ── */}
      {session?.status === 'active' && (
        <div className="fixed bottom-5 right-5 z-30 w-44 overflow-hidden rounded-lg border-2 border-skillpath-teal/60 bg-skillpath-night shadow-panel">
          <div className="flex items-center gap-1.5 bg-skillpath-night/95 px-2 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-skillpath-danger opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-skillpath-danger"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wide text-skillpath-cream/80">Recording</span>
          </div>
          {access.cameraStream ? (
            <video ref={cameraVideoRef} autoPlay muted playsInline className="aspect-video w-full scale-x-[-1] object-cover" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-skillpath-night/60">
              <CameraSlash className="h-6 w-6 text-skillpath-danger" weight="bold" aria-hidden="true" />
            </div>
          )}
        </div>
      )}

      {session?.status === 'terminated' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-skillpath-night/95 p-6 backdrop-blur-sm">
          <div className="flex max-w-lg flex-col items-center rounded-xl border border-skillpath-danger bg-white p-10 text-center shadow-2xl">
            <WarningCircle className="mb-4 h-16 w-16 text-skillpath-danger" weight="fill" aria-hidden="true" />
            <h2 className="mb-4 text-3xl font-black text-skillpath-night">Assessment terminated</h2>
            <p className="mb-6 text-base font-bold leading-6 text-skillpath-night/80">
              {session.reason || 'This session was terminated due to a proctoring violation.'}
            </p>
            <p className="mb-6 text-sm font-bold text-skillpath-danger">
              The assessment constraints were violated. You are being redirected.
            </p>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full rounded-md bg-skillpath-danger px-6 py-4 text-lg font-black text-white transition hover:bg-red-700"
              type="button"
            >
              Exit now
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ProctorChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-center transition ${
        active ? 'bg-skillpath-teal/15 text-skillpath-teal ring-1 ring-inset ring-skillpath-teal/40' : 'bg-skillpath-danger/15 text-skillpath-danger ring-1 ring-inset ring-skillpath-danger/40'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-skillpath-teal' : 'bg-skillpath-danger'}`} />
      {label}
    </span>
  );
}

function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' }) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-wide ${
        tone === 'accent' ? 'bg-skillpath-danger/20 text-skillpath-danger' : 'bg-white/8 text-skillpath-cream/75'
      }`}
    >
      {children}
    </span>
  );
}

function TimerReadout({ secondsLeft, pct, urgency }: { secondsLeft: number; pct: number; urgency: 'ok' | 'warn' | 'danger' }) {
  const color = urgency === 'danger' ? 'bg-skillpath-danger' : urgency === 'warn' ? 'bg-yellow-500' : 'bg-skillpath-teal';
  const textColor = urgency === 'danger' ? 'text-skillpath-danger' : 'text-skillpath-cream/70';
  return (
    <div className="flex items-center gap-2">
      <Clock className={`h-4 w-4 ${textColor}`} weight="bold" aria-hidden="true" />
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-black tabular-nums ${textColor}`}>{secondsLeft}s</span>
    </div>
  );
}

function SkillStep({ skill, isCurrent }: { skill: SkillState; isCurrent: boolean }) {
  const isDone = skill.status === 'completed' || skill.status === 'completed_medium_only';
  const isActive = isCurrent && !isDone;

  return (
    <li className={`flex items-start gap-3 rounded-md px-2 py-2.5 transition ${isCurrent ? 'bg-skillpath-teal/10' : ''}`}>
      <span
        className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[10px] font-black ${
          isDone
            ? 'bg-skillpath-teal text-skillpath-night'
            : isActive
              ? 'border-2 border-skillpath-teal text-skillpath-teal'
              : 'border border-white/20 text-skillpath-cream/40'
        }`}
      >
        {isDone ? <CheckCircle className="h-4 w-4" weight="fill" aria-hidden="true" /> : null}
      </span>
      <div className="min-w-0">
        <p className={`truncate text-sm font-black ${isActive ? 'text-skillpath-teal' : 'text-skillpath-cream/85'}`}>{skill.skill}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-skillpath-cream/40">
          {skill.finalLevel ? skill.finalLevel.replace('_', ' ') : skill.status.replace('_', ' ')}
        </p>
      </div>
    </li>
  );
}

function FeedbackCard({
  score,
  level,
  text,
  strengths,
  gaps,
}: {
  score: number | null;
  level: string | null;
  text: string;
  strengths: string[];
  gaps: string[];
}) {
  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-skillpath-night/60 p-4 animate-fade-in">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-skillpath-cream/50">Examiner feedback</p>
        {score !== null ? (
          <span className="rounded-md bg-skillpath-teal/15 px-2 py-0.5 text-xs font-black text-skillpath-teal">
            {score}/100 {level ? `· ${level.replace('_', ' ')}` : ''}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-bold leading-6 text-skillpath-cream/85">{text}</p>
      {(strengths.length > 0 || gaps.length > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-skillpath-teal">Strengths</p>
              <ul className="space-y-1 text-xs font-medium text-skillpath-cream/70">
                {strengths.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-skillpath-danger">Gaps</p>
              <ul className="space-y-1 text-xs font-medium text-skillpath-cream/70">
                {gaps.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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
