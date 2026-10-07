import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import bcrypt from 'bcrypt';
import pool, { query } from '../server/db.mjs';
import { skillEvidence } from '../server/learningPolicy.mjs';

const base=process.env.TEST_BASE_URL || 'http://localhost:5173';
const out='screenshots/prototype-refresh';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--auto-select-desktop-capture-source=Entire screen','--allow-http-screen-capture','--enable-usermedia-screen-capturing']});
const suffix=randomUUID().slice(0,8), username=`review_${suffix}`,password=`Review-${randomUUID()}`;
let candidateId;
const report=[];
try {
  const candidate=(await query(`INSERT INTO candidates(name,email,username,password_hash,email_verified_at,profile_complete,qualification,interested_roles,claimed_skills,setup) VALUES($1,$2,$3,$4,NOW(),TRUE,'Bachelor Degree',$5,$6,$7) RETURNING *`,['Review Test',`${username}@example.com`,username,await bcrypt.hash(password,12),['Associate Software Engineer'],['HTML','CSS'],JSON.stringify({firstName:'Review',lastName:'Test',age:'22',collegeName:'Other',customCollegeName:'Test Institute',collegeCity:'Chennai',degree:'B.Tech',branch:'Computer Science and Engineering',cgpa:'8',startYear:'2022',endYear:'2026'})])).rows[0];
  candidateId=candidate.id;
  for(const viewport of [{width:1440,height:900},{width:800,height:1024},{width:390,height:844},{width:320,height:740}]) {
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const capture=async(name)=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${out}/${name}-${viewport.width}.png`,fullPage:true});const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,`${name} overflow ${JSON.stringify(size)}`);report.push({name,width:viewport.width,horizontalOverflow:false});};
    await page.goto(base);await page.getByRole('heading',{name:'SkillPath',exact:true}).waitFor();await page.locator('.welcome-hero img').evaluate(img=>img.decode());await capture('welcome');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.locator('#auth-username').waitFor();await capture('signin');
    await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByLabel('Email address',{exact:true}).waitFor();await capture('signup');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Forgot password?',exact:true}).click();await capture('recovery');
    await page.getByRole('button',{name:'Back to sign in',exact:true}).click();await page.getByLabel('Username or email').fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text');await page.getByRole('button',{name:'Hide password',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('heading',{name:'Welcome back, Review'}).waitFor();await page.getByText('Loading saved learning progress...').waitFor({state:'hidden'});await capture('dashboard-new-fixture');
    await page.getByRole('button',{name:'Assessments & results',exact:true}).click();await capture('results-fixture');
    await page.getByRole('button',{name:'Learning plan',exact:true}).click();await capture('roadmap-empty-fixture');
    await page.getByRole('button',{name:'My profile',exact:true}).click();await capture('profile-fixture');
    await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.getByRole('heading',{name:'Profile setup',exact:true}).waitFor();await capture('setup-personal-fixture');
    await page.getByRole('button',{name:'2. Education',exact:true}).click();await capture('setup-education-fixture');
    await page.getByRole('button',{name:'3. Career goals',exact:true}).click();await capture('setup-career-fixture');
    await page.getByRole('button',{name:'Review profile',exact:true}).click();
    await page.route('**/api/auth/profile',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test save failure. Please retry.'})}),{times:1});
    await page.getByRole('button',{name:'Save profile',exact:true}).click();
    await page.getByText('Test save failure. Please retry.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Edit',exact:true}).isEnabled(),true);
    await page.getByRole('button',{name:'Dismiss',exact:true}).click();
    await page.getByRole('button',{name:'Save profile',exact:true}).click();
    await page.getByRole('heading',{name:'Welcome back, Review'}).waitFor();
    await page.getByRole('button',{name:'My profile',exact:true}).click();
    await page.getByText('Test Institute',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Edit profile',exact:true}).click();
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Prepare for assessment',exact:true}).click();await capture('guidelines-fixture');
    const consent=page.getByRole('checkbox');await consent.check();assert.equal(await consent.isChecked(),true);
    assert.deepEqual(errors,[]);await context.close();
  }
  const assessment=(await query("INSERT INTO skill_assessments(candidate_id,status,due_at) VALUES($1,'submitted',NOW()) RETURNING id",[candidateId])).rows[0];
  const results=[{skill:'HTML',correct:false},{skill:'CSS',correct:true}];
  await query('INSERT INTO skill_assessment_results(assessment_id,score,total,correct_count,results) VALUES($1,50,2,1,$2)',[assessment.id,JSON.stringify(results)]);
  const sessions=[{id:'html-1',title:'Semantic forms',objective:'Choose native controls with accessible names.',content:'Native form controls provide keyboard behavior, semantics, and form submission. Use a label associated with every input and a button of type submit. Avoid using a div as a button: it does not receive keyboard focus or support activation without additional code. Example: <label for="email">Email</label><input id="email" type="email"><button type="submit">Subscribe</button>.',exercise:'Build an email form and test the entire flow using only your keyboard.',question:'Which element provides native form submission?',choices:['button type=submit','div','span','section'],correctChoice:0,explanation:'A submit button participates in native form submission and supports keyboard activation.',minutes:10},{id:'html-2',title:'Accessible document structure',objective:'Organize content using landmarks and headings.',content:'Use the main landmark for primary content and nav for navigation. Arrange headings in a meaningful hierarchy that describes the sections. A section should usually have a heading. Keep repeated navigation outside main so assistive technology can locate the primary content quickly. Example: <main><h1>Learning plan</h1><section><h2>HTML fundamentals</h2><p>Session content</p></section></main>.',exercise:'Create a page with a main landmark, a navigation region, and two clearly titled sections.',question:'Which landmark represents the primary content?',choices:['footer','main','aside','nav'],correctChoice:1,explanation:'The main element identifies the dominant content of the document.',minutes:10}];
  const plan=(await query('INSERT INTO learning_plans(candidate_id,assessment_id,model,plan) VALUES($1,$2,$3,$4) RETURNING id',[candidateId,assessment.id,'browser-test-fixture',JSON.stringify({estimatedMinutes:20,evidence:skillEvidence(results,[]),topics:[{id:'html',skill:'HTML',reason:'Test fixture: practice native form controls and document landmarks.',sessions}]})])).rows[0];
  await query("INSERT INTO learning_sessions(candidate_id,plan_id,lesson_id,status,completed_at) VALUES($1,$2,'html-1','completed',NOW())",[candidateId,plan.id]);
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    const context=await browser.newContext({viewport});const page=await context.newPage();await page.goto(base);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Username or email').fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Welcome back, Review'}).waitFor();await page.getByText('Loading saved learning progress...').waitFor({state:'hidden'});await page.screenshot({path:`${out}/dashboard-populated-fixture-${viewport.width}.png`,fullPage:true});
    for(const [label,name] of [['Learning plan','roadmap-populated'],['Learning progress','progress-populated']]) {await page.getByRole('button',{name:label,exact:true}).click();await page.screenshot({path:`${out}/${name}-fixture-${viewport.width}.png`,fullPage:true});}
    await page.getByRole('button',{name:'Learning plan',exact:true}).click();await page.getByRole('button',{name:'Start session',exact:true}).click();await page.getByRole('heading',{name:'Prepare for a focused session'}).waitFor();await page.screenshot({path:`${out}/learning-preparation-fixture-${viewport.width}.png`,fullPage:true});await page.getByRole('button',{name:'Learning plan',exact:true}).click();await page.reload();await page.getByRole('heading',{name:'Welcome back, Review'}).waitFor();await page.getByText('1 / 2',{exact:true}).waitFor();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'SkillPath',exact:true}).waitFor();await context.close();
  }
  await writeFile(`${out}/results.json`,JSON.stringify({passed:true,checks:report,fixtureNotice:'Authenticated screenshots use a temporary database test account. Populated roadmap is a test fixture, not live Hugging Face output. No real media permissions or 10-minute browser session claimed.'},null,2));
  console.log(`PASS: ${report.length} responsive captures, real credential login/logout, password toggle, setup navigation, persisted plan reload. Screenshots: ${out}`);
} finally {await browser.close();if(candidateId)await query('DELETE FROM candidates WHERE id=$1',[candidateId]);await pool.end();}
