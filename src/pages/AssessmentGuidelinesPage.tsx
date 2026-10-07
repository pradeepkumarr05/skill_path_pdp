import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowsOut,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  ClipboardText,
  Clock,
  Desktop,
  LockKey,
  Microphone,
  Prohibit,
  ShieldCheck,
  WarningCircle,
  WifiHigh,
} from '@phosphor-icons/react';
import type { ProfileSetupResult } from './ProfileSetupPage';
import type { AssessmentAccessGrant } from '../types/assessment';

interface AssessmentGuidelinesPageProps {
  profile: ProfileSetupResult;
  onBack: () => void;
  onStartChatbot: (access: AssessmentAccessGrant) => void;
  onSkipChatbot: (access: AssessmentAccessGrant) => void;
}

const guidelineItems = [
  { id: 'permissions', title: 'Allow camera access', detail: 'Camera access is required before the chatbot room opens. Microphone is recommended but optional.', icon: Camera },
  { id: 'screen',      title: 'Share your screen', detail: 'Share your entire screen and keep sharing active throughout the assessment.', icon: Desktop },
  { id: 'fullscreen',  title: 'Stay in full-screen', detail: 'Exiting full-screen, stopping the camera, or ending screen sharing terminates the assessment.', icon: ArrowsOut },
  { id: 'switching',   title: 'No tab or window switching', detail: 'Tab hiding, app switching, and focus loss are detected during the chatbot assessment.', icon: WarningCircle },
  { id: 'clipboard',   title: 'Clipboard is blocked', detail: 'Copy, cut, paste, and right-click attempts are prevented and added to the proctor log.', icon: ClipboardText },
  { id: 'environment', title: 'Quiet, well-lit environment', detail: 'Keep your face visible and well lit. Sustained camera obstruction is logged for review.', icon: Microphone },
  { id: 'integrity',   title: 'No external assistance', detail: 'Notes, search engines, AI assistants, phones, and communication apps are not allowed.', icon: Prohibit },
  { id: 'network',     title: 'Stable connection required', detail: 'If the session drops, reconnect immediately from the same device and account.', icon: WifiHigh },
  { id: 'recording',   title: 'Activity is recorded', detail: 'Answers, scores, and proctoring events are stored. Camera frames are processed locally — video is not uploaded.', icon: LockKey },
];

