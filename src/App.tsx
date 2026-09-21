import { useState } from 'react';
import { AssessmentGuidelinesPage } from './pages/AssessmentGuidelinesPage';
import { LiveChatbotAssessmentPage } from './pages/LiveChatbotAssessmentPage';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage, type ProfileSetupResult } from './pages/ProfileSetupPage';
import { LearningRoadmapPage } from './pages/LearningRoadmapPage';
import { SkillAssessmentPage } from './pages/SkillAssessmentPage';
import type { AgenticSession, AssessmentAccessGrant, SkillAssessmentResult } from './types/assessment';
import { login } from './api/skillpathApi';

type AppStep = 'login' | 'profile' | 'assessment-guidelines' | 'chatbot-assessment' | 'skill-assessment' | 'learning-roadmap';

export default function App() {
  const [step, setStep] = useState<AppStep>('login');
  const [lastLoginMethod, setLastLoginMethod] = useState<LoginMethod | null>(null);
  const [signUpCredentials, setSignUpCredentials] = useState<{username?: string, email?: string, password?: string}>({});
  const [profile, setProfile] = useState<ProfileSetupResult | null>(null);
  const [assessmentAccess, setAssessmentAccess] = useState<AssessmentAccessGrant | null>(null);
  const [chatSession, setChatSession] = useState<AgenticSession | null>(null);
  const [skillResult, setSkillResult] = useState<SkillAssessmentResult | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLoginSuccess = (method: LoginMethod, creds?: {username?: string, email?: string, password?: string}) => {
    setLastLoginMethod(method);
    if (creds) {
      setSignUpCredentials(creds);
    }
    setStep('profile');
  };

  const handleDirectLogin = (nextProfile: ProfileSetupResult) => {
    setProfile(nextProfile);
    setAssessmentAccess(null);
    setChatSession(null);
    setSkillResult(null);
    setAuthError(null);
    setStep('assessment-guidelines');
  };

  const handleProfileComplete = async (nextProfile: ProfileSetupResult) => {
    setProfile(nextProfile);
    setAssessmentAccess(null);
    setChatSession(null);
    setSkillResult(null);
    setAuthError(null);

    // Register / log in the candidate to get a JWT for subsequent API calls.
    // This is a fire-and-forget upsert — if the server is unreachable we still
    // let the user proceed (the API calls themselves will fail gracefully).
    try {
      await login({ ...nextProfile, ...signUpCredentials });
    } catch (err) {
      console.warn('[auth] Login call failed — API may be offline:', err instanceof Error ? err.message : err);
      // Don't block the user flow; show a banner if needed
      setAuthError(err instanceof Error ? err.message : 'Unable to authenticate. Check that the API server is running.');
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
        <LoginPage onAuthenticated={handleLoginSuccess} onDirectLogin={handleDirectLogin} />
      ) : null}
      {step === 'profile' ? (
        <ProfileSetupPage initialEmail={signUpCredentials.email} lastLoginMethod={lastLoginMethod} onBack={() => setStep('login')} onComplete={(p) => void handleProfileComplete(p)} />
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
