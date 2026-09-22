import { FormEvent, useState } from 'react';
import { Eye, EyeSlash, ArrowRight } from '@phosphor-icons/react';
import { GoogleLogin } from '@react-oauth/google';
import { SkillPathLogo } from '../components/SkillPathLogo';
import { googleLogin, loginCredentials, register, type LoginResponse } from '../api/skillpathApi';

export type LoginMethod = 'google' | 'credentials';
interface Props { onAuthenticated: (candidate: LoginResponse['candidate'], method: LoginMethod) => void }

export function LoginPage({ onAuthenticated }: Props) {
  const [signup, setSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function authenticate(task: () => Promise<LoginResponse>, method: LoginMethod) {
    setBusy(true); setError('');
    try { const response = await task(); onAuthenticated(response.candidate, method); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void authenticate(() => signup ? register(username, email, password) : loginCredentials(username, password), 'credentials');
  }
  return <main className="min-h-screen bg-skillpath-night text-skillpath-cream">
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10"><SkillPathLogo /><nav className="hidden items-center gap-6 text-sm font-bold text-skillpath-cream/70 md:flex"><a href="#how-it-works" className="hover:text-skillpath-citron">How it works</a><a href="#assessments" className="hover:text-skillpath-citron">Assessments</a><a href="#sign-in" className="text-skillpath-citron">Sign in</a></nav></header>
    <section className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-10 lg:py-24">
      <div id="how-it-works" className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-skillpath-citron">SkillPath AI</p>
        <h1 className="mt-5 text-5xl font-bold leading-[1.02] sm:text-6xl">Turn skill gaps into a clear next step.</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-skillpath-cream/70">A focused workspace for technical assessments, evidence-based progress, and a learning roadmap built around your readiness.</p>
        <div id="assessments" className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3"><div className="border-l-2 border-skillpath-citron pl-4"><p className="font-bold">AI interview</p><p className="mt-1 text-sm text-skillpath-cream/60">Adaptive technical questions.</p></div><div className="border-l-2 border-skillpath-teal pl-4"><p className="font-bold">Skills check</p><p className="mt-1 text-sm text-skillpath-cream/60">Consistent deterministic scoring.</p></div><div className="border-l-2 border-skillpath-cream/40 pl-4"><p className="font-bold">Learning plan</p><p className="mt-1 text-sm text-skillpath-cream/60">Prioritized next actions.</p></div></div>
      </div>
      <div id="sign-in" className="w-full max-w-md justify-self-center border border-white/15 bg-skillpath-forest p-5 sm:p-8 lg:justify-self-end">
      <h2 className="text-3xl font-bold">{signup ? 'Create your account' : 'Welcome back'}</h2>
      <p className="mt-3 text-sm leading-6 text-skillpath-cream/70">{signup ? 'Get started with your professional learning profile.' : 'Sign in to continue your assessments and learning plan.'}</p>
      <div className="mt-7 flex border-b border-white/20" role="tablist" aria-label="Account access">
        {[false, true].map(value => <button key={String(value)} role="tab" aria-selected={signup === value} disabled={busy} onClick={() => { setSignup(value); setError(''); }} className={`flex-1 border-b-2 py-3 font-bold ${signup === value ? 'border-skillpath-citron text-skillpath-citron' : 'border-transparent text-skillpath-cream/60'}`}>{value ? 'Sign up' : 'Sign in'}</button>)}
      </div>
      <form className="mt-6 space-y-5" onSubmit={submit}>
        <label className="block text-sm font-bold">{signup ? 'Username' : 'Username or email'}<input required minLength={3} maxLength={100} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="mt-2 h-12 w-full rounded-md border border-white/20 bg-skillpath-forest px-3" /></label>
        {signup && <label className="block text-sm font-bold">Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-md border border-white/20 bg-skillpath-forest px-3" /></label>}
        <label className="block text-sm font-bold">Password<span className="relative mt-2 block"><input required minLength={signup ? 10 : 1} maxLength={72} type={visible ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="h-12 w-full rounded-md border border-white/20 bg-skillpath-forest pl-3 pr-12" /><button type="button" title={visible ? 'Hide password' : 'Show password'} aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)} className="absolute right-3 top-3 p-1">{visible ? <EyeSlash size={20} /> : <Eye size={20} />}</button></span></label>
        {signup && <p className="text-xs text-skillpath-cream/70">Use at least 10 characters.</p>}
        {error && <p role="alert" className="rounded-md border border-red-300 bg-red-950 p-3 text-sm text-red-100">{error}</p>}
        <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-citron font-bold text-skillpath-night disabled:opacity-50">{busy ? 'Please wait...' : signup ? 'Create account' : 'Sign in'}<ArrowRight size={18} /></button>
      </form>
      {import.meta.env.VITE_GOOGLE_CLIENT_ID && <div className={`mt-6 flex justify-center ${busy ? 'pointer-events-none opacity-50' : ''}`}><GoogleLogin onSuccess={response => { if (response.credential) void authenticate(() => googleLogin(response.credential!), 'google'); }} onError={() => setError('Google sign-in was cancelled or unavailable. Please try again.')} theme="outline" shape="rectangular" text={signup ? 'signup_with' : 'signin_with'} /></div>}
      </div>
    </section>
  </main>;
}
