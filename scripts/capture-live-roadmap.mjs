import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import pool, { query } from '../server/db.mjs';
import { signToken } from '../server/auth.mjs';

// Replay actual generated content in a temporary account, without another provider call.
const source = process.env.LIVE_PLAN_FILE || 'screenshots/prototype-refresh/live-hf-all-gaps.json';
const { plan } = JSON.parse(await readFile(source, 'utf8'));
let id, browser;
try {
  id = (await query("INSERT INTO candidates(name,email,email_verified_at,profile_complete,interested_roles) VALUES('Roadmap Review',$1,NOW(),TRUE,$2) RETURNING id", [`capture-${randomUUID()}@example.com`, ['Associate Software Engineer']])).rows[0].id;
  const assessment = (await query("INSERT INTO skill_assessments(candidate_id,status,due_at) VALUES($1,'submitted',NOW()) RETURNING id", [id])).rows[0];
  const results = plan.evidence.flatMap(e=>Array.from({length:e.questions},(_,i)=>({skill:e.skill,correct:i<Math.round(e.questions*(e.mcq||0)/100)})));
  await query('INSERT INTO skill_assessment_results(assessment_id,results) VALUES($1,$2)', [assessment.id, JSON.stringify(results)]);
  const saved = (await query('INSERT INTO learning_plans(candidate_id,assessment_id,model,plan) VALUES($1,$2,$3,$4) RETURNING id', [id,assessment.id,plan.model,JSON.stringify({topics:plan.topics,evidence:plan.evidence,estimatedMinutes:plan.estimatedMinutes})])).rows[0];
  // Mark just the preview lesson reviewed so the capture opens read-only content.
  await query("INSERT INTO learning_sessions(candidate_id,plan_id,lesson_id,status,completed_at) VALUES($1,$2,$3,'completed',NOW())",[id,saved.id,plan.topics[0].sessions[0].id]);
  browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(token=>sessionStorage.setItem('skillpath_jwt',token),await signToken(id));
    const page = await context.newPage();
    await page.goto('http://localhost:5173');
    await page.getByRole('button',{name:'Learning plan',exact:true}).click();
    await page.getByRole('button',{name:'Review session',exact:true}).waitFor();
    await page.screenshot({path:`screenshots/prototype-refresh/live-hf-roadmap-replayed-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Review session',exact:true}).click();
    await page.locator('.lesson-reading').waitFor();
    await page.screenshot({path:`screenshots/prototype-refresh/live-hf-lesson-replayed-${width}.png`,fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    if(overflow) throw new Error(`Lesson overflow at ${width}px`);
    await context.close();
  }
  console.log('PASS: actual Hugging Face-generated content rendered on desktop and mobile. Account/completion state is a temporary capture fixture; no extra inference call.');
} finally {
  await browser?.close();
  if(id) await query('DELETE FROM candidates WHERE id=$1',[id]);
  await pool.end();
}
