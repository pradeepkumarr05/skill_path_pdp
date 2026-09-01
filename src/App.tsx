import { useCallback, useEffect, useState } from 'react';
import { AssessmentGuidelinesPage } from './pages/AssessmentGuidelinesPage';
import { LiveChatbotAssessmentPage } from './pages/LiveChatbotAssessmentPage';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage, type ProfileSetupResult } from './pages/ProfileSetupPage';
import { LearningRoadmapPage } from './pages/LearningRoadmapPage';
import { SkillAssessmentPage } from './pages/SkillAssessmentPage';
import { getCurrentUser, saveProfile, type AuthUser } from './api/authApi';
import { profileFromCandidate, resolvePostLoginDestination } from './utils/authSession';
import type { AgenticSession, AssessmentAccessGrant, SkillAssessmentResult } from './types/assessment';

type AppStep = 'login' | 'profile' | 'assessment-guidelines' | 'chatbot-assessment' | 'skill-assessment' | 'learning-roadmap';

const GITHUB_ERROR_MESSAGES: Record<string, string> = {
  denied: 'GitHub sign-in was cancelled.',
  invalid_state: 'That GitHub sign-in link expired. Please try again.',
  email_unverified: 'Your GitHub account needs a verified email address to sign in here.',
  not_configured: 'GitHub sign-in is not available right now.',
  failed: 'Unable to sign in with GitHub right now. Please try again.',
};

export default function App() {
  const [step, setStep] = useState<AppStep>('login');
  const [lastLoginMethod, setLastLoginMethod] = useState<LoginMethod | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileSetupResult | null>(null);
  const [assessmentAccess, setAssessmentAccess] = useState<AssessmentAccessGrant | null>(null);
  const [chatSession, setChatSession] = useState<AgenticSession | null>(null);
  const [skillResult, setSkillResult] = useState<SkillAssessmentResult | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);

  const restoredDashboardAccess: AssessmentAccessGrant = {
    cameraGranted: false,
    microphoneGranted: false,
    screenGranted: false,
    fullscreenGranted: false,
  };

  const routeAuthenticatedUser = useCallback((method: LoginMethod, user: AuthUser) => {
    setAuthUser(user);
    setLastLoginMethod(method);
    setLoginError(null);
    setAuthError(null);

    const savedProfile = profileFromCandidate(user.candidate, user);
    const destination = resolvePostLoginDestination(user);

    if (!savedProfile || destination === 'profile') {
      setProfile(savedProfile);
      setAssessmentAccess(null);
      setChatSession(null);
      setSkillResult(null);
      setStep('profile');
      return;
    }

    setProfile(savedProfile);
    setAssessmentAccess(user.latestSkillResult ? restoredDashboardAccess : null);
    setChatSession(user.latestChatSession ?? null);
    setSkillResult(user.latestSkillResult ?? null);
    setStep(destination);
  }, []);

  // GitHub sign-in is a full-page redirect
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('oauth');

    if (!oauthResult) {
      getCurrentUser()
        .then((result) => {
          if (!cancelled && result?.user) {
            routeAuthenticatedUser('email', result.user);
          }
        })
        .finally(() => {
          if (!cancelled) setRestoringSession(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (oauthResult === 'github_success') {
      getCurrentUser().then((result) => {
        if (cancelled) return;
        if (result?.user) {
          routeAuthenticatedUser('github', result.user);
        } else {
          setLoginError('Unable to sign in with GitHub right now. Please try again.');
        }
      }).finally(() => {
        if (!cancelled) setRestoringSession(false);
      });
    } else if (oauthResult === 'github_error') {
      const reason = params.get('reason') || 'failed';
      setLoginError(GITHUB_ERROR_MESSAGES[reason] || GITHUB_ERROR_MESSAGES.failed);
      setRestoringSession(false);
    }

    window.history.replaceState({}, '', window.location.pathname);
    return () => {
      cancelled = true;
    };
  }, [routeAuthenticatedUser]);

  const handleLoginSuccess = (method: LoginMethod, user: AuthUser) => {
    routeAuthenticatedUser(method, user);
  };

  const handleProfileComplete = async (nextProfile: ProfileSetupResult) => {
    setProfile(nextProfile);
    setAssessmentAccess(null);
    setChatSession(null);
    setSkillResult(null);
    setAuthError(null);

    try {
      const result = await saveProfile(nextProfile);
      setAuthUser(result.user);
      const savedProfile = profileFromCandidate(result.user.candidate, result.user) ?? nextProfile;
      setProfile(savedProfile);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to save profile setup.');
      return;
    }

    setStep('assessment-guidelines');
  };

  const handleStartChatbot = (access: AssessmentAccessGrant) => {
    setAssessmentAccess(access);
    setStep('chatbot-assessment');
  };

  const handleSkipChatbot = (access: AssessmentAccessGrant) => {
    setAssessmentAccess(access);
    setChatSession(null);
    setStep('skill-assessment');
  };

  const handleChatbotComplete = (session: AgenticSession) => {
    setChatSession(session);
    setStep('skill-assessment');
  };

  const handleSkillAssessmentComplete = (result: SkillAssessmentResult) => {
    setSkillResult(result);
    setStep('learning-roadmap');
  };

  return (
    <>
      {restoringSession ? (
        <main className="grid min-h-screen place-items-center bg-skillpath-night p-6 text-skillpath-cream">
          <div className="rounded-lg border border-white/10 bg-white/8 p-6 text-center shadow-panel">
            <p className="text-sm font-black uppercase text-skillpath-teal">SkillPath</p>
            <p className="mt-2 text-lg font-black">Restoring secure session</p>
          </div>
        </main>
      ) : null}

      {authError ? (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-md border border-skillpath-danger bg-white p-3 text-sm font-bold text-skillpath-danger shadow-panel sm:left-auto sm:right-6 sm:w-96">
          <span className="flex-1">API action failed: {authError}</span>
          <button
            type="button"
            className="font-black text-skillpath-muted hover:text-skillpath-night"
            onClick={() => setAuthError(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      {!restoringSession && step === 'login' ? (
        <LoginPage onAuthenticated={handleLoginSuccess} initialError={loginError} />
      ) : null}
      {!restoringSession && step === 'profile' ? (
        <ProfileSetupPage authUser={authUser} initialProfile={profile} lastLoginMethod={lastLoginMethod} onBack={() => setStep('login')} onComplete={(p) => void handleProfileComplete(p)} />
      ) : null}
      {!restoringSession && step === 'assessment-guidelines' && profile ? (
        <AssessmentGuidelinesPage profile={profile} onBack={() => setStep('profile')} onStartChatbot={handleStartChatbot} onSkipChatbot={handleSkipChatbot} />
      ) : null}
      {!restoringSession && step === 'chatbot-assessment' && profile && assessmentAccess ? (
        <LiveChatbotAssessmentPage profile={profile} access={assessmentAccess} onBack={() => setStep('assessment-guidelines')} onComplete={handleChatbotComplete} />
      ) : null}
      {!restoringSession && step === 'skill-assessment' && profile && assessmentAccess ? (
        <SkillAssessmentPage profile={profile} access={assessmentAccess} chatSession={chatSession} onBack={() => setStep('assessment-guidelines')} onComplete={handleSkillAssessmentComplete} />
      ) : null}
      {!restoringSession && step === 'learning-roadmap' && profile && assessmentAccess && skillResult ? (
        <LearningRoadmapPage profile={profile} access={assessmentAccess} chatSession={chatSession} skillResult={skillResult} onBack={() => setStep('skill-assessment')} />
      ) : null}
    </>
  );
}
