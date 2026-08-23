import { FormEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChartLineUp,
  CheckCircle,
  Eye,
  EyeSlash,
  GithubLogo,
  GoogleLogo,
  ShieldCheck,
  Target,
  UserFocus,
} from '@phosphor-icons/react';

export type LoginMethod = 'email' | 'google' | 'github' | 'leetcode';

interface LoginPageProps {
  onAuthenticated: (method: LoginMethod) => void;
}

const providerButtons: Array<{ method: LoginMethod; label: string; icon: 'google' | 'github' | 'leetcode' }> = [
  { method: 'google', label: 'Google', icon: 'google' },
  { method: 'github', label: 'GitHub', icon: 'github' },
  { method: 'leetcode', label: 'LeetCode', icon: 'leetcode' },
];

function SkillPathLogo() {
  return (
    <svg className="h-12 w-[170px]" viewBox="0 0 170 48" role="img" aria-label="SkillPath">
      <text className="logo-script fill-skillpath-cream text-[34px] font-semibold" x="2" y="34">
        SkillPath
      </text>
      <path d="M12 40 C45 45, 91 44, 154 37" fill="none" stroke="#D7FF4F" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function ProviderIcon({ icon }: { icon: 'google' | 'github' | 'leetcode' }) {
  if (icon === 'github') {
    return <GithubLogo className="h-5 w-5" weight="fill" aria-hidden="true" />;
  }

  if (icon === 'leetcode') {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-sm bg-skillpath-night text-[11px] font-black text-skillpath-citron" aria-hidden="true">
        LC
      </span>
    );
  }

  return <GoogleLogo className="h-5 w-5" weight="bold" aria-hidden="true" />;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [email, setEmail] = useState('candidate@skillpath.com');
  const [password, setPassword] = useState('skillpath24');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.trim().length > 3 && password.trim().length >= 8, [email, password]);

  const handleEmailLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError('Enter a valid email and a password with at least 8 characters.');
      return;
    }

    setError(null);
    onAuthenticated('email');
  };

  const handleProviderLogin = (method: LoginMethod) => {
    setError(null);
    onAuthenticated(method);
  };

  return (
    <main className="auth-backdrop min-h-screen px-4 py-5 text-skillpath-cream sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-5 lg:grid-cols-[minmax(420px,0.9fr)_minmax(420px,0.7fr)]">
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
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-skillpath-citron px-3 py-1.5 text-sm font-black text-skillpath-night">
                <UserFocus className="h-4 w-4" weight="bold" aria-hidden="true" />
                Secure entry
              </p>
              <h1 className="text-5xl font-black leading-[0.95] text-skillpath-cream sm:text-6xl lg:text-7xl">
                Start with verified access. Build toward verified readiness.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-skillpath-cream/72">
                Sign in to continue into your profile, skills, assessments, learning path, and final readiness review.
              </p>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-[1fr_240px] md:items-end">
              <div className="rounded-lg border border-white/12 bg-skillpath-cream p-4 text-skillpath-ink shadow-soft">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-skillpath-night">Entry progress</p>
                    <p className="text-sm font-medium text-skillpath-muted">Account access is the first required gate.</p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-skillpath-teal" weight="fill" aria-hidden="true" />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-skillpath-line">
                  <div className="h-full w-1/4 rounded-full bg-skillpath-teal" />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-black uppercase text-skillpath-muted">
                  <span>Login</span>
                  <span>Profile next</span>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-lg bg-skillpath-vermilion p-4 text-white shadow-soft">
                  <Target className="mb-3 h-6 w-6" weight="bold" aria-hidden="true" />
                  <p className="text-sm font-black">Readiness gate</p>
                </div>
                <div className="rounded-lg bg-skillpath-citron p-4 text-skillpath-night shadow-soft">
                  <ChartLineUp className="mb-3 h-6 w-6" weight="bold" aria-hidden="true" />
                  <p className="text-sm font-black">Evidence trail</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center rounded-lg bg-skillpath-paper p-5 text-skillpath-ink shadow-panel sm:p-8">
          <div className="w-full max-w-[430px]">
            <div className="mb-8">
              <p className="text-sm font-black uppercase text-skillpath-teal">Account access</p>
              <h2 className="mt-2 text-4xl font-black tracking-normal text-skillpath-night">Sign in</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {providerButtons.map((provider) => (
                <button
                  key={provider.method}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-skillpath-line bg-skillpath-cream px-3 text-sm font-black text-skillpath-night shadow-soft transition hover:border-skillpath-night hover:bg-white"
                  type="button"
                  onClick={() => handleProviderLogin(provider.method)}
                >
                  <ProviderIcon icon={provider.icon} />
                  <span className="hidden sm:inline">{provider.label}</span>
                </button>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3 text-xs font-black uppercase text-skillpath-muted">
              <span className="h-px flex-1 bg-skillpath-line" />
              Email
              <span className="h-px flex-1 bg-skillpath-line" />
            </div>

            <form className="space-y-4" onSubmit={handleEmailLogin}>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-skillpath-night">Email address</span>
                <input
                  className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-skillpath-night">Password</span>
                <span className="relative block">
                  <input
                    className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 pr-12 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
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

              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 font-bold text-skillpath-muted">
                  <input
                    className="h-4 w-4 rounded border-skillpath-line accent-skillpath-teal"
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(event) => setRememberDevice(event.target.checked)}
                  />
                  Keep me signed in
                </label>
                <button className="text-left font-black text-skillpath-night underline decoration-skillpath-teal decoration-2 underline-offset-4 hover:text-skillpath-teal" type="button">
                  Forgot password?
                </button>
              </div>

              {error ? <p className="rounded-md border border-skillpath-danger bg-red-50 px-3 py-2 text-sm font-bold text-skillpath-danger">{error}</p> : null}

              <button
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-night px-4 text-base font-black text-skillpath-cream shadow-panel transition hover:bg-skillpath-forest disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                type="submit"
                disabled={!canSubmit}
              >
                Continue
                <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
              </button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-md bg-skillpath-night px-4 py-4 text-sm font-medium leading-5 text-skillpath-cream">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-skillpath-citron" weight="bold" aria-hidden="true" />
              <span>Provider and email sign-in continue to Profile Setup.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
