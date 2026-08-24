import { useState } from 'react';
import { AssessmentGuidelinesPage } from './pages/AssessmentGuidelinesPage';
import { LiveChatbotAssessmentPage } from './pages/LiveChatbotAssessmentPage';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage, type ProfileSetupResult } from './pages/ProfileSetupPage';
import { LearningRoadmapPage } from './pages/LearningRoadmapPage';
import { SkillAssessmentPage } from './pages/SkillAssessmentPage';
import type { AgenticSession, AssessmentAccessGrant, SkillAssessmentResult } from './types/assessment';

type AppStep = 'login' | 'profile' | 'assessment-guidelines' | 'chatbot-assessment' | 'skill-assessment' | 'learning-roadmap';

export default function App() {
  const [step, setStep] = useState<AppStep>('login');
  const [lastLoginMethod, setLastLoginMethod] = useState<LoginMethod | null>(null);
  const [profile, setProfile] = useState<ProfileSetupResult | null>(null);
  const [assessmentAccess, setAssessmentAccess] = useState<AssessmentAccessGrant | null>(null);
  const [chatSession, setChatSession] = useState<AgenticSession | null>(null);
  const [skillResult, setSkillResult] = useState<SkillAssessmentResult | null>(null);

  const handleLoginSuccess = (method: LoginMethod) => {
    setLastLoginMethod(method);
    setStep('profile');
  };

  const handleProfileComplete = (nextProfile: ProfileSetupResult) => {
    setProfile(nextProfile);
    setAssessmentAccess(null);
    setChatSession(null);
    setSkillResult(null);
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
      {step === 'login' ? (
        <LoginPage onAuthenticated={handleLoginSuccess} />
      ) : null}
      {step === 'profile' ? (
        <ProfileSetupPage lastLoginMethod={lastLoginMethod} onBack={() => setStep('login')} onComplete={handleProfileComplete} />
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
