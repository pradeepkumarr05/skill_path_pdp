import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChatCircleText,
  CheckCircle,
  Clock,
  LockKey,
  PaperPlaneTilt,
  ShieldWarning,
  WarningCircle,
} from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import { CameraThumbnail } from '../components/CameraThumbnail';
import { recordProctorEvent, startAgentSession, submitAgentAnswer } from '../api/skillpathApi';
import type { AssessmentAccessGrant, AgenticSession } from '../types/assessment';
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
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const submittedQuestionRef = useRef<string | null>(null);
  const proctorPendingRef = useRef(false);

  const activeQuestion = session?.currentQuestion ?? null;
  const canSubmit = Boolean(session?.sessionId && session.status === 'active' && activeQuestion && answer.trim().length > 0 && !submitting);

  const currentSkill = useMemo(() => {
    if (!activeQuestion) return null;
    return session?.skillStates.find((skill) => skill.skill === activeQuestion.skill) ?? null;
  }, [activeQuestion, session?.skillStates]);

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
          setError(nextError instanceof Error ? nextError.message : 'Unable to start the Gemini chatbot session.');
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
        setError(nextError instanceof Error ? nextError.message : 'Unable to submit the answer.');
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

  return (
    <main className="min-h-screen bg-skillpath-night p-4 text-skillpath-cream sm:p-5 lg:p-6 select-none">
      <div className="flex min-h-[calc(100vh-32px)] w-full flex-col rounded-lg border border-white/10 bg-skillpath-night shadow-panel sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)]">
        <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <SkillPathLogo />
            <span className="rounded-full bg-skillpath-teal px-3 py-1.5 text-sm font-black text-skillpath-night lg:hidden">Chatbot</span>
          </div>
          <div className="grid gap-2 text-sm font-black text-skillpath-cream sm:grid-cols-3 lg:min-w-[520px]">
            <StatusPill label="Camera" active={access.cameraGranted} />
            <StatusPill label="Mic" active={access.microphoneGranted} />
            <StatusPill label="Screen" active={access.screenGranted && access.fullscreenGranted} />
          </div>
        </header>

        <div className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,420px)] lg:p-8">
          <section className="min-w-0">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-tight text-skillpath-cream sm:text-5xl">Live Chatbot Assessment</h1>
                <p className="mt-3 max-w-4xl text-base font-medium leading-7 text-skillpath-cream/70">
                  Gemini asks adaptive medium-to-hard questions from the claimed skills and evaluates each typed answer before moving forward.
                </p>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/8 px-4 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal"
                type="button"
                onClick={onBack}
                disabled={session?.status === 'active'}
              >
                <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                Back
              </button>
            </div>

            <section className="flex min-h-[560px] flex-col rounded-lg border border-white/10 bg-white/8 shadow-panel">
              <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-3">
                <Metric icon={<ChatCircleText className="h-5 w-5" weight="bold" />} label="Model" value={session?.model ?? 'Gemini'} />
                <Metric icon={<Clock className="h-5 w-5" weight="bold" />} label="Timer" value={activeQuestion ? `${secondsLeft}s` : 'Closed'} danger={secondsLeft <= 10 && session?.status === 'active'} />
                <Metric icon={<ShieldWarning className="h-5 w-5" weight="bold" />} label="Warnings" value={`${session?.warningCount ?? 0}/${session?.warningLimit ?? 3}`} danger={(session?.warningCount ?? 0) > 0} />
              </div>

              <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {loading ? (
                  <SystemCard text="Starting Gemini chatbot session." />
                ) : null}

                {error ? (
                  <div className="flex gap-3 rounded-md border border-skillpath-danger bg-white p-4 text-sm font-bold text-skillpath-danger">
                    <WarningCircle className="mt-0.5 h-5 w-5 flex-none" weight="bold" aria-hidden="true" />
                    {error}
                  </div>
                ) : null}

                {session?.transcript.map((entry) => (
                  <TranscriptBubble key={entry.id} role={entry.role} text={entry.text} meta={entry.meta} />
                ))}

                {submitting && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-skillpath-night p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-skillpath-teal">
                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-current"></div>
                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" style={{ animationDelay: '200ms' }}></div>
                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" style={{ animationDelay: '400ms' }}></div>
                      </div>
                      <p className="mt-2 text-xs font-bold text-skillpath-cream/60">Preparing next question...</p>
                    </div>
                  </div>
                )}
              </div>

              {session?.status === 'active' && activeQuestion ? (
                <form className="border-t border-white/10 p-4 sm:p-5" onSubmit={handleSubmit}>
                  <div className="mb-3 flex flex-col gap-2 text-sm font-black text-skillpath-cream/74 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {activeQuestion.skill} · {activeQuestion.difficulty}
                    </span>
                    <span>{currentSkill ? `${currentSkill.mediumAttempts} medium attempt(s)` : 'Adaptive round'}</span>
                  </div>
                  <textarea
                    className="min-h-[116px] w-full resize-none rounded-md border border-white/12 bg-skillpath-cream px-4 py-3 text-base font-bold leading-6 text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-teal disabled:cursor-not-allowed disabled:opacity-70"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your answer here"
                    disabled={submitting}
                  />
                  <button
                    className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-teal px-4 text-base font-black text-skillpath-night transition hover:bg-skillpath-cream disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                    type="submit"
                    disabled={!canSubmit}
                  >
                    {submitting ? 'Assessing answer' : 'Submit answer'}
                    <PaperPlaneTilt className="h-5 w-5" weight="bold" aria-hidden="true" />
                  </button>
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

          <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
            <div className="space-y-5">
              <CameraThumbnail stream={access.cameraStream} active={access.cameraGranted} detail="Visible throughout the chatbot assessment" />
              <section className="rounded-lg border border-skillpath-teal/40 bg-skillpath-cream p-5 text-skillpath-night shadow-panel">
                <h2 className="text-2xl font-black">Agent state</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <SummaryRow label="Candidate" value={profile.name} />
                  <SummaryRow label="Domain" value={session?.assessmentDomain ?? 'Full Stack Engineering'} />
                  <SummaryRow label="Status" value={session?.status ?? 'Starting'} />
                  <SummaryRow label="Current skill" value={activeQuestion?.skill ?? 'None'} />
                  <SummaryRow label="Current difficulty" value={activeQuestion?.difficulty ?? 'None'} />
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
            </div>
          </aside>
        </div>
      </div>
      {session?.status === 'terminated' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-skillpath-night/95 p-6 backdrop-blur-sm">
          <div className="flex max-w-lg flex-col items-center text-center rounded-xl border border-skillpath-danger bg-white p-10 shadow-2xl">
            <WarningCircle className="h-16 w-16 text-skillpath-danger mb-4" weight="fill" />
            <h2 className="text-3xl font-black text-skillpath-night mb-4">Assessment Terminated</h2>
            <p className="text-lg font-bold text-skillpath-night/80 mb-8">
              {session.reason || 'This session was terminated due to a proctoring violation (Camera or Full-screen lost).'}
            </p>
            <p className="text-sm font-bold text-skillpath-danger mb-6">
              You violated the strict assessment constraints. You are being redirected.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full rounded-md bg-skillpath-danger px-6 py-4 text-lg font-black text-white hover:bg-red-700 transition"
            >
              Exit Now
            </button>
            {/* Auto redirect script */}
            <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" onLoad={() => setTimeout(() => { window.location.href = '/'; }, 4000)} alt="" />
          </div>
        </div>
      )}
    </main>
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

function SystemCard({ text }: { text: string }) {
  return <div className="rounded-md border border-white/10 bg-skillpath-night p-4 text-sm font-bold text-skillpath-cream">{text}</div>;
}

function TranscriptBubble({ role, text, meta }: { role: string; text: string; meta?: Record<string, unknown> }) {
  const isCandidate = role === 'candidate';
  const isSystem = role === 'system';
  const score = typeof meta?.score === 'number' ? `${meta.score}/100` : null;

  return (
    <div className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[780px] rounded-lg p-4 shadow-soft ${
          isCandidate
            ? 'bg-skillpath-teal text-skillpath-night'
            : isSystem
              ? 'border border-white/10 bg-skillpath-night text-skillpath-cream'
              : 'bg-skillpath-cream text-skillpath-night'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-4 text-xs font-black uppercase">
          <span>{role}</span>
          {score ? <span>{score}</span> : null}
        </div>
        <p className="whitespace-pre-wrap text-sm font-bold leading-6">{text}</p>
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
