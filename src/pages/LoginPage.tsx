import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Eye, EyeSlash, EnvelopeSimple, CircleNotch } from '@phosphor-icons/react';
import { GoogleLogin } from '@react-oauth/google';
import { AuthLayout } from '../components/AuthLayout';
import { authConfig, clearToken, currentUser, forgotPassword, googleLogin, hasToken, loginCredentials, logout, register, resendVerification, resetPassword, verifyEmail, type LoginResponse } from '../api/skillpathApi';

export type LoginMethod = 'google' | 'credentials';
type View = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify-link' | 'verified' | 'reset-done';
interface Props {
  initialView?: 'signin' | 'signup';
  onAuthenticated: (candidate: LoginResponse['candidate'], method: LoginMethod) => void;
  pendingCandidate?: LoginResponse['candidate'] | null;
  onSignedOut: () => void;
}

export function LoginPage({ onAuthenticated, pendingCandidate, onSignedOut, initialView = 'signin' }: Props) {
  const [link] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [view, setView] = useState<View>(() => link.get('auth') === 'reset' ? 'reset' : link.get('auth') === 'verify' ? 'verify-link' : initialView);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [providerWidth, setProviderWidth] = useState(() => Math.min(400, window.innerWidth - 48));
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [config, setConfig] = useState<{ googleConfigured: boolean; emailConfigured: boolean } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const verifyGate = Boolean(pendingCandidate && !['verify-link', 'reset', 'reset-done', 'verified'].includes(view));

  useEffect(() => {
    if (link.has('auth')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    let active = true;
    authConfig().then(value => { if (active) setConfig(value); }).catch(() => { if (active) setError('Unable to connect. Please check the connection and try again.'); });
    return () => { active = false; };
  }, [link]);
  useEffect(() => { titleRef.current?.focus(); }, [view, verifyGate]);
  useEffect(() => { const resize = () => setProviderWidth(Math.min(400, window.innerWidth - 48)); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const changeView = (next: View) => {
    if (pending.current) return;
    setView(next); setError(''); setMessage(''); setPassword(''); setConfirmation(''); setVisible(false);
  };
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to complete your request. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  function accept(response: LoginResponse, method: LoginMethod) {
    setPassword('');
    if (!response.candidate.emailVerified) {
      setMessage(response.verificationSent ? 'A verification link has been sent to your inbox.' : 'Verify your email address to continue.');
      if (response.verificationSent === false) setError('Your account was created, but the verification email could not be sent. Try resending it.');
      if (response.verificationSent) setCooldown(60);
    }
    onAuthenticated(response.candidate, method);
  }
  async function checkVerified() {
    const candidate = await currentUser();
    if (!candidate.emailVerified) throw new Error('Your email is not verified yet. Open the link in your inbox, then try again.');
    onAuthenticated(candidate, 'credentials');
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (view === 'forgot') { const response = await forgotPassword(email); setMessage(response.message); setCooldown(60); return; }
      if (view === 'reset') {
        if (password !== confirmation) throw new Error('The passwords do not match.');
        await resetPassword(link.get('token') || '', password); clearToken(); setPassword(''); setConfirmation(''); setView('reset-done'); return;
      }
      const response = view === 'signup' ? await register(username, email, password) : await loginCredentials(username, password);
      accept(response, 'credentials');
    });
  }

  const titles: Record<View, string> = { signin: 'Welcome back.', signup: 'Create your account.', forgot: 'Forgot your password?', reset: 'Set a new password.', 'verify-link': 'Verify your email.', verified: 'Email verified.', 'reset-done': 'Password updated.' };
  const heading = verifyGate ? 'Verify your email.' : titles[view];
  const authForm = !verifyGate && ['signin', 'signup', 'forgot', 'reset'].includes(view);
  const showProvider = authForm && (view === 'signin' || view === 'signup');
  const googleEnabled = Boolean(config?.googleConfigured && import.meta.env.VITE_GOOGLE_CLIENT_ID);

  return <AuthLayout>
    {!verifyGate && !['signin', 'signup'].includes(view) && <button className="auth-back" type="button" disabled={busy} onClick={() => changeView('signin')}><ArrowLeft size={17} />Back to sign in</button>}
    <header className="auth-heading">
      {(verifyGate || view === 'verify-link') && <EnvelopeSimple className="auth-state-icon" size={28} aria-hidden="true" />}
      {(view === 'verified' || view === 'reset-done') && <CheckCircle className="auth-state-icon" size={28} aria-hidden="true" />}
      <h1 ref={titleRef} tabIndex={-1}>{heading}</h1>
      <p>{verifyGate ? <>Verify <strong>{pendingCandidate?.email}</strong> before continuing.</> : view === 'signin' ? 'Sign in to your SkillPath account.' : view === 'signup' ? 'Start with your account. Your profile comes next.' : view === 'forgot' ? 'Enter the email address associated with your account.' : view === 'reset' ? 'Use at least 10 characters for your new password.' : view === 'verify-link' ? 'Confirm your email address to continue to SkillPath.' : view === 'verified' ? 'Your email address is confirmed.' : 'Sign in with your new password.'}</p>
    </header>

    {showProvider && googleEnabled && <>
      <fieldset className="auth-google" disabled={busy} aria-busy={busy} style={busy ? { pointerEvents: 'none', opacity: .55 } : undefined}>
        <GoogleLogin onSuccess={response => { if (response.credential) void run(async () => accept(await googleLogin(response.credential!), 'google')); }} onError={() => setError('Google sign-in was cancelled or unavailable. Try again or use your password.')} theme="outline" shape="rectangular" size="large" text="continue_with" width={String(providerWidth)} />
      </fieldset>
      <div className="auth-divider"><span /> <span>or continue with email</span> <span /></div>
    </>}

    {authForm && <form className="auth-fields" onSubmit={submit} aria-busy={busy}>
      {(view === 'signin' || view === 'signup') && <label htmlFor="auth-username">{view === 'signup' ? 'Username' : 'Username or email'}<input id="auth-username" name="username" required minLength={3} maxLength={view === 'signup' ? 50 : 254} pattern={view === 'signup' ? '[A-Za-z0-9_.\\-]{3,50}' : undefined} autoComplete="username" spellCheck={false} autoCapitalize="none" value={username} disabled={busy} onChange={e => setUsername(e.target.value)} aria-describedby={view === 'signup' ? 'username-hint' : undefined} />{view === 'signup' && <span id="username-hint" className="auth-hint">3-50 letters, numbers, dots, hyphens or underscores.</span>}</label>}
      {(view === 'signup' || view === 'forgot') && <label htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></label>}
      {view !== 'forgot' && <div>
        <div className="auth-label-row"><label htmlFor="auth-password">Password</label>{view === 'signin' && <button type="button" className="auth-text-button" disabled={busy} onClick={() => changeView('forgot')}>Forgot password?</button>}</div>
        <div className="auth-password"><input id="auth-password" name="password" required minLength={view === 'signin' ? 1 : 10} maxLength={72} type={visible ? 'text' : 'password'} autoComplete={view === 'signin' ? 'current-password' : 'new-password'} value={password} disabled={busy} onChange={e => setPassword(e.target.value)} aria-describedby={view !== 'signin' ? 'password-hint' : undefined} /><button type="button" disabled={busy} title={visible ? 'Hide password' : 'Show password'} aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(value => !value)}>{visible ? <EyeSlash size={20} /> : <Eye size={20} />}</button></div>
        {view !== 'signin' && <p id="password-hint" className="auth-hint">At least 10 characters. Up to 72 bytes.</p>}
      </div>}
      {view === 'reset' && <label htmlFor="auth-confirm">Confirm password<input id="auth-confirm" required type="password" autoComplete="new-password" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} /></label>}
      {error && <div className="auth-notice auth-error" role="alert">{error}</div>}
      {message && <div className="auth-notice" role="status">{message}</div>}
      <button className="auth-primary" type="submit" disabled={busy || (view === 'forgot' && cooldown > 0)}>{busy ? <><CircleNotch className="auth-spinner" size={18} />Please wait</> : <>{view === 'signin' ? 'Sign in' : view === 'signup' ? 'Create account' : view === 'forgot' ? cooldown ? `Try again in ${cooldown}s` : 'Send reset link' : 'Update password'}<ArrowRight size={18} aria-hidden="true" /></>}</button>
    </form>}

    {!authForm && <div className="auth-fields">
      {error && <div className="auth-notice auth-error" role="alert">{error}</div>}
      {message && <div className="auth-notice" role="status">{message}</div>}
      {verifyGate && <>
        <button className="auth-primary" disabled={busy} onClick={() => void run(checkVerified)}>{busy ? 'Please wait' : 'I have verified my email'}<ArrowRight size={18} /></button>
        <button className="auth-secondary" disabled={busy || cooldown > 0} onClick={() => void run(async () => { await resendVerification(); setMessage('A verification link has been sent to your inbox.'); setCooldown(60); })}>{cooldown ? `Resend in ${cooldown}s` : 'Resend verification email'}</button>
        <button className="auth-text-button auth-center" disabled={busy} onClick={() => void run(async () => { await logout(); onSignedOut(); setView('signin'); })}>Sign out</button>
      </>}
      {view === 'verify-link' && <button className="auth-primary" disabled={busy} onClick={() => void run(async () => { await verifyEmail(link.get('token') || ''); setView('verified'); })}>{busy ? 'Verifying' : 'Verify email'}<ArrowRight size={18} /></button>}
      {view === 'verified' && <button className="auth-primary" disabled={busy} onClick={() => void run(async () => { if (hasToken()) await checkVerified(); else setView('signin'); })}>Continue<ArrowRight size={18} /></button>}
      {view === 'reset-done' && <button className="auth-primary" onClick={() => changeView('signin')}>Back to sign in<ArrowRight size={18} /></button>}
    </div>}
    {!verifyGate && showProvider && <p className="auth-switch">{view === 'signin' ? 'New to SkillPath?' : 'Already have an account?'} <button type="button" className="auth-text-button" disabled={busy} onClick={() => changeView(view === 'signin' ? 'signup' : 'signin')}>{view === 'signin' ? 'Create an account' : 'Sign in'}</button></p>}
  </AuthLayout>;
}
