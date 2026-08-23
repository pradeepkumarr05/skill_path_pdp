import { useState } from 'react';
import { LoginPage, type LoginMethod } from './pages/LoginPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';

type AppStep = 'login' | 'profile';

export default function App() {
  const [step, setStep] = useState<AppStep>('login');
  const [lastLoginMethod, setLastLoginMethod] = useState<LoginMethod | null>(null);

  const handleLoginSuccess = (method: LoginMethod) => {
    setLastLoginMethod(method);
    setStep('profile');
  };

  return (
    <>
      {step === 'login' ? (
        <LoginPage onAuthenticated={handleLoginSuccess} />
      ) : (
        <ProfileSetupPage lastLoginMethod={lastLoginMethod} onBack={() => setStep('login')} />
      )}
    </>
  );
}
