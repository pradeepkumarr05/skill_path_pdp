import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CameraMonitor } from '../components/CameraMonitor';
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Circle,
  CameraSlash,
  ClipboardText,
  Clock,
  SealCheck,
  ShieldWarning,
  WarningCircle,
} from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import { createSkillAssessment, recordSkillAssessmentProctorEvent, submitSkillAssessment } from '../api/skillpathApi';
import type { AgenticSession, AssessmentAccessGrant, SkillAssessment, SkillAssessmentResult } from '../types/assessment';
import type { ProfileSetupResult } from './ProfileSetupPage';

interface SkillAssessmentPageProps {
  profile: ProfileSetupResult;
  access: AssessmentAccessGrant;
  chatSession: AgenticSession | null;
  onBack: () => void;
  onComplete: (result: SkillAssessmentResult) => void;
}

export function SkillAssessmentPage({ profile, access, chatSession, onBack, onComplete }: SkillAssessmentPageProps) {
  const [assessment, setAssessment] = useState<SkillAssessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SkillAssessmentResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const proctorPendingRef = useRef(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  const answeredCount = useMemo(() => {
    if (!assessment) return 0;
    return assessment.items.filter((item) => Number.isInteger(answers[item.id])).length;
  }, [answers, assessment]);
  const allAnswered = Boolean(assessment && answeredCount === assessment.items.length);
  const active = assessment?.status === 'active' && !result;
  const skillCounts = useMemo(() => {
    if (!assessment) return [];
    const counts = new Map<string, number>();
    assessment.items.forEach((item) => counts.set(item.skill, (counts.get(item.skill) ?? 0) + 1));
    return Array.from(counts.entries());
  }, [assessment]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssessment() {
      setLoading(true);
      setError(null);

      try {
        const nextAssessment = await createSkillAssessment(profile);
        if (!cancelled) {
          setAssessment(nextAssessment);
          setSecondsLeft(nextAssessment.durationSeconds);
        }
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Unable to create the deterministic skill assessment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    if (cameraVideoRef.current && access.cameraStream) {
      cameraVideoRef.current.srcObject = access.cameraStream;
    }
  }, [access.cameraStream, assessment?.status]);

  const reportProctorEvent = useCallback(
    async (type: string, detail = '') => {
      if (!assessment?.assessmentId || assessment.status !== 'active' || proctorPendingRef.current || result) return;

      proctorPendingRef.current = true;
      try {
        const nextAssessment = await recordSkillAssessmentProctorEvent(assessment.assessmentId, type, detail);
        setAssessment(nextAssessment);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to record proctoring event.');
      } finally {
        proctorPendingRef.current = false;
      }
    },
    [assessment?.assessmentId, assessment?.status, result],
  );

  const submitCurrentAssessment = useCallback(
    async (timedOut = false) => {
      if (!assessment?.assessmentId || submitting || submittedRef.current || assessment.status !== 'active') return;

      submittedRef.current = true;
      setSubmitting(true);
      setError(null);

      try {
        const nextResult = await submitSkillAssessment(assessment.assessmentId, answers, timedOut);
        setResult(nextResult);
        setAssessment((current) => (current ? { ...current, status: nextResult.status } : current));
      } catch (nextError) {
        submittedRef.current = false;
        setError(nextError instanceof Error ? nextError.message : 'Unable to submit the deterministic skill assessment.');
      } finally {
        setSubmitting(false);
      }
    },
    [answers, assessment?.assessmentId, assessment?.status, submitting],
  );

  useEffect(() => {
    if (!assessment || assessment.status !== 'active' || result) return undefined;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(assessment.dueAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        void submitCurrentAssessment(true);
      }
    };

    tick();
    const timerId = window.setInterval(tick, 500);
    return () => window.clearInterval(timerId);
  }, [assessment, result, submitCurrentAssessment]);

  useEffect(() => {
    if (!assessment?.assessmentId || assessment.status !== 'active') return undefined;

    const preventClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportProctorEvent(event.type, `${event.type} attempt was blocked during deterministic assessment.`);
    };
    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void reportProctorEvent('contextmenu', 'Context menu attempt was blocked during deterministic assessment.');
    };
    const onVisibilityChange = () => {
      if (document.hidden) void reportProctorEvent('tab_hidden', 'Browser tab became hidden during deterministic assessment.');
    };
    const onBlur = () => {
      void reportProctorEvent('window_blur', 'Assessment window lost focus during deterministic assessment.');
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) void reportProctorEvent('fullscreen_exit', 'Candidate exited full-screen mode during deterministic assessment.');
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
  }, [assessment?.assessmentId, assessment?.status, reportProctorEvent]);

  useEffect(() => {
    if (!assessment?.assessmentId || assessment.status !== 'active') return undefined;

    const cameraTracks = access.cameraStream?.getTracks() ?? [];
    const screenTracks = access.screenStream?.getTracks() ?? [];
    const trackHandlers = [
      ...cameraTracks.map((track) => ({
        track,
        handler: () => void reportProctorEvent(track.kind === 'audio' ? 'microphone_track_ended' : 'camera_track_ended', `${track.kind} track ended during deterministic assessment.`),
      })),
      ...screenTracks.map((track) => ({
        track,
        handler: () => void reportProctorEvent('screen_track_ended', `${track.kind} track ended during deterministic assessment.`),
      })),
    ];

    trackHandlers.forEach(({ track, handler }) => track.addEventListener('ended', handler));
    return () => trackHandlers.forEach(({ track, handler }) => track.removeEventListener('ended', handler));
  }, [access.cameraStream, access.screenStream, assessment?.assessmentId, assessment?.status, reportProctorEvent]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-skillpath-night p-4 text-skillpath-cream sm:p-5 lg:p-6 select-none">
      <CameraMonitor access={access} active={assessment?.status === 'active' && !result} report={reportProctorEvent} />
      <div className="flex min-h-[calc(100vh-32px)] w-full flex-col rounded-lg border border-white/10 bg-skillpath-night shadow-panel sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)]">
        <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <SkillPathLogo />
            <span className="rounded-full bg-skillpath-teal px-3 py-1.5 text-sm font-black text-skillpath-night lg:hidden">OA skills</span>
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
                <h1 className="text-4xl font-black leading-tight text-skillpath-cream sm:text-5xl">Deterministic Skills Assessment</h1>
                <p className="mt-3 max-w-4xl text-base font-medium leading-7 text-skillpath-cream/70">
                  This separate OA-style stage follows the claimed-skill chatbot assessment and tests every Full Stack skill with a fixed, uniformly distributed question set.
                </p>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/8 px-4 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onBack}
                disabled={active}
              >
                <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                Back
              </button>
            </div>

            <section className="rounded-lg border border-white/10 bg-white/8 shadow-panel">
              <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-4">
                <Metric icon={<Brain className="h-5 w-5" weight="bold" />} label="Format" value="Deterministic MCQ" />
                <Metric icon={<ClipboardText className="h-5 w-5" weight="bold" />} label="Items" value={assessment ? String(assessment.items.length) : '0'} />
                <Metric icon={<Clock className="h-5 w-5" weight="bold" />} label="Time left" value={active ? formatTime(secondsLeft) : 'Closed'} danger={active && secondsLeft <= 120} />
                <Metric icon={<ShieldWarning className="h-5 w-5" weight="bold" />} label="Warnings" value={`${assessment?.warningCount ?? 0}/${assessment?.warningLimit ?? 3}`} danger={(assessment?.warningCount ?? 0) > 0} />
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                {loading ? <SystemCard text="Preparing deterministic Full Stack assessment." /> : null}

                {error ? (
                  <div className="flex gap-3 rounded-md border border-skillpath-danger bg-white p-4 text-sm font-bold text-skillpath-danger">
                    <WarningCircle className="mt-0.5 h-5 w-5 flex-none" weight="bold" aria-hidden="true" />
                    {error}
                  </div>
                ) : null}

                {assessment?.status === 'terminated' ? (
                  <div className="rounded-md border border-skillpath-danger bg-white p-4 text-sm font-bold leading-6 text-skillpath-danger">
                    Deterministic skills assessment terminated after repeated proctoring violations.
                  </div>
                ) : null}

                {assessment?.items.map((item, index) => {
                  const selectedChoice = answers[item.id];
                  const resultItem = result?.results.find((entry) => entry.id === item.id);

                  return (
                    <article key={item.id} className="rounded-lg border border-white/10 bg-skillpath-night p-4 text-skillpath-cream shadow-soft">
                      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-skillpath-teal">
                            {index + 1}. {item.skill}
                          </p>
                          <h2 className="mt-2 text-lg font-black leading-7">{item.prompt}</h2>
                        </div>
                        {resultItem ? (
                          <span className={`rounded-md px-3 py-1.5 text-sm font-black ${resultItem.correct ? 'bg-skillpath-teal text-skillpath-night' : 'bg-skillpath-danger text-white'}`}>
                            {resultItem.correct ? 'Correct' : 'Review'}
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {item.choices.map((choice, choiceIndex) => {
                          const selected = selectedChoice === choiceIndex;
                          const correctChoice = resultItem?.correctChoice === choiceIndex;
                          return (
                            <button
                              key={`${item.id}-${choiceIndex}`}
                              className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-black transition disabled:cursor-not-allowed ${
                                resultItem
                                  ? correctChoice
                                    ? 'border-skillpath-teal bg-skillpath-teal text-skillpath-night'
                                    : selected
                                      ? 'border-skillpath-danger bg-skillpath-danger text-white'
                                      : 'border-white/10 bg-white/8 text-skillpath-cream/70'
                                  : selected
                                    ? 'border-skillpath-teal bg-skillpath-teal text-skillpath-night'
                                    : 'border-white/12 bg-white/8 text-skillpath-cream hover:border-skillpath-teal'
                              }`}
                              type="button"
                              disabled={!active}
                              onClick={() => setAnswers((current) => ({ ...current, [item.id]: choiceIndex }))}
                            >
                              {selected || correctChoice ? <CheckCircle className="h-5 w-5 flex-none" weight="fill" aria-hidden="true" /> : <Circle className="h-5 w-5 flex-none" weight="bold" aria-hidden="true" />}
                              <span>{choice}</span>
                            </button>
                          );
                        })}
                      </div>

                      {resultItem ? <p className="mt-4 rounded-md bg-white/8 p-3 text-sm font-bold leading-6 text-skillpath-cream/82">{resultItem.explanation}</p> : null}
                    </article>
                  );
                })}
              </div>

              {!result && assessment?.status === 'active' ? (
                <div className="border-t border-white/10 p-4 sm:p-5">
                  <button
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-teal px-4 text-base font-black text-skillpath-night transition hover:bg-skillpath-cream disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                    type="button"
                    onClick={() => void submitCurrentAssessment(false)}
                    disabled={!allAnswered || submitting}
                  >
                    {submitting ? 'Scoring assessment' : 'Submit deterministic assessment'}
                    <CheckCircle className="h-5 w-5" weight="bold" aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              {result ? (
                <div className="border-t border-white/10 p-4 sm:p-5">
                  <button
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-teal px-4 text-base font-black text-skillpath-night transition hover:bg-skillpath-cream"
                    type="button"
                    onClick={() => onComplete(result)}
                  >
                    Continue to gap analysis
                    <SealCheck className="h-5 w-5" weight="bold" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </section>
          </section>

          <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-lg border border-skillpath-teal/40 bg-skillpath-cream p-5 text-skillpath-night shadow-panel">
              <h2 className="text-2xl font-black">Assessment brief</h2>
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label="Candidate" value={profile.name} />
                <SummaryRow label="Selected domain" value={profile.domain} />
                <SummaryRow label="Prototype domain" value={assessment?.domain ?? 'Full Stack Engineering'} />
                <SummaryRow label="Chatbot stage" value={profile.claimedSkills.length ? chatSession?.status ?? 'Required before this stage' : 'Skipped: no claimed skills'} />
                <SummaryRow label="Completion" value={assessment ? `${answeredCount}/${assessment.items.length} answered` : 'Preparing'} />
              </div>

              <div className="mt-5 rounded-lg bg-skillpath-night p-4 text-skillpath-cream">
                <p className="text-sm font-black text-skillpath-teal">Uniform coverage</p>
                <div className="mt-3 grid gap-2">
                  {skillCounts.map(([skill, count]) => (
                    <div key={skill} className="flex items-center justify-between gap-3 rounded-md bg-white/8 px-3 py-2 text-xs font-black">
                      <span>{skill}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {chatSession?.aggregate ? (
                <div className="mt-5 rounded-lg bg-skillpath-night p-4 text-skillpath-cream">
                  <p className="text-sm font-black text-skillpath-teal">Chatbot score</p>
                  <p className="mt-1 text-3xl font-black">{chatSession.aggregate.score}%</p>
                  <p className="mt-1 text-sm font-bold text-skillpath-cream/70">{chatSession.aggregate.level.replace('_', ' ')}</p>
                </div>
              ) : null}

              {result ? (
                <div className="mt-5 rounded-lg bg-skillpath-night p-4 text-skillpath-cream">
                  <p className="text-sm font-black text-skillpath-teal">OA result</p>
                  <p className="mt-1 text-3xl font-black">{result.score}%</p>
                  <p className="mt-1 text-sm font-bold text-skillpath-cream/70">
                    {result.correctCount}/{result.total} correct · {result.level.replace('_', ' ')}
                  </p>
                  {result.timedOut ? <p className="mt-3 text-sm font-bold text-skillpath-citron">Submitted automatically when time expired.</p> : null}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>

      {/* ── Floating live camera proctoring preview ── */}
      {assessment?.status === 'active' && !result && (
        <div className="mx-4 my-4 w-44 overflow-hidden rounded-lg border border-skillpath-teal/60 bg-skillpath-night shadow-panel lg:fixed lg:bottom-5 lg:right-5 lg:z-30">
          <div className="flex items-center gap-1.5 bg-skillpath-night/95 px-2 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-skillpath-danger opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-skillpath-danger"></span>
            </span>
            <span className="text-xs font-bold text-skillpath-cream/80">Live camera</span>
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

      {assessment?.status === 'terminated' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-skillpath-night/95 p-6 backdrop-blur-sm">
          <div className="flex max-w-lg flex-col items-center text-center rounded-xl border border-skillpath-danger bg-white p-10 shadow-2xl">
            <WarningCircle className="h-16 w-16 text-skillpath-danger mb-4" weight="fill" />
            <h2 className="text-3xl font-black text-skillpath-night mb-4">Assessment Terminated</h2>
            <p className="text-lg font-bold text-skillpath-night/80 mb-8">
              This session was terminated due to a proctoring violation (Camera or Full-screen lost).
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-skillpath-line bg-white p-3">
      <p className="font-black text-skillpath-muted">{label}</p>
      <p className="mt-1 font-black text-skillpath-night">{value}</p>
    </div>
  );
}
