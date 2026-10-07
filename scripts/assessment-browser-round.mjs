import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import pool, { query } from '../server/db.mjs';
import { signToken } from '../server/auth.mjs';

const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--auto-select-desktop-capture-source=Entire screen','--allow-http-screen-capture','--enable-usermedia-screen-capturing']});
let id;
try {
  id = (await query("INSERT INTO candidates(name,email,email_verified_at,profile_complete,interested_roles) VALUES('Assessment Trial',$1,NOW(),TRUE,$2) RETURNING id", [`round-${randomUUID()}@example.com`, ['Associate Software Engineer']])).rows[0].id;
  const context = await browser.newContext({viewport:{width:1440,height:900},permissions:['camera','microphone']});
  await context.addInitScript(token=>sessionStorage.setItem('skillpath_jwt',token),await signToken(id));
  const page = await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173');
  await page.getByRole('button',{name:'Prepare for assessment',exact:true}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Continue to skill assessment',exact:true}).click();
  await page.getByRole('heading',{name:'Knowledge assessment',exact:true}).waitFor();
  for(let i=1;i<=22;i++) {
    await page.getByText(`Question ${i} of 22`,{exact:true}).waitFor();
    assert.equal(await page.locator('article').count(),1);
    await page.locator('article button').first().click();
    if(i<22) await page.getByRole('button',{name:'Next',exact:true}).click();
  }
  await page.getByRole('button',{name:'Submit assessment',exact:true}).click();
  await page.getByRole('button',{name:'Continue to learning plan',exact:true}).waitFor();
  await page.screenshot({path:'screenshots/prototype-refresh/knowledge-result-browser-trial.png',fullPage:true});
  await page.getByRole('button',{name:'Continue to learning plan',exact:true}).click();
  await page.getByRole('button',{name:'Generate learning plan',exact:true}).waitFor();
  const result = (await query('SELECT r.total,r.score FROM skill_assessment_results r JOIN skill_assessments a ON a.id=r.assessment_id WHERE a.candidate_id=$1',[id])).rows[0];
  assert.equal(result.total,22);
  await page.reload();
  await page.getByRole('button',{name:'Assessments & results',exact:true}).click();
  await page.getByText(`${result.score}% overall`,{exact:true}).waitFor();
  await page.screenshot({path:'screenshots/prototype-refresh/assessment-results-persisted-browser-trial.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile('screenshots/prototype-refresh/assessment-round-results.json',JSON.stringify({passed:true,questionsAnswered:22,result,checks:['Single-question navigation','All answers submitted through UI','Result persisted','Learning generation unlocked','Reload restores score'],limitations:'Temporary verified test account; simulated proctor media; deliberately selects first choice, not a performance benchmark.'},null,2));
  console.log('PASS: all 22 questions answered in browser, submitted, result saved, learning generation unlocked, reload restored score.');
} finally {
  await browser.close();
  if(id) { await query('DELETE FROM proctor_events WHERE assessment_id IN (SELECT id FROM skill_assessments WHERE candidate_id=$1)',[id]); await query('DELETE FROM candidates WHERE id=$1',[id]); }
  await pool.end();
}
