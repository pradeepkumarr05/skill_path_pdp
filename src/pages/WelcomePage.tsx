import { ArrowRight, ChartBar, CheckCircle, Clock, ListChecks } from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import '../workspace.css';
export function WelcomePage({ onEnter }: { onEnter: (mode: 'signin' | 'signup') => void }) {
  return <main className="welcome">
    <header className="sp-header"><SkillPathLogo /><div className="action-row"><button className="sp-btn-ghost" onClick={() => onEnter('signin')}>Sign in</button><button className="sp-btn-primary" onClick={() => onEnter('signup')}>Create account <ArrowRight size={18} /></button></div></header>
    <section className="welcome-hero">
      <img src="/images/auth-landscape.jpg" alt="Green mountain ridges overlooking a forested valley" />
      <div className="welcome-copy"><h1>SkillPath</h1><p>A personal study plan for your next step in full stack engineering.</p><p className="welcome-detail">Assess what you know. Find the skills that need practice. Build them in focused, ten-minute sessions.</p><button className="sp-btn-primary" onClick={() => onEnter('signup')}>Build my learning plan <ArrowRight size={18} /></button></div>
    </section>
    <section className="welcome-process" aria-label="Your learning journey">
      {[{Icon:ListChecks,title:'Assess your skills',text:'A technical interview and a knowledge assessment establish your starting point.'},{Icon:ChartBar,title:'See the gaps',text:'Individual skill results show strengths and areas to practice, not just an overall average.'},{Icon:Clock,title:'Follow your plan',text:'Work through ten-minute sessions, with an estimated study time and saved completions.'},{Icon:CheckCircle,title:'Keep moving forward',text:'Return to your learning plan, review your results, and continue the next unfinished session.'}].map(({Icon,title,text},index) => <article key={title}><div><Icon size={24} /><span>0{index+1}</span></div><h2>{title}</h2><p>{text}</p></article>)}
    </section>
  </main>;
}
