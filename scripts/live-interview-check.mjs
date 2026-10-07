import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import pool, { query, withTransaction } from '../server/db.mjs';
import { startAgenticSession, submitAgenticAnswer } from '../server/agentRuntimeDb.mjs';

// Opt-in live inference check. Never substitute heuristic scoring in this run.
process.env.ALLOW_DETERMINISTIC_AI_FALLBACK = 'false';
let id;
try {
  const candidate = (await query("INSERT INTO candidates(name,email,email_verified_at,profile_complete,claimed_skills) VALUES('Synthetic Interview',$1,NOW(),TRUE,$2) RETURNING *", [`interview-${randomUUID()}@example.com`, ['HTML']])).rows[0];
  id = candidate.id;
  const profile = { name: candidate.name, email: candidate.email, qualification: 'Bachelor Degree', domain: 'Full Stack Engineering', interestedRoles: ['Associate Software Engineer'], claimedSkills: ['HTML'] };
  let session = await withTransaction(() => startAgenticSession(profile, id));
  assert.ok(session.currentQuestion?.text);
  const question = session.currentQuestion.text;
  session = await withTransaction(() => submitAgenticAnswer(session.sessionId, { questionId: session.currentQuestion.id, answer: 'I do not know the answer to this question.' }, id));
  assert.equal(session.status, 'completed');
  const attempts = (await query('SELECT score, feedback FROM chat_skill_attempts WHERE session_id=$1', [session.sessionId])).rows;
  assert.equal(attempts.length, 1);
  assert.ok(Number(attempts[0].score) < 65);
  await mkdir('screenshots/prototype-refresh', { recursive: true });
  await writeFile('screenshots/prototype-refresh/live-interview-results.json', JSON.stringify({ passed: true, provider: 'Gemini', deterministicFallback: false, question, syntheticAnswer: 'I do not know the answer to this question.', evaluation: attempts[0], status: session.status }, null, 2));
  console.log('PASS: live Gemini question, live evaluation, server-controlled progression, persisted result; deterministic fallback disabled.');
} finally {
  if (id) await query('DELETE FROM candidates WHERE id=$1', [id]);
  await pool.end();
}
