import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeSlash,
  GoogleLogo,
  ShieldCheck,
} from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import {
  AuthApiError,
  login,
  loginWithGoogle,
  register,
  requestPasswordReset,
  resetPassword,
  type AuthUser,
} from '../api/authApi';

// Real Google Sign-In (ID token, verified server-side) is implemented.
// 'github' is kept in the union (rather than removed) purely so
// App.tsx's existing GitHub OAuth-redirect handling still type-checks;
// there is no GitHub button on this page anymore, so this value is only
// ever set if someone navigates the old /api/auth/github/start URL
// directly.
export type LoginMethod = 'email' | 'google' | 'github';

interface LoginPageProps {
  onAuthenticated: (method: LoginMethod, user: AuthUser) => void;
  initialError?: string | null;
}

type Mode = 'signin' | 'signup' | 'forgot';
type ForgotStep = 'request' | 'verify';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REMEMBERED_PROFILE_KEY = 'skillpath_remembered_profile';

/**
 * Renders Google's own "Sign in with Google" button via the Google
 * Identity Services script (loaded in index.html). We never see the
 * user's Google password - Google hands back a signed credential (ID
 * token) which the backend verifies before creating a session.
 *
 * Falls back to a disabled placeholder if VITE_GOOGLE_CLIENT_ID isn't
 * configured, so the app still runs without Google credentials set up.
 */
function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: Math.round(containerRef.current.offsetWidth),
        text: 'signin_with',
      });
    };

    if (window.google) {
      render();
      return undefined;
    }

    // The GIS script tag is `defer`, so it may not have executed yet on
    // first mount - poll briefly until `window.google` is available.
    const interval = window.setInterval(() => {
      if (window.google) {
        window.clearInterval(interval);
        render();
      }
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-skillpath-line bg-skillpath-cream/60 px-3 text-sm font-black text-skillpath-muted opacity-60 shadow-soft"
        type="button"
        disabled
        title="Google Sign-In is not configured (set VITE_GOOGLE_CLIENT_ID)"
        aria-disabled="true"
      >
        <GoogleLogo className="h-5 w-5" weight="bold" aria-hidden="true" />
        <span>Continue with Google</span>
      </button>
    );
  }

  return <div ref={containerRef} className="h-12 w-full [&>div]:!w-full" />;
}

