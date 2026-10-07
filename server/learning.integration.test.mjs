import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pool, { query } from './db.mjs';
import { generateLearningPlan, learningOverview, mutateLearning } from './learningService.mjs';
import { FULL_STACK_SKILLS } from './domainConfig.mjs';

test('Learning persistence and provider contract (provider response is a test fixture)', async t => {
  const ids=[]; const originalFetch=globalThis.fetch; const originalToken=process.env.HF_TOKEN;
  t.after(async()=>{globalThis.fetch=originalFetch;if(originalToken===undefined)delete process.env.HF_TOKEN;else process.env.HF_TOKEN=originalToken;for(const id of ids)await query('DELETE FROM candidates WHERE id=$1',[id]);await pool.end();});
  const create=async()=>{const c=(await query("INSERT INTO candidates(name,email,email_verified_at,profile_complete) VALUES('Learning Test',$1,NOW(),TRUE) RETURNING *",[`learning-${randomUUID()}@example.com`])).rows[0];ids.push(c.id);return c;};
  const candidate=await create(), other=await create();
  await assert.rejects(generateLearningPlan(candidate),e=>e.statusCode===409);
  const assessment=(await query("INSERT INTO skill_assessments(candidate_id,status,due_at) VALUES($1,'submitted',NOW()) RETURNING id",[candidate.id])).rows[0];
  await query('INSERT INTO skill_assessment_results(assessment_id,results) VALUES($1,$2)',[assessment.id,JSON.stringify(FULL_STACK_SKILLS.map(skill=>({skill,correct:false})))]);
  process.env.HF_TOKEN='';
  await t.test('missing token produces an honest configuration error',async()=>{await assert.rejects(generateLearningPlan(candidate),e=>e.statusCode===503);});
  process.env.HF_TOKEN='test-only-token';
  const content='A transaction groups related writes into one atomic operation. When transferring a balance, subtract from one account and add to the other in the same transaction. If either step fails, roll back both writes. Use BEGIN, run both parameterized updates, then COMMIT. In the catch handler issue ROLLBACK. This prevents partially applied changes and keeps the application data consistent.';
  const fixture={topics:FULL_STACK_SKILLS.map(skill=>({skill,reason:'The assessment indicates that this skill requires focused practice.',sessions:[0,1].map(i=>({title:`${skill} practice ${i+1}`,objective:'Practice an individual full stack engineering concept.',content,exercise:'Write a small example and explain what happens when the second operation fails.',question:'Which approach keeps related database writes atomic?',choices:['Use one transaction','Send unrelated requests','Ignore failures','Skip validation'],correctChoice:0,explanation:'One transaction commits related changes together or rolls them back together.'}))}))};
  await t.test('provider permission failures are actionable and do not save partial plans',async()=>{globalThis.fetch=async()=>new Response('{}',{status:403});await assert.rejects(generateLearningPlan(candidate),e=>e.statusCode===503 && e.message.includes('Inference Providers'));assert.equal((await learningOverview(candidate.id)).plan,null);});
  let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://router.huggingface.co/v1/chat/completions');const payload=JSON.parse(options.body);assert.ok(!options.body.includes(candidate.email));assert.ok(!options.body.includes(candidate.name));assert.ok(!options.body.includes(candidate.id));const batch=JSON.parse(payload.messages[1].content).evidence;assert.ok(batch.length<=2);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({topics:fixture.topics.filter(t=>batch.some(e=>e.skill===t.skill))})}}]}),{status:200});};
  let plan;
  await t.test('anonymous provider contract, plan validation, saved results and idempotent generation',async()=>{plan=(await generateLearningPlan(candidate)).plan;assert.equal(plan.topics.length,11);assert.equal(plan.estimatedMinutes,220);assert.equal(plan.topics[0].sessions[0].correctChoice,undefined);assert.equal((await generateLearningPlan(candidate)).plan.id,plan.id);assert.equal(calls,6);assert.equal((await learningOverview(other.id)).plan,null);});
  const lessonId=plan.topics[0].sessions[0].id;
  await t.test('ownership, minimum duration, wrong answer and persistent completion',async()=>{
    await assert.rejects(mutateLearning(other.id,'start',{planId:plan.id,lessonId}),e=>e.statusCode===404);
    const session=await mutateLearning(candidate.id,'start',{planId:plan.id,lessonId});
    await assert.rejects(mutateLearning(other.id,'complete',{sessionId:session.id,answer:0}),e=>e.statusCode===404);
    await assert.rejects(mutateLearning(candidate.id,'complete',{sessionId:session.id,answer:0}),e=>e.statusCode===409);
    // Advance server timestamps only for this test fixture, not the production timer.
    await query("UPDATE learning_sessions SET started_at=NOW()-INTERVAL '601 seconds' WHERE id=$1",[session.id]);
    assert.equal((await mutateLearning(candidate.id,'complete',{sessionId:session.id,answer:2})).correct,false);
    assert.equal((await learningOverview(candidate.id)).plan.completed.length,0);
    assert.equal((await mutateLearning(candidate.id,'complete',{sessionId:session.id,answer:0})).status,'completed');
    assert.equal((await mutateLearning(candidate.id,'complete',{sessionId:session.id,answer:0})).status,'completed');
    assert.equal((await learningOverview(candidate.id)).plan.completed.length,1);
  });
  await t.test('lost heartbeat and explicit exit discard only the current attempt',async()=>{
    const next=plan.topics[0].sessions[1].id;
    const session=await mutateLearning(candidate.id,'start',{planId:plan.id,lessonId:next});
    await query("UPDATE learning_sessions SET last_seen_at=NOW()-INTERVAL '30 seconds' WHERE id=$1",[session.id]);
    assert.equal((await mutateLearning(candidate.id,'heartbeat',{sessionId:session.id})).status,'abandoned');
    const retry=await mutateLearning(candidate.id,'start',{planId:plan.id,lessonId:next});
    assert.notEqual(retry.id,session.id);
    assert.equal((await mutateLearning(candidate.id,'abandon',{sessionId:retry.id})).status,'abandoned');
    assert.equal((await learningOverview(candidate.id)).plan.completed.length,1);
  });
});
