import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, CheckCircle, Clock } from '@phosphor-icons/react';
import { LessonContent } from '../components/LessonContent';
import { CameraMonitor } from '../components/CameraMonitor';
import { SkillPathLogo } from '../components/SkillPathLogo';
import { startLearning, updateLearning, type LearningLesson } from '../api/skillpathApi';
import type { AssessmentAccessGrant } from '../types/assessment';

export function LearningSessionPage({ lesson, planId, onBack, readOnly = false }: { lesson: LearningLesson; planId: string; onBack: () => void; readOnly?: boolean }) {
  const [access,setAccess] = useState<AssessmentAccessGrant | null>(null);
  const [session,setSession] = useState<{ id:string; startedAt:string } | null>(null);
  const [phase,setPhase] = useState<'ready'|'active'|'abandoned'|'completed'>('ready');
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const sessionRef = useRef(session); sessionRef.current = session;
  const [busy,setBusy] = useState(false);
  const [confirmLeave,setConfirmLeave] = useState(false);
  const [remaining,setRemaining] = useState(600);
  const [answer,setAnswer] = useState<number | null>(null);
  const [draft,setDraft] = useState('');
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stop = () => { access?.cameraStream?.getTracks().forEach(t=>t.stop()); access?.screenStream?.getTracks().forEach(t=>t.stop()); if(document.fullscreenElement) void document.exitFullscreen().catch(()=>{}); };
  async function abandon(reason: string) {
    if(phaseRef.current !== 'active') return;
    phaseRef.current='abandoned'; setPhase('abandoned'); setError(reason); setAnswer(null); setDraft('');
    if(sessionRef.current) await updateLearning('abandon',sessionRef.current.id).catch(()=>{});
  }
  async function begin() {
    if(busy) return; setBusy(true); setError(''); let camera:MediaStream|undefined; let screen:MediaStream|undefined;
    try {
      camera=await navigator.mediaDevices.getUserMedia({video:true});
      screen=await navigator.mediaDevices.getDisplayMedia({video:true});
      const surface=screen.getVideoTracks()[0]?.getSettings().displaySurface;
      if(surface && surface!=='monitor') throw new Error('Share your entire screen to start the session.');
      await document.documentElement.requestFullscreen();
      const next=await startLearning(planId,lesson.id);
      setAccess({cameraGranted:true,microphoneGranted:false,screenGranted:true,fullscreenGranted:true,cameraStream:camera,screenStream:screen});
      setSession(next); setDraft(''); setRemaining(600); setAnswer(null); setMessage(''); phaseRef.current='active'; setPhase('active');
    } catch(e) { camera?.getTracks().forEach(t=>t.stop()); screen?.getTracks().forEach(t=>t.stop()); if(document.fullscreenElement) void document.exitFullscreen().catch(()=>{}); setError(e instanceof Error?e.message:'Could not start the session.'); }
    finally { setBusy(false); }
  }
  useEffect(()=> { if(video.current && access) video.current.srcObject=access.cameraStream || null; },[access,phase]);
  useEffect(()=> { if(phase!=='active') stop(); },[phase]);
  useEffect(()=>()=> { access?.cameraStream?.getTracks().forEach(t=>t.stop()); access?.screenStream?.getTracks().forEach(t=>t.stop()); },[access]);
  useEffect(()=> {
    if(phase!=='active' || !session) return;
    let pending=false;
    const clock=window.setInterval(()=>setRemaining(Math.max(0,600-Math.floor((Date.now()-new Date(session.startedAt).getTime())/1000))),1000);
    const heartbeat=window.setInterval(async()=> { if(pending || phaseRef.current!=='active') return; pending=true; try { const state=await updateLearning('heartbeat',session.id); if(state.status!=='active') void abandon('The connection was interrupted. This session must be restarted.'); } catch { void abandon('The connection was interrupted. This session must be restarted.'); } finally {pending=false;} },8000);
    const hidden=()=>{ if(document.hidden) void abandon('You left the session. This attempt has been discarded.'); };
    const blur=()=>void abandon('You switched away from the session. This attempt has been discarded.');
    const unload=(e:BeforeUnloadEvent)=>{ e.preventDefault(); e.returnValue=''; };
    document.addEventListener('visibilitychange',hidden); window.addEventListener('blur',blur); window.addEventListener('beforeunload',unload);
    return ()=>{ clearInterval(clock); clearInterval(heartbeat); document.removeEventListener('visibilitychange',hidden); window.removeEventListener('blur',blur); window.removeEventListener('beforeunload',unload); };
  },[phase,session]);
  async function complete() {
    if(!session || busy || answer===null) return;
    setBusy(true); setError('');
    try { const result=await updateLearning('complete',session.id,answer); if(result.status==='completed') {phaseRef.current='completed';setPhase('completed');} else if(result.status!=='active') {phaseRef.current='abandoned';setPhase('abandoned');setError('The session expired. Start again to complete it.');} setMessage(result.feedback || ''); }
    catch(e) {setError(e instanceof Error?e.message:'Unable to submit the checkpoint.');} finally {setBusy(false);}
  }
  if (readOnly) return <main className="sp-page"><header className="sp-header"><SkillPathLogo /><button className="sp-btn-secondary" onClick={onBack}><ArrowLeft size={18} />Learning plan</button></header><div className="sp-content"><header className="page-title"><div><h1>{lesson.title}</h1><p>{lesson.objective}</p></div><span className="sp-tag"><CheckCircle size={18} />Completed</span></header><section className="lesson-reading"><LessonContent>{lesson.content}</LessonContent></section><section className="lesson-exercise"><h2>Practice exercise</h2>{lesson.exercise}</section></div></main>;
  return <main className="sp-page"><header className="sp-header"><SkillPathLogo /><button className="sp-btn-secondary" disabled={busy} onClick={()=>{if(phase==='active'){setConfirmLeave(true);return;}stop();onBack();}}><ArrowLeft size={18} />Learning plan</button></header><div className="sp-content">
    <header className="page-title"><div><h1>{lesson.title}</h1><p>{lesson.objective}</p></div><span className="sp-tag"><Clock size={18} />{phase==='active'?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'10 minutes'}</span></header>
    {confirmLeave && <div className="sp-notice" role="alert"><p>Leave this session? Only this unfinished attempt will be discarded.</p><div style={{display:'flex',gap:12,marginTop:12}}><button className="sp-btn-secondary" onClick={()=>setConfirmLeave(false)}>Keep studying</button><button className="sp-btn-primary" onClick={async()=>{setConfirmLeave(false);await abandon('Session ended.');stop();onBack();}}>Discard attempt and leave</button></div></div>}
    {error && <div className="sp-notice sp-notice-danger" role="alert">{error}</div>}{message && <div className="sp-notice" role="status">{message}</div>}
    {(phase==='ready'||phase==='abandoned') && <section className="next-action"><div><h2>{phase==='abandoned'?'Restart this session':'Prepare for a focused session'}</h2><p>Camera, entire-screen sharing, and fullscreen are required. Spend six minutes studying, three minutes on the exercise, then answer the checkpoint. Leaving the page, switching windows, or losing the connection discards this attempt. Previous completions are kept.</p></div><button className="sp-btn-primary" disabled={busy} onClick={()=>void begin()}><Camera size={18} />{busy?'Preparing...':'Start 10-minute session'}</button></section>}
    {phase==='active' && access && <><CameraMonitor access={access} active report={(type,detail)=>{if(type==='camera_motion'||type==='camera_obscured')setMessage(detail);else void abandon('A required proctoring condition ended. This attempt has been discarded.');}} /><div className="lesson-layout"><section><div className="lesson-reading"><LessonContent>{lesson.content}</LessonContent></div><div className="lesson-exercise"><h2>Practice exercise</h2><LessonContent>{lesson.exercise}</LessonContent></div><label className="practice-workspace"><span>Practice workspace</span><textarea aria-label="Practice workspace" value={draft} onChange={e=>setDraft(e.target.value)} spellCheck={false} /><small>Draft for this attempt only; cleared when the session ends.</small></label></section><aside><video className="lesson-camera" ref={video} autoPlay muted playsInline /><section className="lesson-checkpoint"><h2>Knowledge checkpoint</h2><p>{lesson.question}</p>{lesson.choices.map((choice,index)=><label key={index} className={`sp-choice ${answer===index?'selected':''}`}><span>{choice}</span><input type="radio" name="checkpoint" checked={answer===index} onChange={()=>setAnswer(index)} /></label>)}<button className="sp-btn-primary" disabled={remaining>0||answer===null||busy} onClick={()=>void complete()}>{busy?'Saving...':remaining>0?'Available after 10 minutes':'Complete session'}<ArrowRight size={18} /></button></section></aside></div></>}
    {phase==='completed' && <section className="next-action"><div><CheckCircle size={30} /><h2>Session completed</h2><p>Your completion has been saved to your learning plan.</p></div><button className="sp-btn-primary" onClick={onBack}>Continue to learning plan <ArrowRight size={18} /></button></section>}
  </div></main>;
}
