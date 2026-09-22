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
  const [restoring, setRestoring] = useState(hasToken);
  function authenticated(user: LoginResponse['candidate'], via: LoginMethod = 'credentials') {
    setCandidate(user); setMethod(via);
    setProfile({ name: user.name, email: user.email, qualification: user.qualification as ProfileSetupResult['qualification'],
      domain: user.selectedDomain as ProfileSetupResult['domain'], interestedRoles: user.interestedRoles, claimedSkills: user.claimedSkills, setup: user.setup });
    setStep(user.profileComplete ? 'dashboard' : 'profile');
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
    {step === 'dashboard' && profile && <main className="min-h-screen bg-skillpath-night text-skillpath-cream">
      <header className="flex items-center justify-between border-b border-white/15 px-6 py-5"><SkillPathLogo /><button onClick={() => { logout(); setCandidate(null); setProfile(null); setStep('login'); }} className="text-sm font-bold">Sign out</button></header>
      <section className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-3xl font-bold">Learning Gap Engine</h1><p className="mt-3 text-lg">Welcome back, {profile.name.split(' ')[0]}.</p>
        <div className="mt-10 border-y border-white/15 py-7"><h2 className="text-xl font-bold">Your assessments</h2><p className="mt-3 text-skillpath-cream/70">{profile.domain}</p><p className="mt-2 text-sm text-skillpath-cream/70">Complete your assessments to build your learning plan.</p>
          {candidate?.latestResult && <p className="mt-4 text-lg font-bold">Latest result: {candidate.latestResult.score}% · {candidate.latestResult.correct_count}/{candidate.latestResult.total} correct</p>}
          <button className="mt-6 rounded-md bg-skillpath-citron px-5 py-3 font-bold text-skillpath-night" onClick={() => setStep('guidelines')}>Start assessment</button><button className="ml-5 text-sm underline" onClick={() => setStep('profile')}>Edit profile</button></div>
      </section></main>}
    {step === 'guidelines' && profile && <AssessmentGuidelinesPage profile={profile} onBack={() => leaveAssessment('dashboard')} onStartChatbot={grant => { setAccess(grant); setStep('chat'); }} onSkipChatbot={grant => { setAccess(grant); setChat(null); setStep('skill'); }} />}
    {step === 'chat' && profile && access && <LiveChatbotAssessmentPage profile={profile} access={access} onBack={() => leaveAssessment('guidelines')} onComplete={session => { setChat(session); setStep('skill'); }} />}
    {step === 'skill' && profile && access && <SkillAssessmentPage profile={profile} access={access} chatSession={chat} onBack={() => leaveAssessment('guidelines')} onComplete={value => { setResult(value); setStep('roadmap'); }} />}
    {step === 'roadmap' && profile && access && result && <LearningRoadmapPage profile={profile} access={access} chatSession={chat} skillResult={result} onBack={() => leaveAssessment('dashboard')} />}
  </>;
}
