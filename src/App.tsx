import { useEffect, useState } from 'react';
import { AssessmentGuidelinesPage } from './pages/AssessmentGuidelinesPage';
import { LiveChatbotAssessmentPage } from './pages/LiveChatbotAssessmentPage';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage, type ProfileSetupResult } from './pages/ProfileSetupPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { WelcomePage } from './pages/WelcomePage';
import { SkillAssessmentPage } from './pages/SkillAssessmentPage';
import { AuthLayout } from './components/AuthLayout';
import type { AgenticSession, AssessmentAccessGrant, SkillAssessmentResult } from './types/assessment';
import { ApiError, clearToken, currentUser, hasToken, login, logout, type LoginResponse } from './api/skillpathApi';

type Step = 'welcome' | 'login' | 'profile' | 'dashboard' | 'guidelines' | 'chat' | 'skill' | 'roadmap';
type DashboardView = 'home' | 'assessments' | 'roadmap' | 'progress' | 'profile';

export default function App() {
  const [step, setStep] = useState<Step>(() => hasToken() || window.location.hash.startsWith('#auth=') ? 'login' : 'welcome');
  const [loginView, setLoginView] = useState<'signin'|'signup'>('signin');
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [candidate, setCandidate] = useState<LoginResponse['candidate'] | null>(null);
  const [profile, setProfile] = useState<ProfileSetupResult | null>(null);
  const [access, setAccess] = useState<AssessmentAccessGrant | null>(null);
  const [chat, setChat] = useState<AgenticSession | null>(null);
  const [result, setResult] = useState<SkillAssessmentResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>('home');
  const [authLink] = useState(() => window.location.hash.startsWith('#auth='));
  const [restoring, setRestoring] = useState(() => hasToken() && !authLink);
  const [restoreError, setRestoreError] = useState('');

  function authenticated(user: LoginResponse['candidate'], via: LoginMethod = 'credentials') {
    setCandidate(user);
    setMethod(via);
    setProfile({
      name: user.name,
      email: user.email,
      qualification: user.qualification as ProfileSetupResult['qualification'],
      domain: user.selectedDomain as ProfileSetupResult['domain'],
      interestedRoles: user.interestedRoles,
      claimedSkills: user.claimedSkills,
      setup: user.setup,
    });
    setDashboardView('home');
    setStep(!user.emailVerified ? 'login' : user.profileComplete ? 'dashboard' : 'profile');
  }

  useEffect(() => {
    if (!hasToken() || authLink) return;
    let active = true;
    currentUser()
      .then(user => { if (active) authenticated(user); })
      .catch(err => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) clearToken();
        else setRestoreError('We could not restore your session. Check your connection and try again.');
      })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, []);

  useEffect(
    () => () => {
      access?.cameraStream?.getTracks().forEach(track => track.stop());
      access?.screenStream?.getTracks().forEach(track => track.stop());
    },
    [access],
  );

  function leaveAssessment(next: Step) {
    setAccess(null);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setStep(next);
  }

  async function save(next: ProfileSetupResult) {
    setBusy(true);
    setError('');
    try {
      const response = await login(next);
      authenticated(response.candidate, method || 'credentials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
      setCandidate(null);
      setProfile(null);
      setChat(null);
      setResult(null);
      leaveAssessment('welcome');
    } catch {
      setError('Sign out could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (restoring || restoreError) {
    return (
      <AuthLayout>
        <header className="auth-heading">
          <h1>{restoring ? 'Welcome back.' : 'Connection interrupted.'}</h1>
          <p role={restoring ? 'status' : 'alert'}>
            {restoring ? 'Restoring your session...' : restoreError}
          </p>
        </header>
        {restoreError && (
          <button className="auth-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        )}
      </AuthLayout>
    );
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
            background: '#F5E0E0',
            border: '1px solid rgba(139,45,45,0.3)',
            borderRadius: 10,
            color: '#6B2020',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 24px rgba(26,23,20,0.12)',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ color: '#8B2D2D', fontSize: 13, fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}
      {step === 'welcome' && <WelcomePage onEnter={view => { setLoginView(view); setStep('login'); }} />}
      {step === 'login' && (
        <LoginPage
          initialView={loginView}
          onAuthenticated={authenticated}
          pendingCandidate={candidate?.emailVerified ? null : candidate}
          onSignedOut={() => { setCandidate(null); setProfile(null); }}
        />
      )}
      {step === 'profile' && (
        <ProfileSetupPage
          initialEmail={candidate?.email}
          initialProfile={candidate?.profileComplete ? profile || undefined : undefined}
          initialName={candidate?.name}
          saving={busy}
          lastLoginMethod={method}
          onBack={() => { if (candidate?.profileComplete) setStep('dashboard'); else void signOut(); }}
          onComplete={next => void save(next)}
        />
      )}
      {step === 'dashboard' && profile && (
        <WorkspacePage
          profile={profile}
          candidate={candidate}
          initialView={dashboardView}
          onAssessment={() => setStep('guidelines')}
          onProfile={() => setStep('profile')}
          onSignOut={() => { if (!busy) void signOut(); }}
        />
      )}
      {step === 'guidelines' && profile && (
        <AssessmentGuidelinesPage
          profile={profile}
          onBack={() => leaveAssessment('dashboard')}
          onStartChatbot={grant => { setAccess(grant); setStep('chat'); }}
          onSkipChatbot={grant => { setAccess(grant); setChat(null); setStep('skill'); }}
        />
      )}
      {step === 'chat' && profile && access && (
        <LiveChatbotAssessmentPage
          profile={profile}
          access={access}
          onBack={() => leaveAssessment('guidelines')}
          onComplete={session => { setChat(session); setStep('skill'); }}
        />
      )}
      {step === 'skill' && profile && access && (
        <SkillAssessmentPage
          profile={profile}
          access={access}
          chatSession={chat}
          onBack={() => leaveAssessment('guidelines')}
          onComplete={value => {
            setResult(value);
            void currentUser().then(user => setCandidate(user)).catch(() => setError('Your result was saved, but the dashboard could not refresh. Reload to try again.'));
            setDashboardView('roadmap');
            leaveAssessment('dashboard');
          }}
        />
      )}
    </>
  );
}
