import test from 'node:test';
import assert from 'node:assert/strict';
import { completionAllowed, publicPlan, skillEvidence, validatePlan } from './learningPolicy.mjs';

test('per-skill scoring keeps weak skills separate',()=>{
  const evidence=skillEvidence([{skill:'HTML',correct:true},{skill:'CSS',correct:false}],[{skill:'HTML',final_score:100},{skill:'CSS',final_score:20}]);
  assert.equal(evidence.find(s=>s.skill==='HTML').score,100);
  assert.equal(evidence.find(s=>s.skill==='CSS').score,8);
  assert.equal(evidence.find(s=>s.skill==='React').score,null);
});
test('a high blend cannot hide a failed modality',()=>{
  const s=skillEvidence([{skill:'HTML',correct:true}],[{skill:'HTML',final_score:60}])[0];
  assert.equal(s.score,84); assert.equal(s.skippable,false);
});
test('missing interview evidence is not converted to zero',()=>{
  const s=skillEvidence([{skill:'HTML',correct:true}],[])[0];
  assert.equal(s.chat,null); assert.equal(s.score,100); assert.equal(s.skippable,true);
});
test('incomplete and malformed provider plans fail closed',()=>{
  const evidence=skillEvidence([],[]);
  assert.throws(()=>validatePlan({topics:[]},evidence));
  assert.throws(()=>validatePlan(null,evidence));
  assert.throws(()=>validatePlan({topics:[{skill:'HTML',reason:'Short'}]},[{skill:'HTML',skippable:false}]));
});
test('no forced remedial topics when all skills meet threshold',()=>{
  assert.deepEqual(validatePlan({topics:[]},[{skill:'HTML',skippable:true}]).topics,[]);
});
test('public plans never contain checkpoint answer keys',()=>{
  const plan=publicPlan({id:'1',plan:{topics:[{skill:'HTML',sessions:[{id:'x',correctChoice:1,explanation:'secret',title:'Title'}]}]}});
  assert.equal('correctChoice' in plan.topics[0].sessions[0],false);
  assert.equal('explanation' in plan.topics[0].sessions[0],false);
});
test('completion requires ten minutes and a live heartbeat',()=>{
  const now=Date.now();
  const session={status:'active',started_at:new Date(now-600000),last_seen_at:new Date(now-8000)};
  assert.equal(completionAllowed(session,now),true);
  assert.equal(completionAllowed({...session,started_at:new Date(now-599000)},now),false);
  assert.equal(completionAllowed({...session,last_seen_at:new Date(now-26000)},now),false);
  assert.equal(completionAllowed({...session,status:'abandoned'},now),false);
});
