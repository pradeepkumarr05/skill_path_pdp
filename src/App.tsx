import { useEffect, useState } from 'react';
import { AssessmentGuidelinesPage } from './pages/AssessmentGuidelinesPage';
import { LiveChatbotAssessmentPage } from './pages/LiveChatbotAssessmentPage';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage, type ProfileSetupResult } from './pages/ProfileSetupPage';
import { LearningRoadmapPage } from './pages/LearningRoadmapPage';
import { SkillAssessmentPage } from './pages/SkillAssessmentPage';
import { SkillPathLogo } from './components/SkillPathLogo';
import type { AgenticSession, AssessmentAccessGrant, SkillAssessmentResult } from './types/assessment';
import { currentUser, hasToken, login, logout, type LoginResponse } from './api/skillpathApi';

type Step = 'login' | 'profile' | 'dashboard' | 'guidelines' | 'chat' | 'skill' | 'roadmap';
type DashboardView = 'home' | 'assessments' | 'roadmap' | 'progress' | 'profile';
export default function App() {
  const [step, setStep] = useState<Step>('login');
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [candidate, setCandidate] = useState<LoginResponse['candidate'] | null>(null);
  const [profile, setProfile] = useState<ProfileSetupResult | null>(null);
  const [access, setAccess] = useState<AssessmentAccessGrant | null>(null);
  const [chat, setChat] = useState<AgenticSession | null>(null);
  const [result, setResult] = useState<SkillAssessmentResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>('home');
  const [restoring, setRestoring] = useState(hasToken);
  function authenticated(user: LoginResponse['candidate'], via: LoginMethod = 'credentials') {
    setCandidate(user); setMethod(via);
    setProfile({ name: user.name, email: user.email, qualification: user.qualification as ProfileSetupResult['qualification'],
      domain: user.selectedDomain as ProfileSetupResult['domain'], interestedRoles: user.interestedRoles, claimedSkills: user.claimedSkills, setup: user.setup });
    setDashboardView('home'); setStep(user.profileComplete ? 'dashboard' : 'profile');
  }
  useEffect(() => {
    if (!hasToken()) return;
    let active = true;
    currentUser().then(user => { if (active) authenticated(user); }).catch(() => { if (active) logout(); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => { access?.cameraStream?.getTracks().forEach(track => track.stop()); access?.screenStream?.getTracks().forEach(track => track.stop()); }, [access]);
  function leaveAssessment(next: Step) { setAccess(null); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); setStep(next); }
  async function save(next: ProfileSetupResult) {
    setBusy(true); setError('');
    try { const response = await login(next); authenticated(response.candidate, method || 'credentials'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save profile.'); }
    finally { setBusy(false); }
  }
  if (restoring) return <main className="min-h-screen bg-skillpath-night p-8 text-white" role="status">Restoring your session...</main>;
  return <>
    {error && <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 rounded-md bg-red-950 p-4 text-white">{error}<button className="ml-4 underline" onClick={() => setError('')}>Dismiss</button></div>}
    {step === 'login' && <LoginPage onAuthenticated={authenticated} />}
    {step === 'profile' && <ProfileSetupPage initialEmail={candidate?.email} initialProfile={candidate?.profileComplete ? profile || undefined : undefined} initialName={candidate?.name} saving={busy} lastLoginMethod={method} onBack={() => { if (candidate?.profileComplete) setStep('dashboard'); else { logout(); setStep('login'); } }} onComplete={next => void save(next)} />}
    {step === 'dashboard' && profile && <Dashboard profile={profile} candidate={candidate} view={dashboardView} onView={setDashboardView} onAssessment={() => candidate?.latestResult ? setDashboardView('assessments') : setStep('guidelines')} onProfile={() => setStep('profile')} onSignOut={() => { logout(); setCandidate(null); setProfile(null); setStep('login'); }} />}
    {step === 'guidelines' && profile && <AssessmentGuidelinesPage profile={profile} onBack={() => leaveAssessment('dashboard')} onStartChatbot={grant => { setAccess(grant); setStep('chat'); }} onSkipChatbot={grant => { setAccess(grant); setChat(null); setStep('skill'); }} />}
    {step === 'chat' && profile && access && <LiveChatbotAssessmentPage profile={profile} access={access} onBack={() => leaveAssessment('guidelines')} onComplete={session => { setChat(session); setStep('skill'); }} />}
    {step === 'skill' && profile && access && <SkillAssessmentPage profile={profile} access={access} chatSession={chat} onBack={() => leaveAssessment('guidelines')} onComplete={value => { setResult(value); void currentUser().then(user => setCandidate(user)); setStep('roadmap'); }} />}
    {step === 'roadmap' && profile && access && result && <LearningRoadmapPage profile={profile} access={access} chatSession={chat} skillResult={result} onBack={() => leaveAssessment('dashboard')} />}
  </>;
}

function Dashboard({ profile, candidate, view, onView, onAssessment, onProfile, onSignOut }: { profile: ProfileSetupResult; candidate: LoginResponse['candidate'] | null; view: DashboardView; onView: (view: DashboardView) => void; onAssessment: () => void; onProfile: () => void; onSignOut: () => void }) {
  const nav = [{ id: 'home', label: 'Home' }, { id: 'assessments', label: 'Assessments' }, { id: 'roadmap', label: 'Learning roadmap' }, { id: 'progress', label: 'Progress tracker' }, { id: 'profile', label: 'Profile' }] as const;
  const history = candidate?.assessmentHistory || [];
  const resultsView = view === 'assessments';
  return <main className="min-h-screen bg-skillpath-night text-skillpath-cream"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 px-6 py-5"><SkillPathLogo /><nav className="flex flex-wrap gap-2" aria-label="Workspace navigation">{nav.map(item => <a key={item.id} href={`#${item.id}`} onClick={event => { event.preventDefault(); item.id === 'profile' ? onProfile() : onView(item.id); }} className={`rounded-md px-3 py-2 text-sm font-bold ${view === item.id ? 'bg-skillpath-citron text-skillpath-night' : 'text-skillpath-cream/70 hover:bg-white/10 hover:text-white'}`}>{item.label}</a>)}<button onClick={onSignOut} className="px-3 py-2 text-sm font-bold text-skillpath-cream/60 hover:text-white">Sign out</button></nav></header><section className="mx-auto max-w-6xl px-6 py-10"><p className="text-sm font-bold uppercase tracking-[0.14em] text-skillpath-teal">SkillPath AI workspace</p><h1 className="mt-3 text-3xl font-bold">{view === 'home' ? 'Learning Gap Engine' : view === 'roadmap' ? 'Gap analysis and learning roadmap' : nav.find(item => item.id === view)?.label}</h1><p className="mt-3 text-lg">Welcome back, {profile.name.split(' ')[0]}.</p>{view === 'home' ? <section className="mt-10 border-y border-white/15 py-7"><h2 className="text-xl font-bold">Your workspace</h2><p className="mt-3 text-skillpath-cream/70">{profile.domain}</p><p className="mt-2 text-sm text-skillpath-cream/70">Use the navigation to review assessments, gap analysis, progress, and profile details.</p><button className="mt-6 rounded-md bg-skillpath-citron px-5 py-3 font-bold text-skillpath-night" onClick={onAssessment}>{candidate?.latestResult ? 'View assessment results' : 'Start assessment'}</button></section> : resultsView ? <section className="mt-10 space-y-4"><div className="border-y border-white/15 py-7"><h2 className="text-xl font-bold">Assessment results</h2>{candidate?.latestResult ? <p className="mt-3 text-lg font-bold">Latest deterministic result: {candidate.latestResult.score}% · {candidate.latestResult.correct_count}/{candidate.latestResult.total} correct</p> : <p className="mt-3 text-skillpath-cream/70">No completed assessment yet.</p>}</div>{history.length ? <div className="border-y border-white/15 py-7"><h2 className="text-xl font-bold">Session history</h2><div className="mt-4 space-y-3">{history.map(item => <div key={`${item.type}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 border border-white/15 p-4"><div><p className="font-bold">{item.type === 'chatbot' ? 'AI chatbot assessment' : 'Deterministic skills assessment'}</p><p className="mt-1 text-sm text-skillpath-cream/60">{new Date(item.createdAt).toLocaleString()} · {item.status}</p></div><p className="font-bold">{item.score !== undefined && item.score !== null ? `${item.score}%` : item.aggregate ? `${item.aggregate.score}%` : 'Session saved'}</p></div>)}</div></div> : null}</section> : view === 'roadmap' ? <section className="mt-10 border-y border-white/15 py-10"><h2 className="text-xl font-bold">Gap analysis</h2><p className="mt-3 max-w-2xl text-skillpath-cream/70">Your assessment results are saved. This is the learning roadmap destination for your identified gaps and next actions.</p>{candidate?.latestResult && <p className="mt-4 text-lg font-bold">Current readiness: {candidate.latestResult.score}% · {candidate.latestResult.level}</p>}</section> : view === 'progress' ? <section className="mt-10 border-y border-white/15 py-10"><h2 className="text-xl font-bold">Progress tracker</h2><p className="mt-3 max-w-2xl text-skillpath-cream/70">Completed assessment sessions and scores are retained in your history.</p><p className="mt-4 text-lg font-bold">{history.filter(item => item.status === 'completed' || item.status === 'submitted').length} completed sessions</p></section> : <section className="mt-10 border-y border-white/15 py-10"><h2 className="text-xl font-bold">Profile settings</h2><p className="mt-3 max-w-2xl text-skillpath-cream/70">Review and update the profile information used by your assessments.</p><button className="mt-6 rounded-md border border-white/20 px-5 py-3 font-bold" onClick={onProfile}>Open profile setup</button></section>}</section></main>;
}
