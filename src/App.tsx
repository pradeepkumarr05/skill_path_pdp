import { useState } from 'react';
import { AssessmentGuidelinesPage } from './pages/AssessmentGuidelinesPage';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage, type ProfileSetupResult } from './pages/ProfileSetupPage';

type AppStep = 'login' | 'profile' | 'assessment-guidelines';

export default function App() {
  const [step, setStep] = useState<AppStep>('login');
  const [lastLoginMethod, setLastLoginMethod] = useState<LoginMethod | null>(null);
  const [profile, setProfile] = useState<ProfileSetupResult | null>(null);

  const handleLoginSuccess = (method: LoginMethod) => {
    setLastLoginMethod(method);
    setStep('profile');
  };

  const handleProfileComplete = (nextProfile: ProfileSetupResult) => {
    setProfile(nextProfile);
    setStep('assessment-guidelines');
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
        <AssessmentGuidelinesPage profile={profile} onBack={() => setStep('profile')} />
      ) : null}
    </>
  );
}
