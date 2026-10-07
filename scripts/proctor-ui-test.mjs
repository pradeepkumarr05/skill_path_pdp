import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pool,{query} from '../server/db.mjs';
import { signToken } from '../server/auth.mjs';
import { mkdir,writeFile } from 'node:fs/promises';

const out='screenshots/prototype-refresh';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--auto-select-desktop-capture-source=Entire screen','--allow-http-screen-capture','--enable-usermedia-screen-capturing']});
let id;
try {
  const candidate=(await query("INSERT INTO candidates(name,email,email_verified_at,profile_complete,qualification,interested_roles) VALUES('Proctor Test',$1,NOW(),TRUE,'Bachelor Degree',$2) RETURNING id",[`proctor-${randomUUID()}@example.com`,['Associate Software Engineer']])).rows[0];id=candidate.id;
  const token=await signToken(id);
  const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['camera','microphone']});
  await context.addInitScript(value=>sessionStorage.setItem('skillpath_jwt',value),token);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173');await page.getByRole('button',{name:'Prepare for assessment',exact:true}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Continue to skill assessment',exact:true}).click();
  await page.getByRole('heading',{name:'Knowledge assessment',exact:true}).waitFor();await page.getByText('Question 1 of 22',{exact:true}).waitFor();assert.equal(await page.locator('article').count(),1);
  const choices=page.locator('article button');await choices.first().click();const first=await page.locator('article h2').textContent();await page.getByRole('button',{name:'Next',exact:true}).click();assert.notEqual(await page.locator('article h2').textContent(),first);assert.equal(await page.locator('article').count(),1);await page.getByRole('button',{name:'Previous',exact:true}).click();assert.equal(await page.locator('article h2').textContent(),first);
  await page.screenshot({path:`${out}/knowledge-question-fixture-1440.png`,fullPage:true});
  await context.close();
  const assessment=(await query("SELECT id FROM skill_assessments WHERE candidate_id=$1 ORDER BY created_at DESC LIMIT 1",[id])).rows[0];
  await query("UPDATE skill_assessments SET status='submitted' WHERE id=$1",[assessment.id]);
  await query('INSERT INTO skill_assessment_results(assessment_id,results) VALUES($1,$2)',[assessment.id,JSON.stringify([{skill:'HTML',correct:false}])]);
  const lesson={id:'html-proctor-test',title:'Accessible HTML forms',objective:'Practice native form controls and labels.',content:'Native HTML controls provide keyboard support and form behavior. A label connected to an input provides its accessible name. Use <button type="submit">Save</button> inside a form. The browser handles keyboard activation and form submission. A plain div does not provide these behaviors. Use native elements before adding custom JavaScript.',exercise:'Build a form with a labeled email input and a submit button. Test it using only the keyboard.',question:'Which element natively submits a form?',choices:['button type=submit','div','span','main'],correctChoice:0,explanation:'A submit button participates in form submission.',minutes:10};
  await query('INSERT INTO learning_plans(candidate_id,assessment_id,model,plan) VALUES($1,$2,$3,$4)',[id,assessment.id,'proctor-browser-test-fixture',JSON.stringify({topics:[{id:'html',skill:'HTML',reason:'Test fixture for media and session lifecycle.',sessions:[lesson]}],evidence:[],estimatedMinutes:10})]);
  const learningContext=await browser.newContext({viewport:{width:1440,height:900},permissions:['camera','microphone']});await learningContext.addInitScript(value=>sessionStorage.setItem('skillpath_jwt',value),token);const learning=await learningContext.newPage();
  await learning.goto('http://localhost:5173');await learning.getByRole('button',{name:'Learning plan',exact:true}).click();await learning.getByRole('button',{name:'Start session',exact:true}).click();await learning.getByRole('button',{name:'Start 10-minute session',exact:true}).click();await learning.getByRole('heading',{name:'Knowledge checkpoint',exact:true}).waitFor();
  assert.equal(await learning.getByRole('button',{name:'Available after 10 minutes',exact:true}).isDisabled(),true);
  await learning.getByRole('textbox',{name:'Practice workspace',exact:true}).fill('const practice = "attempt-local draft";');
  await learning.screenshot({path:`${out}/learning-active-simulated-media-1440.png`,fullPage:true});
  const active=(await query("SELECT id FROM learning_sessions WHERE candidate_id=$1 AND status='active'",[id])).rows[0];assert.ok(active);
  await learning.evaluate(()=>window.dispatchEvent(new Event('blur')));await learning.getByRole('heading',{name:'Restart this session',exact:true}).waitFor();
  for(let i=0;i<30;i++){const s=(await query('SELECT status FROM learning_sessions WHERE id=$1',[active.id])).rows[0];if(s.status==='abandoned')break;await new Promise(r=>setTimeout(r,100));}
  assert.equal((await query('SELECT status FROM learning_sessions WHERE id=$1',[active.id])).rows[0].status,'abandoned');
  assert.equal((await query("SELECT COUNT(*)::int AS count FROM learning_sessions WHERE candidate_id=$1 AND status='completed'",[id])).rows[0].count,0);
  await learning.screenshot({path:`${out}/learning-abandoned-simulated-media-1440.png`,fullPage:true});
  if(process.env.TEST_REAL_TEN_MINUTES !== '1') {
    await learning.getByRole('button',{name:'Start 10-minute session',exact:true}).click();
    await learning.getByRole('heading',{name:'Knowledge checkpoint',exact:true}).waitFor();
    assert.equal(await learning.getByRole('textbox',{name:'Practice workspace',exact:true}).inputValue(),'');
    await learning.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await learning.getByRole('heading',{name:'Restart this session',exact:true}).waitFor();
  }
  if(process.env.TEST_REAL_TEN_MINUTES === '1') {
    await learning.getByRole('button',{name:'Start 10-minute session',exact:true}).click();
    await learning.getByRole('heading',{name:'Knowledge checkpoint',exact:true}).waitFor();
    await learning.getByRole('button',{name:'Learning plan',exact:true}).click();
    await learning.getByRole('button',{name:'Keep studying',exact:true}).click();
    assert.equal(await learning.getByRole('heading',{name:'Knowledge checkpoint',exact:true}).isVisible(),true);
    await learning.getByRole('radio').first().check();
    console.log('Waiting for the real 600-second server timer; no timestamp or browser-clock manipulation.');
    for(let minute=1;minute<=10;minute++) {
      await learning.waitForTimeout(60000);
      assert.equal((await query("SELECT status FROM learning_sessions WHERE candidate_id=$1 ORDER BY started_at DESC LIMIT 1",[id])).rows[0].status,'active');
      console.log(`Real session elapsed: ${minute} minute(s).`);
    }
    await learning.getByRole('button',{name:'Complete session',exact:true}).click({timeout:15000});
    await learning.getByRole('heading',{name:'Session completed',exact:true}).waitFor();
    await learning.screenshot({path:`${out}/learning-completed-real-timer-simulated-media-1440.png`,fullPage:true});
    assert.equal((await query("SELECT COUNT(*)::int AS count FROM learning_sessions WHERE candidate_id=$1 AND status='completed'",[id])).rows[0].count,1);
    await learning.getByRole('button',{name:'Continue to learning plan',exact:true}).click();
    await learning.reload();
    await learning.getByText('1 / 1',{exact:true}).waitFor();
    await writeFile(`${out}/real-timer-results.json`,JSON.stringify({passed:true,wallClockSeconds:600,clockManipulation:false,checks:['Canceled exit keeps attempt active','Ten minutes of real heartbeats','Correct checkpoint saved completion','Reload retains completion'],limitations:'Real application and database with fixture lesson and Chromium simulated camera/screen.'},null,2));
  }
  await learningContext.close();assert.deepEqual(errors,[]);
  await writeFile(`${out}/proctor-results.json`,JSON.stringify({passed:true,checks:['One MCQ rendered at a time','Next and previous question navigation','Learning starts with simulated camera/screen/fullscreen','Completion disabled before ten minutes','Window blur discards attempt on server','No completion credit after abandonment'],limitations:'Chromium simulated media; synthetic blur event. Not a real-camera quality or anti-cheating certification.'},null,2));
  console.log('PASS: single-question assessment, simulated-media lesson start, server-confirmed discard on window blur.');
}finally{await browser.close();if(id){await query('DELETE FROM proctor_events WHERE assessment_id IN (SELECT id FROM skill_assessments WHERE candidate_id=$1)',[id]);await query('DELETE FROM candidates WHERE id=$1',[id]);}await pool.end();}