export function AssessmentGuidelinesPage({ profile, onBack, onStartChatbot, onSkipChatbot }: AssessmentGuidelinesPageProps) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const acceptedCount = useMemo(() => Object.values(accepted).filter(Boolean).length, [accepted]);
  const allAccepted = acceptedCount === guidelineItems.length;
  const shouldSkipChatbot = profile.claimedSkills.length === 0;
  const claimedSkills = profile.claimedSkills.length > 0 ? profile.claimedSkills : ['No claimed skills'];

  const toggleAccepted = (id: string) => setAccepted(cur => ({ ...cur, [id]: !cur[id] }));

  const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach(t => t.stop());

  const requestAssessmentAccess = async () => {
    setRequestingAccess(true);
    setAccessError(null);
    let cameraStream: MediaStream | null = null;
    let screenStream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('This browser does not expose the required media APIs.');
      }
      try { cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
      catch { cameraStream = await navigator.mediaDevices.getUserMedia({ video: true }); }
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const surface = screenStream.getVideoTracks()[0]?.getSettings().displaySurface;
      if (surface && surface !== 'monitor') throw new Error('Choose Entire Screen in the sharing dialog, not a window or tab.');
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      const hasCamera     = cameraStream.getVideoTracks().some(t => t.readyState === 'live');
      const hasMicrophone = cameraStream.getAudioTracks().some(t => t.readyState === 'live');
      const hasScreen     = screenStream.getVideoTracks().some(t => t.readyState === 'live');
      if (!hasCamera || !hasScreen || !document.fullscreenElement) throw new Error('Camera, screen share, and full-screen access are required.');
      const grant: AssessmentAccessGrant = { cameraGranted: hasCamera, microphoneGranted: hasMicrophone, screenGranted: hasScreen, fullscreenGranted: true, cameraStream, screenStream };
      shouldSkipChatbot ? onSkipChatbot(grant) : onStartChatbot(grant);
    } catch (err) {
      stopStream(cameraStream); stopStream(screenStream);
      setAccessError(err instanceof Error ? err.message : 'Required assessment access was not granted.');
    } finally {
      setRequestingAccess(false);
    }
  };

  return (
    <div className="sp-page">
      {/* HEADER */}
      <header className="sp-header">
        <span className="sp-logo-script">SkillPath</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted)', marginBottom: 6 }}>
              <span>Guidelines accepted</span>
              <span>{acceptedCount}/{guidelineItems.length}</span>
            </div>
            <div className="sp-progress">
              <div className="sp-progress-fill" style={{ width: `${(acceptedCount / guidelineItems.length) * 100}%` }} />
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
            borderRadius: 999, background: 'var(--sp-panel)', border: '1px solid var(--sp-border)',
            fontSize: 12, fontWeight: 700, color: 'var(--sp-muted)',
          }}>
            Device check
          </span>
        </div>
      </header>

      <div className="sp-content">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0,1fr) minmax(280px,340px)' }}>

          {/* LEFT */}
          <section style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>Assessment preparation</h1>
                <p style={{ marginTop: 6, fontSize: 14, color: 'var(--sp-muted)', maxWidth: 480 }}>
                  Review the conditions, then allow the required devices to begin.
                </p>
              </div>
              <button type="button" className="sp-btn-secondary" onClick={onBack} style={{ flexShrink: 0 }}>
                <ArrowLeft size={15} weight="bold" aria-hidden />
                Back
              </button>
            </div>

            {/* Overview metrics */}
            <div className="sp-card" style={{ marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 0 }}>
                {[
                  { Icon: Clock,       label: 'Interview answer time', value: shouldSkipChatbot ? 'Not required' : '45 seconds' },
                  { Icon: ShieldCheck, label: 'First stage', value: shouldSkipChatbot ? 'Knowledge assessment' : 'Technical interview' },
                  { Icon: CheckCircle, label: 'Assessment stages', value: shouldSkipChatbot ? '1 stage' : '2 stages' },
                ].map(({ Icon, label, value }, i) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
                      borderRight: i < 2 ? '1px solid var(--sp-border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 8, background: 'var(--sp-sage-dim)', color: 'var(--sp-sage)', flexShrink: 0 }}>
                      <Icon size={17} weight="bold" aria-hidden />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sp-muted)' }}>{label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--sp-ink)', marginTop: 2 }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Claimed skills */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--sp-border)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--sp-ink)', marginBottom: 10 }}>
                  Skills entering assessment
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {claimedSkills.map(skill => (
                    <span key={skill} className={`sp-tag${profile.claimedSkills.length > 0 ? ' sp-tag-sage' : ''}`}>{skill}</span>
                  ))}
                </div>
                {shouldSkipChatbot && (
                  <p style={{ marginTop: 10, fontSize: 13, color: 'var(--sp-muted)', fontWeight: 500 }}>
                    No claimed skills. The chatbot interview is skipped and the assessment proceeds directly to skill test.
                  </p>
                )}
              </div>
            </div>

            <div className="guideline-list">{guidelineItems.map(({id,title,detail,icon:Icon}) => <article key={id}><Icon size={20} /><div><h2>{title}</h2><p>{detail}</p></div></article>)}</div>
            <label className="guideline-consent"><input type="checkbox" checked={allAccepted} onChange={e=>setAccepted(Object.fromEntries(guidelineItems.map(item=>[item.id,e.target.checked])))} /><span>I have read and agree to the assessment conditions above.</span></label>
          </section>

          {/* RIGHT SIDEBAR */}
          <aside style={{ position: 'sticky', top: 76, alignSelf: 'start' }}>
            <div className="sp-card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-ink)', margin: '0 0 16px' }}>Candidate brief</h2>

              <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
                {([
                  ['Candidate',  profile.name],
                  ['Domain',     profile.domain],
                  ['Roles',      profile.interestedRoles.join(', ') || 'None'],
                  ['Resume',     profile.resumeFileName ?? 'Not uploaded'],
                  ['Transcript', profile.transcriptFileName ?? 'Not uploaded'],
                ] as [string, string][]).map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: 'var(--sp-panel)', border: '1px solid var(--sp-border)',
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sp-muted)' }}>{label}</p>
                    <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: 'var(--sp-ink)', overflowWrap: 'anywhere' }}>{value}</p>
                  </div>
                ))}
              </div>

              {!allAccepted && (
                <div className="sp-notice sp-notice-warn" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  <WarningCircle size={15} weight="bold" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                  <span style={{ fontSize: 13 }}>Accept all {guidelineItems.length} guidelines to continue.</span>
                </div>
              )}

              {accessError && (
                <div className="sp-notice sp-notice-danger" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  <WarningCircle size={15} weight="bold" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                  <span style={{ fontSize: 13 }}>{accessError}</span>
                </div>
              )}

              <button
                type="button"
                className="sp-btn-primary"
                style={{ width: '100%', height: 44, fontSize: 14 }}
                disabled={!allAccepted || requestingAccess}
                onClick={requestAssessmentAccess}
              >
                {requestingAccess
                  ? 'Requesting access...'
                  : shouldSkipChatbot
                    ? 'Continue to skill assessment'
                    : 'Start assessment'}
                <ArrowRight size={15} weight="bold" aria-hidden />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
