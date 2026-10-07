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
type LessonRole  = 'system' | 'bot' | 'candidate';

interface LessonMessage {
  id: string;
  role: LessonRole;
  text: string;
}

const SESSION_SECONDS   = 600;
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

  const totalSubtopics = roadmap.reduce((t, topic) => t + topic.subtopics.length, 0);
  const completedCount = Object.keys(completedSubtopics).length;
  const completion     = totalSubtopics ? Math.round((completedCount / totalSubtopics) * 100) : 0;
  const weakestTopic   = roadmap[0];
  const active         = Boolean(activeSubtopic && lessonPhase !== 'completed');

  const createId  = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const addMessage = useCallback((role: LessonRole, text: string) => {
    setLessonMessages(cur => [...cur, { id: createId(), role, text }]);
  }, []);

  const resetActiveSession = useCallback((message?: string) => {
    setActiveSubtopic(null); setLessonMessages([]); setLessonPhase('checkpoint-one');
    setAnswer(''); setSecondsLeft(SESSION_SECONDS); setWarningCount(0);
    setSessionAlert(message ?? null);
  }, []);

  const startSession = (subtopic: RoadmapSubtopic) => {
    setActiveSubtopic(subtopic); setLessonPhase('checkpoint-one'); setAnswer('');
    setSecondsLeft(SESSION_SECONDS); setWarningCount(0); setSessionAlert(null);
    setLessonMessages([
      { id: createId(), role: 'system', text: `Proctored 10-minute learning session started for ${subtopic.skill}.` },
      { id: createId(), role: 'bot',    text: `Lesson focus: ${subtopic.title}\n\n${subtopic.objective}\n\n${subtopic.notes.map(n => `  ${n}`).join('\n')}` },
      { id: createId(), role: 'bot',    text: subtopic.checkPrompt },
    ]);
  };

  const saveNotebook = (subtopic: RoadmapSubtopic) => {
    const completedAt = new Date().toLocaleString();
    setNotebooks(cur => [{
      id: createId(), subtopicId: subtopic.id, skill: subtopic.skill, title: subtopic.title, completedAt,
      notes: [`Objective: ${subtopic.objective}`, ...subtopic.notes, `Checkpoint: ${subtopic.checkPrompt}`, `Correction: ${subtopic.correction}`],
    }, ...cur.filter(e => e.subtopicId !== subtopic.id)]);
  };

  const answerLooksRight = (subtopic: RoadmapSubtopic, response: string) => {
    const normalized = response.toLowerCase();
    const tokens = [...subtopic.title.split(/\W+/), ...subtopic.objective.split(/\W+/), ...subtopic.notes.join(' ').split(/\W+/)]
      .map(t => t.toLowerCase()).filter(t => t.length > 5);
    const matches = new Set(tokens.filter(t => normalized.includes(t))).size;
    return response.trim().split(/\s+/).length >= 12 && matches >= 2;
  };

  const submitLessonAnswer = () => {
    if (!activeSubtopic || lessonPhase === 'completed' || !answer.trim()) return;
    const currentAnswer = answer.trim();
    const passed = answerLooksRight(activeSubtopic, currentAnswer);
    addMessage('candidate', currentAnswer);
    if (lessonPhase === 'checkpoint-one') {
      addMessage('bot', passed
        ? `Good. You connected the concept correctly. Next: explain how you would apply ${activeSubtopic.title.toLowerCase()} during a production bug review.`
        : `${activeSubtopic.correction}\n\nNext: explain how you would apply ${activeSubtopic.title.toLowerCase()} during a production bug review.`);
      setLessonPhase('checkpoint-two'); setAnswer(''); return;
    }
    addMessage('bot', passed
      ? `Session complete. ${activeSubtopic.title} is marked complete and the notebook has been saved.`
      : `${activeSubtopic.correction}\n\nSession complete. The correction has been saved to your notebook.`);
    setCompletedSubtopics(cur => ({ ...cur, [activeSubtopic.id]: true }));
    saveNotebook(activeSubtopic); setLessonPhase('completed'); setAnswer('');
  };

  const recordLessonWarning = useCallback((type: string, detail: string) => {
    if (!activeSubtopic || lessonPhase === 'completed') return;
    setWarningCount(cur => {
      const next = cur + 1;
      setLessonMessages(m => [...m, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role: 'system', text: `${detail} Warning ${next}/${LESSON_WARNING_LIMIT}.` }]);
      if (next >= LESSON_WARNING_LIMIT) window.setTimeout(() => resetActiveSession('Learning session reset after repeated proctoring warnings.'), 0);
      return next;
    });
  }, [activeSubtopic, lessonPhase, resetActiveSession]);

  useEffect(() => {
    if (!activeSubtopic || lessonPhase === 'completed') return;
    const tick = () => setSecondsLeft(cur => { if (cur <= 1) { window.setTimeout(() => resetActiveSession('Session timed out. Progress was reset.'), 0); return 0; } return cur - 1; });
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeSubtopic, lessonPhase, resetActiveSession]);

  useEffect(() => {
    if (!activeSubtopic || lessonPhase === 'completed') return;
    const preventClipboard = (e: ClipboardEvent) => { e.preventDefault(); recordLessonWarning(e.type, `${e.type} blocked.`); };
    const preventContext   = (e: MouseEvent) => { e.preventDefault(); recordLessonWarning('contextmenu', 'Context menu blocked.'); };
    const onVisibility     = () => { if (document.hidden) recordLessonWarning('tab_hidden', 'Tab switch detected.'); };
    const onBlur           = () => recordLessonWarning('window_blur', 'Window lost focus.');
    const onFullscreen     = () => { if (!document.fullscreenElement) recordLessonWarning('fullscreen_exit', 'Full-screen exited.'); };
    document.addEventListener('copy', preventClipboard); document.addEventListener('cut', preventClipboard); document.addEventListener('paste', preventClipboard);
    document.addEventListener('contextmenu', preventContext); document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen); window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('copy', preventClipboard); document.removeEventListener('cut', preventClipboard); document.removeEventListener('paste', preventClipboard);
      document.removeEventListener('contextmenu', preventContext); document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen); window.removeEventListener('blur', onBlur);
    };
  }, [activeSubtopic, lessonPhase, recordLessonWarning]);

  useEffect(() => {
    if (!activeSubtopic || lessonPhase === 'completed') return;
    const handlers = [
      ...( access.cameraStream?.getTracks() ?? []).map(track => ({ track, handler: () => recordLessonWarning(track.kind, `${track.kind} track ended.`) })),
      ...(access.screenStream?.getTracks()  ?? []).map(track => ({ track, handler: () => recordLessonWarning('screen', 'Screen track ended.') })),
    ];
    handlers.forEach(({ track, handler }) => track.addEventListener('ended', handler));
    return () => handlers.forEach(({ track, handler }) => track.removeEventListener('ended', handler));
  }, [access.cameraStream, access.screenStream, activeSubtopic, lessonPhase, recordLessonWarning]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="sp-page">
      {/* HEADER */}
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

          {/* LEFT */}
          <section style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              <div>
                <p className="sp-label" style={{ marginBottom: 6 }}>Step 4 of 4</p>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>Gap Detection and Learning Roadmap</h1>
                <p style={{ marginTop: 6, fontSize: 14, color: 'var(--sp-muted)', maxWidth: 520 }}>
                  SkillPath combines chatbot signals with deterministic assessment results to build personalised 10-minute recovery sessions.
                </p>
              </div>
              <button
                type="button"
                className="sp-btn-secondary"
                style={{ flexShrink: 0 }}
                onClick={() => { if (active) resetActiveSession(); onBack(); }}
              >
                <ArrowLeft size={15} weight="bold" aria-hidden />
                Back
              </button>
            </div>

            {/* Metric row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { Icon: Brain,      label: 'Weakest area', value: weakestTopic?.skill ?? 'None' },
                { Icon: ListChecks, label: 'Topics',       value: String(roadmap.length) },
                { Icon: Clock,      label: 'Subtopics',    value: String(totalSubtopics) },
                { Icon: Notebook,   label: 'Notebooks',    value: String(notebooks.length) },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="sp-metric">
                  <div className="sp-metric-icon"><Icon size={16} weight="bold" aria-hidden /></div>
                  <div>
                    <p className="sp-metric-label">{label}</p>
                    <p className="sp-metric-value">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Roadmap progress + content */}
            <div className="sp-card" style={{ overflow: 'hidden' }}>
              {/* Progress bar header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sp-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--sp-ink)' }}>Roadmap progress</p>
                    <p style={{ fontSize: 12, color: 'var(--sp-muted)', marginTop: 2 }}>{completedCount}/{totalSubtopics} subtopics complete</p>
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: 999,
                    background: completion === 100 ? 'var(--sp-sage-dim)' : 'var(--sp-panel)',
                    border: '1px solid var(--sp-border)',
                    fontSize: 13, fontWeight: 700,
                    color: completion === 100 ? 'var(--sp-sage)' : 'var(--sp-ink)',
                  }}>
                    {completion}%
                  </span>
                </div>
                <div className="sp-progress">
                  <div className="sp-progress-fill" style={{ width: `${completion}%` }} />
                </div>
              </div>

              {/* Lesson session OR topic list */}
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
                  onExit={() => resetActiveSession('Session exited. Progress was reset.')}
                  onCloseCompleted={() => resetActiveSession()}
                  formatTime={formatTime}
                />
              ) : (
                <div style={{ padding: '16px 20px', display: 'grid', gap: 12 }}>
                  {sessionAlert && (
                    <div className="sp-notice sp-notice-danger" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <WarningCircle size={15} weight="bold" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                      <span style={{ fontSize: 13 }}>{sessionAlert}</span>
                    </div>
                  )}
                  {roadmap.map(topic => (
                    <article
                      key={topic.id}
                      style={{
                        padding: '18px 18px', borderRadius: 10,
                        background: 'var(--sp-panel)', border: '1px solid var(--sp-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                        <div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            <span className="sp-tag sp-tag-sage">{topic.priority}</span>
                            <span className="sp-tag">{topic.source}</span>
                          </div>
                          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>{topic.title}</h2>
                          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--sp-muted)', lineHeight: 1.55 }}>{topic.reason}</p>
                        </div>
                        <div style={{
                          flexShrink: 0, padding: '10px 14px', borderRadius: 8, textAlign: 'center',
                          background: 'var(--sp-surface)', border: '1px solid var(--sp-border)',
                        }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sp-muted)' }}>Readiness</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--sp-ink)', marginTop: 2 }}>{topic.score}%</p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 8 }}>
                        {topic.subtopics.map(subtopic => {
                          const done = Boolean(completedSubtopics[subtopic.id]);
                          return (
                            <div
                              key={subtopic.id}
                              style={{
                                padding: '14px 14px', borderRadius: 8,
                                background: done ? 'var(--sp-sage-dim)' : 'var(--sp-surface)',
                                border: `1px solid ${done ? 'rgba(74,124,89,0.35)' : 'var(--sp-border)'}`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: done ? 'var(--sp-sage)' : 'var(--sp-ink)', margin: 0 }}>{subtopic.title}</p>
                                  <p style={{ marginTop: 3, fontSize: 12, color: done ? 'rgba(74,124,89,0.75)' : 'var(--sp-muted)', lineHeight: 1.5 }}>{subtopic.objective}</p>
                                </div>
                                {done
                                  ? <CheckCircle size={18} weight="fill" color="var(--sp-sage)" aria-hidden style={{ flexShrink: 0 }} />
                                  : <BookOpen    size={18} weight="bold" color="var(--sp-sage)" aria-hidden style={{ flexShrink: 0 }} />}
                              </div>
                              <button
                                type="button"
                                className={done ? 'sp-btn-secondary' : 'sp-btn-accent'}
                                style={{ width: '100%', height: 36, fontSize: 12, gap: 6 }}
                                onClick={() => done ? undefined : startSession(subtopic)}
                                disabled={done}
                              >
                                {done ? 'Notebook saved' : 'Start 10-min session'}
                                {done ? <Notebook size={13} weight="bold" aria-hidden /> : <Play size={13} weight="bold" aria-hidden />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT SIDEBAR */}
          <aside style={{ position: 'sticky', top: 76, alignSelf: 'start', display: 'grid', gap: 12 }}>
            {/* Gap summary */}
            <div className="sp-card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-ink)', margin: '0 0 14px' }}>Gap summary</h2>
              <div style={{ display: 'grid', gap: 6 }}>
                {([
                  ['Candidate',    profile.name],
                  ['OA score',     `${skillResult.score}% (${skillResult.level.replace('_', ' ')})`],
                  ['Chatbot score', chatSession?.aggregate ? `${chatSession.aggregate.score}% (${chatSession.aggregate.level.replace('_', ' ')})` : 'Skipped'],
                  ['Roadmap load', `${roadmap.length} topics, ${totalSubtopics} subtopics`],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sp-muted)' }}>{label}</p>
                    <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: 'var(--sp-ink)' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Proctoring status */}
            <div className="sp-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <LockKey size={16} weight="bold" color="var(--sp-muted)" aria-hidden />
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>Session proctoring</p>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {[
                  { label: 'Camera',           ok: access.cameraGranted },
                  { label: 'Microphone',        ok: access.microphoneGranted },
                  { label: 'Screen + fullscreen',ok: access.screenGranted && access.fullscreenGranted },
                ].map(({ label, ok }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sp-body)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ok ? 'var(--sp-sage)' : 'var(--sp-ghost)' }}>{ok ? 'Active' : 'Missing'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notebooks */}
            <div className="sp-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Notebook size={16} weight="bold" color="var(--sp-muted)" aria-hidden />
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>Notebooks</p>
              </div>
              {notebooks.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {notebooks.map(entry => (
                    <article key={entry.id} style={{ padding: 12, borderRadius: 8, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--sp-ink)' }}>{entry.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--sp-muted)', marginTop: 2 }}>{entry.skill} &middot; {entry.completedAt}</p>
                      <ul style={{ marginTop: 6, paddingLeft: 16, display: 'grid', gap: 3 }}>
                        {entry.notes.slice(0, 3).map(note => (
                          <li key={note} style={{ fontSize: 12, color: 'var(--sp-body)', lineHeight: 1.5 }}>{note}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--sp-muted)', padding: '10px 0' }}>Completed sessions appear here.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── Lesson Session ── */

function LessonSession({
  subtopic, phase, messages, answer, secondsLeft, warningCount,
  onAnswerChange, onSubmit, onExit, onCloseCompleted, formatTime,
}: {
  subtopic: RoadmapSubtopic; phase: LessonPhase; messages: LessonMessage[];
  answer: string; secondsLeft: number; warningCount: number;
  onAnswerChange: (v: string) => void; onSubmit: () => void;
  onExit: () => void; onCloseCompleted: () => void;
  formatTime: (s: number) => string;
}) {
  const dangerTime = phase !== 'completed' && secondsLeft <= 120;
  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Session metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { Icon: ChatCircleText, label: 'Session',   value: subtopic.skill,                  danger: false },
          { Icon: Clock,          label: 'Time left', value: phase === 'completed' ? 'Saved' : formatTime(secondsLeft), danger: dangerTime },
          { Icon: ShieldWarning,  label: 'Warnings',  value: `${warningCount}/${LESSON_WARNING_LIMIT}`, danger: warningCount > 0 },
        ].map(({ Icon, label, value, danger }) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
              background: danger ? 'var(--sp-danger-dim)' : 'var(--sp-panel)',
              border: `1px solid ${danger ? 'rgba(139,45,45,0.2)' : 'var(--sp-border)'}`,
            }}
          >
            <div style={{
              display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 7, flexShrink: 0,
              background: danger ? 'rgba(139,45,45,0.12)' : 'var(--sp-sage-dim)',
              color: danger ? 'var(--sp-danger)' : 'var(--sp-sage)',
            }}>
              <Icon size={14} weight="bold" aria-hidden />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: danger ? 'var(--sp-danger)' : 'var(--sp-muted)' }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: danger ? 'var(--sp-danger)' : 'var(--sp-ink)', marginTop: 1 }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chat panel */}
      <div style={{ borderRadius: 10, border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--sp-border)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>{subtopic.title}</p>
            <p style={{ fontSize: 12, color: 'var(--sp-muted)', marginTop: 2 }}>10-minute proctored session</p>
          </div>
          <button
            type="button"
            className="sp-btn-secondary"
            style={{ height: 34, padding: '0 12px', fontSize: 12, gap: 6 }}
            onClick={phase === 'completed' ? onCloseCompleted : onExit}
          >
            {phase === 'completed' ? 'Close' : 'Exit'}
            <X size={12} weight="bold" aria-hidden />
          </button>
        </div>

        {/* Messages */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'candidate' ? 'flex-end' : 'center' }}>
              {msg.role === 'system' ? (
                <div className="sp-bubble-system">{msg.text}</div>
              ) : msg.role === 'candidate' ? (
                <div className="sp-bubble-user">
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.65, marginBottom: 4 }}>You</p>
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{msg.text}</p>
                </div>
              ) : (
                <div className="sp-bubble-bot" style={{ maxWidth: '90%' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sp-sage)', marginBottom: 4 }}>LearnBot</p>
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{msg.text}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--sp-border)', padding: '12px 16px' }}>
          {phase !== 'completed' ? (
            <>
              <textarea
                value={answer}
                onChange={e => onAnswerChange(e.target.value)}
                placeholder="Type your explanation here..."
                style={{ minHeight: 100, fontSize: 14, padding: '12px 14px', borderRadius: 8, resize: 'vertical' }}
              />
              <button
                type="button"
                className="sp-btn-primary"
                style={{ width: '100%', height: 42, marginTop: 10, fontSize: 14 }}
                onClick={onSubmit}
                disabled={answer.trim().length === 0}
              >
                Submit checkpoint
                <PaperPlaneTilt size={15} weight="bold" aria-hidden />
              </button>
            </>
          ) : (
            <div className="sp-notice sp-notice-success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} weight="fill" aria-hidden />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Notebook saved for this subtopic.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
