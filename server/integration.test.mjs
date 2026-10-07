import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeterministicSkillAssessment } from './deterministicSkillAssessment.mjs';
import { PDFDocument } from 'pdf-lib';
import { randomBytes, createHash } from 'node:crypto';
import pool, { query } from './db.mjs';

const base = process.env.TEST_API_URL || 'http://localhost:8787';
const suffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
let token; let secondToken; let candidate;
const testCandidateIds = [];
async function request(path, body, credential = token, method = 'POST') {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function verifyTestAccount(id) {
  testCandidateIds.push(id);
  // Seed only the test account's delivery credential; exercise the real verification endpoint.
  // Actual SMTP delivery and unverified access are covered by test:auth.
  const raw = randomBytes(32).toString('hex');
  await query(`INSERT INTO account_tokens (candidate_id, purpose, token_hash, expires_at)
    VALUES ($1, 'verify', $2, NOW()+INTERVAL '5 minutes')`, [id, createHash('sha256').update(raw).digest('hex')]);
  assert.equal((await request('/api/auth/verify-email', { token: raw }, null)).status, 200);
}
const profile = { name: 'Test Candidate', qualification: 'Bachelor Degree', domain: 'Full Stack Engineering', interestedRoles: ['Associate Software Engineer'], claimedSkills: ['React'], setup: { age: '24', collegeCity: 'Bengaluru', collegeName: 'Vellore Institute of Technology', degree: 'B.Tech', branch: 'Computer Science and Engineering', cgpa: '8.4', startYear: '2021', endYear: '2025' }, resumeFileName: 'resume.pdf' };
test('account and assessment integration', async t => {
  t.after(async () => {
    for (const id of testCandidateIds) await query('DELETE FROM candidates WHERE id=$1', [id]);
    await pool.end();
  });
  await t.test('passwordless login is rejected', async () => { assert.equal((await request('/api/auth/login', { email: 'victim@example.com' }, null)).status, 401); });
  await t.test('register creates account without completing profile', async () => {
    const response = await request('/api/auth/register', { username: `user${suffix}`, email: `user${suffix}@example.com`, password: 'StrongPassword123!' }, null);
    assert.equal(response.status, 200); token = response.body.token; candidate = response.body.candidate;
    assert.equal(candidate.profileComplete, false);
    assert.equal(candidate.emailVerified, false);
    await verifyTestAccount(candidate.id);
  });
  await t.test('duplicate registration cannot overwrite account', async () => {
    assert.equal((await request('/api/auth/register', { username: `user${suffix}`, email: candidate.email, password: 'OtherPassword123!' }, null)).status, 409);
  });
  await t.test('wrong password fails and correct password restores identity', async () => {
    assert.equal((await request('/api/auth/login_credentials', { username: candidate.email, password: 'wrong' }, null)).status, 401);
    const response = await request('/api/auth/login_credentials', { username: candidate.email, password: 'StrongPassword123!' }, null);
    assert.equal(response.status, 200); assert.equal(response.body.candidate.id, candidate.id);
  });
  await t.test('unverified Google credential cannot authenticate', async () => { assert.ok([401, 503].includes((await request('/api/auth/google', { credential: 'forged' }, null)).status)); });
  await t.test('incomplete profile cannot start an assessment', async () => { assert.equal((await request('/api/skill-assessment', {})).status, 409); });
  await t.test('PDF restriction is enforced server-side', async () => { assert.equal((await request('/api/auth/profile', { ...profile, resumeFileName: 'resume.docx' })).status, 400); });
  await t.test('PDF upload rejects forged content and accepts a parsed PDF', async () => {
    assert.equal((await request('/api/auth/document', { kind: 'resume', filename: 'fake.pdf', content: Buffer.from('%PDF-fake').toString('base64') })).status, 400);
    const pdf = await PDFDocument.create(); pdf.addPage();
    const response = await request('/api/auth/document', { kind: 'resume', filename: 'resume.pdf', content: Buffer.from(await pdf.save()).toString('base64') });
    assert.equal(response.status, 200);
  });
  await t.test('profile is saved against authenticated account and survives reload', async () => {
    assert.equal((await request('/api/auth/profile', { ...profile, email: 'other@example.com' })).status, 200);
    const response = await request('/api/auth/me', null, token, 'GET');
    assert.equal(response.body.email, candidate.email); assert.equal(response.body.setup.age, '24'); assert.equal(response.body.profileComplete, true);
  });
  await t.test('create second account', async () => {
    const response = await request('/api/auth/register', { username: `other${suffix}`, email: `other${suffix}@example.com`, password: 'StrongPassword123!' }, null);
    secondToken = response.body.token; assert.equal(response.status, 200);
    await verifyTestAccount(response.body.candidate.id);
    assert.equal((await request('/api/auth/profile', { ...profile, resumeFileName: undefined }, secondToken)).status, 200);
  });
  let assessment;
  await t.test('duplicate starts return the same assessment with hidden answer key', async () => {
    const [a,b] = await Promise.all([request('/api/skill-assessment', {}), request('/api/skill-assessment', {})]);
    assert.equal(a.status, 200); assert.equal(a.body.assessmentId, b.body.assessmentId); assessment = a.body;
    assert.equal(assessment.items[0].correctChoice, undefined);
  });
  await t.test('cross-account submission is denied', async () => { assert.equal((await request('/api/skill-assessment/submit', { assessmentId: assessment.assessmentId, answers: {} }, secondToken)).status, 403); });
  await t.test('motion is recorded without automatic disqualification', async () => {
    const response = await request('/api/skill-assessment/proctor', { assessmentId: assessment.assessmentId, type: 'camera_motion' });
    assert.equal(response.body.warningCount, 0); assert.equal(response.body.status, 'active');
  });
  await t.test('null answers score zero and repeat submission preserves original result', async () => {
    const answers = Object.fromEntries(assessment.items.map(item => [item.id, null]));
    const response = await request('/api/skill-assessment/submit', { assessmentId: assessment.assessmentId, answers });
    assert.equal(response.status, 200); assert.equal(response.body.score, 0);
    const retry = await request('/api/skill-assessment/submit', { assessmentId: assessment.assessmentId, answers: Object.fromEntries(buildDeterministicSkillAssessment().map(item => [item.id, item.correctChoice])) });
    assert.equal(retry.body.score, 0);
    const restored = await request('/api/auth/me', null, token, 'GET');
    assert.equal(restored.status, 200);
    assert.equal(restored.body.latestResult.score, 0);
    assert.ok(restored.body.assessmentHistory.some(item => item.type === 'deterministic' && item.id === assessment.assessmentId && item.status === 'submitted'));
  });
  await t.test('screen-share loss terminates and blocks scoring', async () => {
    const created = await request('/api/skill-assessment', {});
    const id = created.body.assessmentId;
    const stopped = await request('/api/skill-assessment/proctor', { assessmentId: id, type: 'screen_track_ended' });
    assert.equal(stopped.body.status, 'terminated');
    assert.equal((await request('/api/skill-assessment/submit', { assessmentId: id, answers: {} })).status, 409);
  });
  await t.test('chatbot starts, enforces ownership and progresses after an answer', async () => {
    const response = await request('/api/agent/start', {});
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const session = response.body;
    assert.ok(session.currentQuestion?.id);
    assert.equal((await request(`/api/agent/session?sessionId=${session.sessionId}`, null, secondToken, 'GET')).status, 404);
    const answered = await request('/api/agent/answer', { sessionId: session.sessionId, questionId: session.currentQuestion.id, answer: 'I do not know.' });
    assert.equal(answered.status, 200); assert.notEqual(answered.body.currentQuestion?.id, session.currentQuestion.id);
    const restored = await request('/api/auth/me', null, token, 'GET');
    assert.ok(restored.body.assessmentHistory.some(item => item.type === 'chatbot' && item.id === session.sessionId));
  });
});