export function LoginPage({ onAuthenticated, initialError = null }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [rememberedName, setRememberedName] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Forgot password state ---------------------------------------------
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isResending, setIsResending] = useState(false);

  // initialError arrives from App.tsx asynchronously (after resolving a
  // GitHub OAuth redirect), which can happen after this component has
  // already mounted with its initial (null) value - so keep it in sync.
  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REMEMBERED_PROFILE_KEY) || '{}') as { email?: string; name?: string };
      if (stored.email) setEmail(stored.email);
      if (stored.name) setRememberedName(stored.name);
    } catch {
      localStorage.removeItem(REMEMBERED_PROFILE_KEY);
    }
  }, []);

  const rememberAuthenticatedUser = (user: AuthUser) => {
    try {
      if (!rememberDevice) {
        localStorage.removeItem(REMEMBERED_PROFILE_KEY);
        return;
      }

      const displayName = user.candidate?.name || user.fullName || user.email;
      localStorage.setItem(
        REMEMBERED_PROFILE_KEY,
        JSON.stringify({
          email: user.email,
          name: displayName,
        }),
      );
      setRememberedName(displayName);
    } catch {
      // Remembered greetings are convenience only; auth still relies on server sessions.
    }
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setInfoMessage(null);
    setConfirmPassword('');
  };

  const openForgotPassword = () => {
    setForgotEmail(email.trim());
    setForgotStep('request');
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError(null);
    setInfoMessage(null);
    setMode('forgot');
  };

  // Client-side checks are for UX only (fast feedback) - the server
  // re-validates everything with zod and is the actual source of truth.
  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    const basicsValid = email.trim().length > 3 && password.length >= 10;
    if (mode === 'signup') {
      return basicsValid && password === confirmPassword;
    }
    return basicsValid;
  }, [email, password, confirmPassword, mode, isSubmitting]);

  const canSubmitForgotRequest = useMemo(
    () => !isSubmitting && forgotEmail.trim().length > 3,
    [forgotEmail, isSubmitting],
  );

  const canSubmitForgotVerify = useMemo(
    () =>
      !isSubmitting &&
      /^\d{6}$/.test(otp) &&
      newPassword.length >= 10 &&
      newPassword === confirmNewPassword,
    [otp, newPassword, confirmNewPassword, isSubmitting],
  );

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError('Enter a valid email and a password with at least 10 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { user } = await login(email.trim(), password, rememberDevice);
      rememberAuthenticatedUser(user);
      onAuthenticated('email', user);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!canSubmit) {
      setError('Enter a valid email and a password with at least 10 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // The register endpoint creates the account AND signs the user in
      // (it issues the same session cookies login does), so there's no
      // separate "now log in" step needed.
      const { user } = await register(email.trim(), password, fullName.trim() || undefined, rememberDevice);
      rememberAuthenticatedUser(user);
      onAuthenticated('email', user);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to create your account right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setError(null);
      setIsSubmitting(true);
      try {
        const { user } = await loginWithGoogle(idToken);
        rememberAuthenticatedUser(user);
        onAuthenticated('google', user);
      } catch (err) {
        if (err instanceof AuthApiError) {
          setError(err.message);
        } else {
          setError('Unable to sign in with Google right now. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [onAuthenticated],
  );

  const handleForgotRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmitForgotRequest) {
      setError('Enter the email address on your account.');
      return;
    }

    setError(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      // The server always responds the same way (200, generic message)
      // whether or not the email is registered, so this never reveals
      // account existence - we just move on to the verify step.
      await requestPasswordReset(forgotEmail.trim());
      setForgotStep('verify');
      setInfoMessage(`If an account exists for ${forgotEmail.trim()}, a 6-digit code has been sent to it.`);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to send the code right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setInfoMessage(null);
    setIsResending(true);
    try {
      await requestPasswordReset(forgotEmail.trim());
      setInfoMessage('A new code has been sent.');
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to resend the code right now. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmitForgotVerify) {
      setError('Enter the 6-digit code and a new password with at least 10 characters.');
      return;
    }

    setError(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      await resetPassword(forgotEmail.trim(), otp.trim(), newPassword);
      setEmail(forgotEmail.trim());
      setPassword('');
      switchMode('signin');
      setInfoMessage('Your password has been reset. Sign in with your new password.');
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError('Unable to reset your password right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSignUp = mode === 'signup';
  const isForgot = mode === 'forgot';
  const welcomeName = rememberedName.trim().split(/\s+/)[0] || '';

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
                Learning Gap Engine for verified readiness.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-skillpath-cream/72">
                {isForgot
                  ? 'Reset your password to get back into your profile, skills, assessments, and learning path.'
                  : isSignUp
                    ? 'Create a professional candidate account. Your profile setup is saved and reused for future assessments.'
                    : 'Sign in to return to your saved profile, latest assessment results, and learning-gap dashboard.'}
              </p>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-[1fr_240px] md:items-end">
              <div className="rounded-lg border border-white/12 bg-skillpath-cream p-4 text-skillpath-ink shadow-soft">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-skillpath-night">Entry progress</p>
                    <p className="text-sm font-medium text-skillpath-muted">
                      {isSignUp ? 'Account creation unlocks one-time profile setup.' : 'Login opens your saved learning-gap dashboard when setup is complete.'}
                    </p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-skillpath-teal" weight="fill" aria-hidden="true" />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-skillpath-line">
                  <div className="h-full w-1/4 rounded-full bg-skillpath-teal" />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-black uppercase text-skillpath-muted">
                  <span>{isSignUp ? 'Sign up' : 'Login'}</span>
                  <span>Profile next</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center rounded-lg bg-skillpath-paper p-5 text-skillpath-ink shadow-panel sm:p-8">
          <div className="w-full max-w-[430px]">
            {isForgot ? (
              <>
                <div className="mb-8">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="mb-4 inline-flex items-center gap-1.5 text-sm font-black text-skillpath-muted hover:text-skillpath-night"
                  >
                    <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                    Back to sign in
                  </button>
                  <h2 className="text-4xl font-black tracking-normal text-skillpath-night">Reset password</h2>
                  <p className="mt-2 text-sm font-bold text-skillpath-muted">
                    {forgotStep === 'request'
                      ? "We'll email a 6-digit code to your registered address."
                      : `Enter the code sent to ${forgotEmail} and choose a new password.`}
                  </p>
                </div>

                {infoMessage ? (
                  <p className="mb-4 rounded-md border border-skillpath-teal bg-teal-50 px-3 py-2 text-sm font-bold text-skillpath-night">
                    {infoMessage}
                  </p>
                ) : null}
                {error ? (
                  <p role="alert" className="mb-4 rounded-md border border-skillpath-danger bg-red-50 px-3 py-2 text-sm font-bold text-skillpath-danger">
                    {error}
                  </p>
                ) : null}

                {forgotStep === 'request' ? (
                  <form className="space-y-4" onSubmit={handleForgotRequest} noValidate>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-skillpath-night">Email address</span>
                      <input
                        className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                        type="email"
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
                        autoComplete="email"
                        autoFocus
                        required
                        maxLength={254}
                      />
                    </label>

                    <button
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-night px-4 text-base font-black text-skillpath-cream shadow-panel transition hover:bg-skillpath-forest disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                      type="submit"
                      disabled={!canSubmitForgotRequest}
                    >
                      {isSubmitting ? 'Sending code…' : 'Send code'}
                      <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleForgotVerify} noValidate>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-skillpath-night">6-digit code</span>
                      <input
                        className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-center text-lg font-black tracking-[0.5em] text-skillpath-night shadow-soft transition placeholder:tracking-normal placeholder:text-skillpath-muted focus:border-skillpath-focus"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        placeholder="000000"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        autoComplete="one-time-code"
                        autoFocus
                        required
                        maxLength={6}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-skillpath-night">New password</span>
                      <span className="relative block">
                        <input
                          className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 pr-12 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                          minLength={10}
                          maxLength={256}
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
                      <span className="mt-1.5 block text-xs font-bold text-skillpath-muted">At least 10 characters.</span>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-skillpath-night">Confirm new password</span>
                      <input
                        className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={10}
                        maxLength={256}
                      />
                    </label>

                    <button
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-night px-4 text-base font-black text-skillpath-cream shadow-panel transition hover:bg-skillpath-forest disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                      type="submit"
                      disabled={!canSubmitForgotVerify}
                    >
                      {isSubmitting ? 'Resetting…' : 'Reset password'}
                      <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending}
                      className="w-full text-center text-sm font-black text-skillpath-night underline decoration-skillpath-teal decoration-2 underline-offset-4 hover:text-skillpath-teal disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResending ? 'Resending…' : "Didn't get a code? Resend"}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="mt-2 text-4xl font-black tracking-normal text-skillpath-night">
                      {isSignUp ? 'Create account' : welcomeName ? `Welcome back, ${welcomeName}` : 'Welcome back'}
                    </h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-skillpath-muted">
                      {isSignUp
                        ? 'Use a work-ready email and a strong password to create your SkillPath account.'
                        : 'Continue to your saved setup, assessment status, and learning-gap engine.'}
                    </p>
                    <div className="mt-2 inline-flex rounded-md border border-skillpath-line bg-skillpath-cream p-1 text-sm font-black">
                      <button
                        type="button"
                        onClick={() => switchMode('signin')}
                        className={`rounded px-3 py-1.5 transition ${!isSignUp ? 'bg-skillpath-night text-skillpath-cream' : 'text-skillpath-muted hover:text-skillpath-night'}`}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className={`rounded px-3 py-1.5 transition ${isSignUp ? 'bg-skillpath-night text-skillpath-cream' : 'text-skillpath-muted hover:text-skillpath-night'}`}
                      >
                        Sign up
                      </button>
                    </div>
                  </div>
                </div>

                <GoogleSignInButton onCredential={handleGoogleCredential} />

                <div className="my-6 flex items-center gap-3 text-xs font-black uppercase text-skillpath-muted">
                  <span className="h-px flex-1 bg-skillpath-line" />
                  Email
                  <span className="h-px flex-1 bg-skillpath-line" />
                </div>

                <form className="space-y-4" onSubmit={isSignUp ? handleEmailSignUp : handleEmailSignIn} noValidate>
                  {isSignUp ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-skillpath-night">Full name</span>
                      <input
                        className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        maxLength={120}
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Email address</span>
                    <input
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      required
                      maxLength={254}
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
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        required
                        minLength={10}
                        maxLength={256}
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
                    {isSignUp ? (
                      <span className="mt-1.5 block text-xs font-bold text-skillpath-muted">At least 10 characters.</span>
                    ) : null}
                  </label>

                  {isSignUp ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-skillpath-night">Confirm password</span>
                      <input
                        className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft transition placeholder:text-skillpath-muted focus:border-skillpath-focus"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={10}
                        maxLength={256}
                      />
                    </label>
                  ) : null}

                  {isSignUp ? (
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-skillpath-muted">
                      <input
                        className="h-4 w-4 rounded border-skillpath-line accent-skillpath-teal"
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(event) => setRememberDevice(event.target.checked)}
                      />
                      Keep this device signed in
                    </label>
                  ) : (
                    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <label className="inline-flex items-center gap-2 font-bold text-skillpath-muted">
                        <input
                          className="h-4 w-4 rounded border-skillpath-line accent-skillpath-teal"
                          type="checkbox"
                          checked={rememberDevice}
                          onChange={(event) => setRememberDevice(event.target.checked)}
                        />
                        Keep this device signed in
                      </label>
                      <button
                        className="text-left font-black text-skillpath-night underline decoration-skillpath-teal decoration-2 underline-offset-4 hover:text-skillpath-teal"
                        type="button"
                        onClick={openForgotPassword}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {infoMessage ? (
                    <p className="rounded-md border border-skillpath-teal bg-teal-50 px-3 py-2 text-sm font-bold text-skillpath-night">
                      {infoMessage}
                    </p>
                  ) : null}
                  {error ? (
                    <p role="alert" className="rounded-md border border-skillpath-danger bg-red-50 px-3 py-2 text-sm font-bold text-skillpath-danger">
                      {error}
                    </p>
                  ) : null}

                  <button
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-night px-4 text-base font-black text-skillpath-cream shadow-panel transition hover:bg-skillpath-forest disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                    type="submit"
                    disabled={!canSubmit}
                  >
                    {isSubmitting ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
                    <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
                  </button>
                </form>

                <p className="mt-4 text-center text-sm font-bold text-skillpath-muted">
                  {isSignUp ? (
                    <>
                      Already have an account?{' '}
                      <button type="button" className="text-skillpath-night underline decoration-skillpath-teal decoration-2 underline-offset-4 hover:text-skillpath-teal" onClick={() => switchMode('signin')}>
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      Don&apos;t have an account?{' '}
                      <button type="button" className="text-skillpath-night underline decoration-skillpath-teal decoration-2 underline-offset-4 hover:text-skillpath-teal" onClick={() => switchMode('signup')}>
                        Sign up
                      </button>
                    </>
                  )}
                </p>

                <div className="mt-6 flex items-start gap-3 rounded-md bg-skillpath-night px-4 py-4 text-sm font-medium leading-5 text-skillpath-cream">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-skillpath-citron" weight="bold" aria-hidden="true" />
                  <span>Your session is protected with hashed passwords, CSRF-checked requests, and rate-limited sign-in attempts.</span>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
