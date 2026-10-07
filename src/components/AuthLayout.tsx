import type { ReactNode } from 'react';
import { SkillPathLogo } from './SkillPathLogo';
import '../auth.css';
export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-screen">
    <header className="sp-header"><SkillPathLogo /></header>
    <div className="auth-container">
      <section className="auth-form-wrapper"><div className="auth-form-panel">{children}</div></section>
      <aside className="auth-photo" aria-label="Mountain landscape"><img src="/images/auth-landscape.jpg" alt="Sunlit green mountains and a forested valley" /></aside>
    </div>
  </main>;
}
