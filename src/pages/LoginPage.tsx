import { FormEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Github, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

export type LoginMethod = 'email' | 'google' | 'github' | 'leetcode';

interface LoginPageProps {
  onAuthenticated: (method: LoginMethod) => void;
}

const pathwaySteps = [
  { id: '01', title: 'Secure entry', state: 'Current' },
  { id: '02', title: 'Profile setup', state: 'Next' },
  { id: '03', title: 'Skill selection', state: 'Locked' },
  { id: '04', title: 'Assessment', state: 'Locked' },
];

const providerButtons: Array<{ method: LoginMethod; label: string; icon: 'google' | 'github' | 'leetcode' }> = [
  { method: 'google', label: 'Continue with Google', icon: 'google' },
  { method: 'github', label: 'Continue with GitHub', icon: 'github' },
  { method: 'leetcode', label: 'Continue with LeetCode', icon: 'leetcode' },
];

function ProviderIcon({ icon }: { icon: 'google' | 'github' | 'leetcode' }) {
  if (icon === 'github') {
    return <Github className="h-4 w-4" aria-hidden="true" />;
  }

  if (icon === 'leetcode') {
    return (
      <span className="grid h-5 w-5 place-items-center rounded bg-skillpath-ink text-[10px] font-bold text-white" aria-hidden="true">
        L
      </span>
    );
  }

  return (
    <span className="relative h-5 w-5" aria-hidden="true">
      <span className="absolute left-0 top-0 h-2.5 w-2.5 rounded-tl-full bg-[#4285F4]" />
      <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-tr-full bg-[#DB4437]" />
      <span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-bl-full bg-[#F4B400]" />
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-br-full bg-[#0F9D58]" />
      <span className="absolute left-[6px] top-[6px] h-2 w-2 rounded-full bg-white" />
    </span>
  );
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [email, setEmail] = useState('candidate@skillpath.dev');
  const [password, setPassword] = useState('prototype123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.trim().length > 3 && password.trim().length >= 8, [email, password]);

  const handleEmailLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError('Use a valid email and at least 8 characters for the password.');
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
    <main className="auth-backdrop min-h-screen px-4 py-5 text-skillpath-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-6 lg:grid-cols-[minmax(420px,0.92fr)_minmax(420px,0.72fr)] lg:items-stretch">
        <section className="signal-grid relative overflow-hidden rounded-lg border border-skillpath-line bg-skillpath-paper shadow-panel">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-skillpath-jade via-skillpath-saffron to-skillpath-copper" />
          <div className="relative flex h-full min-h-[520px] flex-col justify-between p-6 sm:p-8 lg:p-10">
            <div>
              <div className="mb-10 inline-flex items-center gap-3 rounded-md border border-skillpath-line bg-white/88 px-3 py-2 shadow-soft">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-skillpath-pine text-sm font-bold text-white">SP</span>
                <span>
                  <span className="block text-sm font-semibold">SkillPath</span>
                  <span className="block text-xs text-skillpath-muted">Readiness prototype</span>
                </span>
              </div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
                <p className="mb-3 text-sm font-semibold uppercase text-skillpath-jade">Step 1 of 8</p>
                <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-skillpath-pine sm:text-5xl">
                  Sign in to begin your industry readiness path.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-skillpath-muted">
                  SkillPath starts with verified access, then moves through profile setup, skill selection, assessment, learning, and final review.
                </p>
              </motion.div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-[210px_minmax(0,1fr)] md:items-end">
              <div className="rounded-lg border border-skillpath-line bg-white/92 p-4 shadow-soft">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-skillpath-pine">
                  <ShieldCheck className="h-4 w-4 text-skillpath-jade" aria-hidden="true" />
                  Session status
                </div>
                <div className="space-y-3 text-sm text-skillpath-muted">
                  <div className="flex items-center justify-between gap-3">
                    <span>Authentication</span>
                    <span className="font-semibold text-skillpath-jade">Ready</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Profile setup</span>
                    <span className="font-semibold text-skillpath-copper">Next</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-skillpath-line bg-white/92 p-4 shadow-soft">
                <div className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-3 gap-y-4">
                  <span className="progress-line absolute left-[10px] top-2 h-[calc(100%-16px)] w-0.5 rounded-full" />
                  {pathwaySteps.map((step) => (
                    <div key={step.id} className="contents">
                      <span
                        className={`relative z-10 mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full text-[10px] font-bold ${
                          step.state === 'Current'
                            ? 'bg-skillpath-jade text-white'
                            : step.state === 'Next'
                              ? 'bg-skillpath-saffron text-skillpath-pine'
                              : 'border border-skillpath-line bg-white text-skillpath-muted'
                        }`}
                      >
                        {step.id}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-skillpath-ink">{step.title}</p>
                        <p className="text-xs text-skillpath-muted">{step.state}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center rounded-lg border border-skillpath-line bg-skillpath-paper p-5 shadow-panel sm:p-8">
          <div className="w-full max-w-[430px]">
            <div className="mb-7">
              <p className="text-sm font-semibold uppercase text-skillpath-jade">Secure Login</p>
              <h2 className="mt-2 text-3xl font-semibold text-skillpath-pine">Welcome back</h2>
            </div>

            <div className="grid gap-3">
              {providerButtons.map((provider) => (
                <button
                  key={provider.method}
                  className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-md border border-skillpath-line bg-white px-4 text-sm font-semibold text-skillpath-ink shadow-soft transition hover:border-skillpath-jade hover:bg-skillpath-mist"
                  type="button"
                  onClick={() => handleProviderLogin(provider.method)}
                >
                  <ProviderIcon icon={provider.icon} />
                  {provider.label}
                </button>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase text-skillpath-muted">
              <span className="h-px flex-1 bg-skillpath-line" />
              Or use email
              <span className="h-px flex-1 bg-skillpath-line" />
            </div>

            <form className="space-y-4" onSubmit={handleEmailLogin}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-skillpath-ink">Email address</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-skillpath-muted" aria-hidden="true" />
                  <input
                    className="h-12 w-full rounded-md border border-skillpath-line bg-white px-10 text-sm text-skillpath-ink shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-skillpath-ink">Password</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-skillpath-muted" aria-hidden="true" />
                  <input
                    className="h-12 w-full rounded-md border border-skillpath-line bg-white px-10 pr-12 text-sm text-skillpath-ink shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-skillpath-muted transition hover:bg-skillpath-mist hover:text-skillpath-ink"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </span>
              </label>

              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-skillpath-muted">
                  <input
                    className="h-4 w-4 rounded border-skillpath-line accent-skillpath-jade"
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(event) => setRememberDevice(event.target.checked)}
                  />
                  Keep me signed in
                </label>
                <button className="text-left font-semibold text-skillpath-jade hover:text-skillpath-pine" type="button">
                  Forgot password?
                </button>
              </div>

              {error ? <p className="rounded-md border border-skillpath-danger bg-red-50 px-3 py-2 text-sm font-medium text-skillpath-danger">{error}</p> : null}

              <button
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-pine px-4 text-sm font-semibold text-white shadow-panel transition hover:bg-skillpath-jade disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                type="submit"
                disabled={!canSubmit}
              >
                Continue to profile setup
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <div className="mt-6 flex items-start gap-2 rounded-md border border-skillpath-line bg-skillpath-mist px-3 py-3 text-sm leading-5 text-skillpath-muted">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-skillpath-jade" aria-hidden="true" />
              Prototype authentication is local-only for this page. Provider buttons simulate a successful identity handoff.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
