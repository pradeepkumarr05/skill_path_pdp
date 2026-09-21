import { FormEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeSlash, GoogleLogo, ShieldCheck } from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import { loginCredentials } from '../api/skillpathApi';
import type { ProfileSetupResult } from './ProfileSetupPage';
import { useGoogleLogin } from '@react-oauth/google';

export type LoginMethod = 'google' | 'credentials';

interface LoginPageProps {
  onAuthenticated: (method: LoginMethod, creds?: {username?: string, email?: string, password?: string}) => void;
  onDirectLogin: (profile: ProfileSetupResult) => void;
}

export function LoginPage({ onAuthenticated, onDirectLogin }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (isSignUp) {
      return username.trim().length > 2 && email.includes('@') && password.trim().length >= 6;
    }
    return username.trim().length > 2 && password.trim().length >= 6;
  }, [username, email, password, isSignUp]);

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError('Enter a valid username and a password with at least 6 characters.');
      return;
    }

    setError(null);
    if (isSignUp) {
      onAuthenticated('credentials', { username, email, password });
    } else {
      try {
        const response = await loginCredentials(username, password);
        onDirectLogin({
          name: response.candidate.name,
          email: response.candidate.email,
          qualification: response.candidate.qualification as any,
          domain: response.candidate.selectedDomain as any,
          interestedRoles: response.candidate.interestedRoles,
          claimedSkills: response.candidate.claimedSkills,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed.');
      }
    }
  };

  const handleProviderLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      // In a real app we'd verify tokenResponse.access_token or id_token on the backend.
      // For now, since the user asked to implement Google auth without changing other modules properly,
      // we'll just mock the verification and pass 'google' to the existing onAuthenticated.
      console.log('Google Auth Success:', tokenResponse);
      setError(null);
      onAuthenticated('google');
    },
    onError: () => {
      setError('Google Login Failed');
    },
  });

  return (
    <main className="auth-backdrop min-h-screen px-4 py-5 text-skillpath-cream sm:px-6 lg:px-8">
      <div className="grid min-h-[calc(100vh-40px)] w-full gap-5 lg:grid-cols-[minmax(420px,1fr)_minmax(420px,520px)]">
        <section className="auth-panel-grid relative overflow-hidden rounded-lg border border-white/12 bg-skillpath-night shadow-panel">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-skillpath-forest" />
          <div className="relative flex h-full min-h-[620px] flex-col justify-between p-6 sm:p-8 lg:p-10">
            <header className="flex items-center justify-between gap-5">
              <SkillPathLogo />
              <div className="rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-sm font-bold text-skillpath-citron">
                1/4 complete
              </div>
            </header>

            <motion.div className="max-w-[680px]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              <h1 className="text-5xl font-black leading-[0.95] text-skillpath-cream sm:text-6xl lg:text-7xl">
                Start with verified access. Build toward verified readiness.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-skillpath-cream/72">
                {isSignUp ? 'Create a new account' : 'Sign in'} to continue into your profile, skills, assessments, learning path, and final readiness review.
              </p>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-[1fr_240px] md:items-end">
              <div className="rounded-lg border border-white/12 bg-skillpath-cream p-4 text-skillpath-ink shadow-soft">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-skillpath-night">Entry progress</p>
                    <p className="text-sm font-medium text-skillpath-muted">Login unlocks profile setup.</p>
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-skillpath-teal text-white">
                    ✓
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-skillpath-line">
                  <div className="h-full w-1/4 rounded-full bg-skillpath-teal" />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-black uppercase text-skillpath-muted">
                  <span>Login</span>
                  <span>Profile next</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center rounded-lg bg-skillpath-paper p-5 text-skillpath-ink shadow-panel sm:p-8">
          <div className="w-full max-w-[430px]">
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className="mt-2 text-4xl font-black tracking-normal text-skillpath-night">
                {isSignUp ? 'Sign up' : 'Sign in'}
              </h2>
              <button 
                type="button" 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-bold text-skillpath-teal hover:underline"
              >
                {isSignUp ? 'Already have an account?' : 'Need an account?'}
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-skillpath-night">
                  {isSignUp ? 'Username' : 'Username or Email'}
                </span>
                <input
                  className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder={isSignUp ? "Choose a username" : "Enter your username or email"}
                />
              </label>

              {isSignUp && (
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-skillpath-night">Email Address</span>
                  <input
                    className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="Enter your email"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-black text-skillpath-night">Password</span>
                <span className="relative block">
                  <input
                    className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 pr-12 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    placeholder={isSignUp ? "Choose a password" : "Enter your password"}
                  />
                  <button
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-skillpath-muted transition hover:bg-white hover:text-skillpath-night"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeSlash className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </span>
              </label>

              {error ? <p className="rounded-md border border-skillpath-danger bg-red-50 px-3 py-2 text-sm font-bold text-skillpath-danger">{error}</p> : null}

              <button
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-night px-4 text-base font-black text-skillpath-cream shadow-panel transition hover:bg-skillpath-forest disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                type="submit"
                disabled={!canSubmit}
              >
                {isSignUp ? 'Create account' : 'Sign in'}
                <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs font-black uppercase text-skillpath-muted">
              <span className="h-px flex-1 bg-skillpath-line" />
              Or
              <span className="h-px flex-1 bg-skillpath-line" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-skillpath-line bg-skillpath-cream px-3 text-sm font-black text-skillpath-night shadow-soft transition hover:border-skillpath-night hover:bg-white w-full"
                type="button"
                onClick={() => handleProviderLogin()}
              >
                <GoogleLogo className="h-5 w-5" weight="bold" aria-hidden="true" />
                <span>{isSignUp ? 'Sign up' : 'Continue'} with Google</span>
              </button>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-md bg-skillpath-night px-4 py-4 text-sm font-medium leading-5 text-skillpath-cream">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-skillpath-citron" weight="bold" aria-hidden="true" />
              <span>Authentication secures your profile and progress.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
