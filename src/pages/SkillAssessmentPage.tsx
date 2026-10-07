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
  const [questionIndex, setQuestionIndex] = useState(0);
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
    <div className="sp-page" style={{ userSelect: 'none' }}>
      <CameraMonitor access={access} active={assessment?.status === 'active' && !result} report={reportProctorEvent} />
      <header className="sp-header">
        <span className="sp-logo-script">SkillPath</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {[
            { label: 'Camera', active: access.cameraGranted },
            { label: 'Mic',    active: access.microphoneGranted },
            { label: 'Screen', active: access.screenGranted && access.fullscreenGranted },
          ].map(({ label, active: on }) => (
            <span key={label} className={`sp-status${on ? ' sp-status-active' : ' sp-status-inactive'}`}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--sp-sage)' : 'var(--sp-ghost)', display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </header>

      <div className="sp-content">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0,1fr) minmax(280px,340px)' }}>
          <section style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>Knowledge assessment</h1>
                <p style={{ marginTop: 6, fontSize: 14, color: 'var(--sp-muted)', maxWidth: 520 }}>
                  Answer one question at a time. You can revisit answers before submitting.
                </p>
              </div>
              <button type="button" className="sp-btn-secondary" style={{ flexShrink: 0 }} onClick={onBack} disabled={active}>
                <ArrowLeft size={15} weight="bold" aria-hidden />
                Back
              </button>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { Icon: Brain,         label: 'Format',   value: 'Multiple choice',                                             danger: false },
                { Icon: ClipboardText, label: 'Items',    value: assessment ? String(assessment.items.length) : '0',              danger: false },
                { Icon: Clock,         label: 'Time left', value: active ? formatTime(secondsLeft) : 'Closed',                    danger: active && secondsLeft <= 120 },
                { Icon: ShieldWarning, label: 'Warnings', value: `${assessment?.warningCount ?? 0}/${assessment?.warningLimit ?? 3}`, danger: (assessment?.warningCount ?? 0) > 0 },
              ].map(({ Icon, label, value, danger }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12,
                    background: danger ? 'var(--sp-danger-dim)' : 'var(--sp-surface)',
                    border: `1px solid ${danger ? 'rgba(139,45,45,0.2)' : 'var(--sp-border)'}`,
                    boxShadow: 'var(--sp-shadow-card)',
                  }}
                >
                  <div style={{
                    display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                    background: danger ? 'rgba(139,45,45,0.1)' : 'var(--sp-panel)',
                    color: danger ? 'var(--sp-danger)' : 'var(--sp-sage)',
                  }}>
                    <Icon size={16} weight="bold" aria-hidden />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: danger ? 'var(--sp-danger)' : 'var(--sp-muted)' }}>{label}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: danger ? 'var(--sp-danger)' : 'var(--sp-ink)', marginTop: 2 }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Question list */}
            <div className="sp-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', display: 'grid', gap: 12 }}>
                {loading && (
                  <div className="sp-notice" style={{ fontSize: 13 }}>Preparing assessment questions...</div>
                )}
                {error && (
                  <div className="sp-notice sp-notice-danger" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <WarningCircle size={15} weight="bold" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                    <span style={{ fontSize: 13 }}>{error}</span>
                  </div>
                )}
                {assessment?.status === 'terminated' && (
                  <div className="sp-notice sp-notice-danger" style={{ fontSize: 13 }}>Assessment terminated after repeated proctoring violations.</div>
                )}

                {assessment?.items.slice(questionIndex, questionIndex + 1).map((item) => {
                  const index = questionIndex;
                  const selectedChoice = answers[item.id];
                  const resultItem = result?.results.find(e => e.id === item.id);
                  return (
                    <article
                      key={item.id}
                      style={{ padding: '18px 18px', borderRadius: 10, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sp-sage)', marginBottom: 6 }}>{index + 1}. {item.skill}</p>
                          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--sp-ink)', margin: 0, lineHeight: 1.5 }}>{item.prompt}</h2>
                        </div>
                        {resultItem && (
                          <span style={{
                            flexShrink: 0, padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                            background: resultItem.correct ? 'var(--sp-sage-dim)' : 'var(--sp-danger-dim)',
                            color: resultItem.correct ? 'var(--sp-sage)' : 'var(--sp-danger)',
                            border: `1px solid ${resultItem.correct ? 'rgba(74,124,89,0.3)' : 'rgba(139,45,45,0.3)'}`,
                          }}>
                            {resultItem.correct ? 'Correct' : 'Review'}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
                        {item.choices.map((choice, ci) => {
                          const sel = selectedChoice === ci;
                          const correct = resultItem?.correctChoice === ci;
                          let bg = 'var(--sp-surface)', border = 'var(--sp-border)', color = 'var(--sp-body)';
                          if (resultItem) {
                            if (correct) { bg = 'var(--sp-sage-dim)'; border = 'rgba(74,124,89,0.4)'; color = 'var(--sp-sage)'; }
                            else if (sel) { bg = 'var(--sp-danger-dim)'; border = 'rgba(139,45,45,0.4)'; color = 'var(--sp-danger)'; }
                          } else if (sel) { bg = 'var(--sp-sage-dim)'; border = 'rgba(74,124,89,0.5)'; color = 'var(--sp-sage)'; }
                          return (
                            <button
                              key={`${item.id}-${ci}`}
                              type="button"
                              aria-pressed={sel}
                              disabled={!active}
                              onClick={() => setAnswers(cur => ({ ...cur, [item.id]: ci }))}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
                                background: bg, border: `1.5px solid ${border}`, color,
                                fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: active ? 'pointer' : 'not-allowed',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {sel || correct
                                ? <CheckCircle size={16} weight="fill" aria-hidden style={{ flexShrink: 0 }} />
                                : <Circle     size={16} weight="bold" aria-hidden style={{ flexShrink: 0, color: 'var(--sp-ghost)' }} />}
                              <span>{choice}</span>
                            </button>
                          );
                        })}
                      </div>

                      {resultItem && (
                        <p style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', fontSize: 13, color: 'var(--sp-body)', lineHeight: 1.6 }}>
                          {resultItem.explanation}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>

              {assessment && <div className="action-row" style={{ padding:20, justifyContent:'space-between', borderTop:'1px solid var(--sp-border)' }}><button className="sp-btn-secondary" disabled={questionIndex===0} onClick={()=>setQuestionIndex(i=>i-1)}>Previous</button><span aria-live="polite">Question {questionIndex+1} of {assessment.items.length}</span><button className="sp-btn-secondary" disabled={questionIndex===assessment.items.length-1} onClick={()=>setQuestionIndex(i=>i+1)}>Next</button></div>}
              {!result && assessment?.status === 'active' && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--sp-border)' }}>
                  <button
                    type="button"
                    className="sp-btn-primary"
                    style={{ width: '100%', height: 44, fontSize: 14 }}
                    onClick={() => void submitCurrentAssessment(false)}
                    disabled={!allAnswered || submitting}
                  >
                    {submitting ? 'Scoring...' : 'Submit assessment'}
                    <CheckCircle size={15} weight="bold" aria-hidden />
                  </button>
                </div>
              )}

              {result && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--sp-border)' }}>
                  <button
                    type="button"
                    className="sp-btn-accent"
                    style={{ width: '100%', height: 44, fontSize: 14 }}
                    onClick={() => onComplete(result)}
                  >
                    Continue to learning plan
                    <SealCheck size={15} weight="bold" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside style={{ position: 'sticky', top: 76, alignSelf: 'start', display: 'grid', gap: 12 }}>
            <div className="sp-card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-ink)', margin: '0 0 14px' }}>Assessment brief</h2>
              <div style={{ display: 'grid', gap: 6 }}>
                {([
                  ['Candidate', profile.name],
                  ['Domain', profile.domain],
                  ['Test domain', assessment?.domain ?? 'Full Stack Engineering'],
                  ['Technical interview', profile.claimedSkills.length ? (chatSession?.status ?? 'Required') : 'Not required'],
                  ['Progress', assessment ? `${answeredCount}/${assessment.items.length} answered` : 'Preparing'],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sp-muted)' }}>{l}</p>
                    <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: 'var(--sp-ink)', overflowWrap: 'anywhere' }}>{v}</p>
                  </div>
                ))}
              </div>

              {skillCounts.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sp-muted)', marginBottom: 8 }}>Coverage</p>
                  <div style={{ display: 'grid', gap: 5 }}>
                    {skillCounts.map(([skill, count]) => (
                      <div key={skill} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sp-body)' }}>{skill}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sp-ink)' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {chatSession?.aggregate && (
                <div style={{ marginTop: 14, padding: '14px 14px', borderRadius: 10, background: 'var(--sp-sage-dim)', border: '1px solid rgba(74,124,89,0.25)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sp-sage)' }}>Chatbot score</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--sp-sage)', marginTop: 4 }}>{chatSession.aggregate.score}%</p>
                  <p style={{ fontSize: 12, color: 'rgba(74,124,89,0.8)', marginTop: 2 }}>{chatSession.aggregate.level.replace('_', ' ')}</p>
                </div>
              )}

              {result && (
                <div style={{ marginTop: 14, padding: '14px 14px', borderRadius: 10, background: 'var(--sp-sage-dim)', border: '1px solid rgba(74,124,89,0.25)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sp-sage)' }}>OA result</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--sp-sage)', marginTop: 4 }}>{result.score}%</p>
                  <p style={{ fontSize: 12, color: 'rgba(74,124,89,0.8)', marginTop: 2 }}>{result.correctCount}/{result.total} correct &middot; {result.level.replace('_', ' ')}</p>
                  {result.timedOut && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--sp-amber)', fontWeight: 600 }}>Submitted automatically on timeout.</p>}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Camera preview */}
      {assessment?.status === 'active' && !result && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 30,
          width: 168, borderRadius: 12, overflow: 'hidden',
          background: 'var(--sp-ink)', border: '1px solid var(--sp-border)',
          boxShadow: 'var(--sp-shadow-float)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sp-danger)', display: 'inline-block', animation: 'spPulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(245,240,232,0.7)' }}>Live camera</span>
          </div>
          {access.cameraStream
            ? <video ref={cameraVideoRef} autoPlay muted playsInline style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
            : <div style={{ width: '100%', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,23,20,0.8)' }}>
                <CameraSlash size={20} weight="bold" color="var(--sp-danger)" aria-hidden />
              </div>}
        </div>
      )}

      {assessment?.status === 'terminated' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,240,232,0.92)', backdropFilter: 'blur(8px)', padding: 24 }}>
          <div style={{ maxWidth: 440, width: '100%', background: 'var(--sp-surface)', border: '1px solid rgba(139,45,45,0.3)', borderRadius: 16, padding: '40px 36px', textAlign: 'center', boxShadow: 'var(--sp-shadow-panel)' }}>
            <WarningCircle size={48} weight="fill" color="var(--sp-danger)" aria-hidden style={{ margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sp-ink)', margin: '0 0 12px' }}>Assessment Terminated</h2>
            <p style={{ fontSize: 14, color: 'var(--sp-muted)', lineHeight: 1.6, marginBottom: 28 }}>This session was terminated due to a proctoring violation. Your activity has been recorded.</p>
            <button onClick={() => { window.location.href = '/'; }} className="sp-btn-primary" style={{ width: '100%', height: 44, fontSize: 14, background: 'var(--sp-danger)', borderColor: 'var(--sp-danger)' }}>Exit</button>
            <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" onLoad={() => setTimeout(() => { window.location.href = '/'; }, 4000)} alt="" />
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components removed — no longer needed (inline styles used instead)
