import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import pool,{ query } from '../server/db.mjs';
import { generateLearningPlan } from '../server/learningService.mjs';
import { FULL_STACK_SKILLS } from '../server/domainConfig.mjs';

// Explicit live-provider check. Uses synthetic scores, never existing learner data.
const started=Date.now();let id;
try {
  const candidate=(await query("INSERT INTO candidates(name,email,email_verified_at,profile_complete) VALUES('Live Provider Test',$1,NOW(),TRUE) RETURNING *",[`live-hf-${randomUUID()}@example.com`])).rows[0];id=candidate.id;
  const assessment=(await query("INSERT INTO skill_assessments(candidate_id,status,due_at) VALUES($1,'submitted',NOW()) RETURNING id",[id])).rows[0];
  const results=FULL_STACK_SKILLS.flatMap(skill=>[0,1].map(()=>({skill,correct:process.env.TEST_ALL_GAPS==='1'?false:skill!=='HTML'})));
  await query('INSERT INTO skill_assessment_results(assessment_id,results) VALUES($1,$2)',[assessment.id,JSON.stringify(results)]);
  const result=await generateLearningPlan(candidate);
  const summary={passed:true,provider:'Hugging Face (real hosted inference)',model:result.plan.model,syntheticScores:true,topics:result.plan.topics.length,sessions:result.plan.topics.flatMap(t=>t.sessions).length,estimatedMinutes:result.plan.estimatedMinutes,elapsedSeconds:Math.round((Date.now()-started)/1000)};
  await mkdir('screenshots/prototype-refresh',{recursive:true});
  await writeFile(`screenshots/prototype-refresh/live-hf-${process.env.TEST_ALL_GAPS==='1'?'all-gaps':'single-gap'}.json`,JSON.stringify({summary,plan:result.plan},null,2));
  console.log(JSON.stringify(summary,null,2));
}catch(error){console.error(JSON.stringify({passed:false,status:error.statusCode,message:error.message,elapsedSeconds:Math.round((Date.now()-started)/1000)}));process.exitCode=1;}
finally{if(id)await query('DELETE FROM candidates WHERE id=$1',[id]);await pool.end();}
