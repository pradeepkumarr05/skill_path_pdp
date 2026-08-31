import { useEffect, useState } from 'react';
import { AssessmentGuidelinesPage } from './pages/AssessmentGuidelinesPage';
import { LiveChatbotAssessmentPage } from './pages/LiveChatbotAssessmentPage';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage, type ProfileSetupResult } from './pages/ProfileSetupPage';
import { LearningRoadmapPage } from './pages/LearningRoadmapPage';
import { SkillAssessmentPage } from './pages/SkillAssessmentPage';
import { getCurrentUser, type AuthUser } from './api/authApi';
import { login as loginCandidate } from './api/skillpathApi';
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
  const [profile, setProfile] = useState<ProfileSetupResult | null>(null);
  const [assessmentAccess, setAssessmentAccess] = useState<AssessmentAccessGrant | null>(null);
  const [chatSession, setChatSession] = useState<AgenticSession | null>(null);
  const [skillResult, setSkillResult] = useState<SkillAssessmentResult | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // GitHub sign-in is a full-page redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('oauth');
    if (!oauthResult) return;

    if (oauthResult === 'github_success') {
      getCurrentUser().then((result) => {
        if (result?.user) {
          setLastLoginMethod('github');
          setStep('profile');
        } else {
          setLoginError('Unable to sign in with GitHub right now. Please try again.');
        }
      });
    } else if (oauthResult === 'github_error') {
      const reason = params.get('reason') || 'failed';
      setLoginError(GITHUB_ERROR_MESSAGES[reason] || GITHUB_ERROR_MESSAGES.failed);
    }

    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleLoginSuccess = (method: LoginMethod, _user?: AuthUser) => {
    setLastLoginMethod(method);
    setStep('profile');
  };

  const handleProfileComplete = async (nextProfile: ProfileSetupResult) => {
    setProfile(nextProfile);
    setAssessmentAccess(null);
    setChatSession(null);
    setSkillResult(null);
    setAuthError(null);

    try {
      await loginCandidate(nextProfile);
    } catch (err) {
      console.warn('[auth] Candidate registration warning:', err instanceof Error ? err.message : err);
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
      {authError ? (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-md border border-skillpath-danger bg-white p-3 text-sm font-bold text-skillpath-danger shadow-panel sm:left-auto sm:right-6 sm:w-96">
          <span className="flex-1">⚠ API offline: {authError}</span>
          <button
            type="button"
            className="font-black text-skillpath-muted hover:text-skillpath-night"
            onClick={() => setAuthError(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      {step === 'login' ? (
        <LoginPage onAuthenticated={handleLoginSuccess} initialError={loginError} />
      ) : null}
      {step === 'profile' ? (
        <ProfileSetupPage lastLoginMethod={lastLoginMethod} onBack={() => setStep('login')} onComplete={(p) => void handleProfileComplete(p)} />
      ) : null}
      {step === 'assessment-guidelines' && profile ? (
        <AssessmentGuidelinesPage profile={profile} onBack={() => setStep('profile')} onStartChatbot={handleStartChatbot} onSkipChatbot={handleSkipChatbot} />
      ) : null}
      {step === 'chatbot-assessment' && profile && assessmentAccess ? (
        <LiveChatbotAssessmentPage profile={profile} access={assessmentAccess} onBack={() => setStep('assessment-guidelines')} onComplete={handleChatbotComplete} />
      ) : null}
      {step === 'skill-assessment' && profile && assessmentAccess ? (
        <SkillAssessmentPage profile={profile} access={assessmentAccess} chatSession={chatSession} onBack={() => setStep('assessment-guidelines')} onComplete={handleSkillAssessmentComplete} />
      ) : null}
      {step === 'learning-roadmap' && profile && assessmentAccess && skillResult ? (
        <LearningRoadmapPage profile={profile} access={assessmentAccess} chatSession={chatSession} skillResult={skillResult} onBack={() => setStep('skill-assessment')} />
      ) : null}
    </>
  );
}

