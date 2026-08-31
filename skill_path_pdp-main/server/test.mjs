/**
 * server/test.mjs
 * End-to-end API test suite for SkillPath Module 1.
 *
 * Tests:
 *  1. Health check
 *  2. Auth — login (upsert candidate, get JWT)
 *  3. Auth — GET /api/auth/me
 *  4. Auth — reject unauthenticated requests
 *  5. Chatbot — start session (with claimed skills)
 *  6. Chatbot — submit answer
 *  7. Chatbot — proctor event
 *  8. Chatbot — start session (no claimed skills → skipped)
 *  9. MCQ — create skill assessment
 * 10. MCQ — submit all answers
 * 11. MCQ — proctor event
 * 12. MCQ — submit terminated assessment (should 409)
 *
 * Run with:  node server/test.mjs
 * Requires:  running API on http://localhost:8787 + DATABASE_URL in .env
 */

const BASE_URL = `http://localhost:${process.env.API_PORT || 8787}`;

// ── Colour helpers ──────────────────────────────────────────────────────────
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

// ── HTTP helpers ────────────────────────────────────────────────────────────
async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ── Test runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(name, condition, actual) {
  if (condition) {
    console.log(`  ${GREEN('✓')} ${name}`);
    passed++;
    results.push({ name, pass: true });
  } else {
    console.log(`  ${RED('✗')} ${name}`);
    if (actual !== undefined) {
      console.log(`    ${YELLOW('actual:')} ${JSON.stringify(actual, null, 2).slice(0, 200)}`);
    }
    failed++;
    results.push({ name, pass: false, actual });
  }
}

function section(title) {
  console.log(`\n${BOLD(title)}`);
}

// ── Test definitions ─────────────────────────────────────────────────────────

async function runTests() {
  console.log(BOLD(`\nSkillPath Module 1 — End-to-End API Tests`));
  console.log(`Base URL: ${BASE_URL}\n`);

  // ── 1. Health check ─────────────────────────────────────────────────────
  section('1. Health check');
  const health = await get('/api/health');
  assert('GET /api/health returns 200', health.status === 200, health.body);
  assert('ok: true', health.body.ok === true, health.body);
  assert('geminiConfigured field present', 'geminiConfigured' in health.body, health.body);

  // ── 2. Auth — login ────────────────────────────────────────────────────
  section('2. Auth — Login');
  const testEmail = `test-${Date.now()}@skillpath-test.com`;
  const loginRes = await post('/api/auth/login', {
    email: testEmail,
    name: 'Test Candidate',
    qualification: 'Bachelor Degree',
    domain: 'Full Stack Engineering',
    interestedRoles: ['Full Stack Developer Trainee'],
    claimedSkills: ['React', 'Node.js'],
  });
  assert('POST /api/auth/login returns 200', loginRes.status === 200, loginRes.body);
  assert('response has token', typeof loginRes.body.token === 'string' && loginRes.body.token.length > 10, loginRes.body);
  assert('response has candidate.id', typeof loginRes.body.candidate?.id === 'string', loginRes.body);
  assert('candidate.email matches', loginRes.body.candidate?.email === testEmail, loginRes.body);

  const token = loginRes.body.token;
  const candidateId = loginRes.body.candidate?.id;

  // ── 3. Auth — GET /api/auth/me ────────────────────────────────────────
  section('3. Auth — GET /api/auth/me');
  const meRes = await get('/api/auth/me', token);
  assert('GET /api/auth/me returns 200', meRes.status === 200, meRes.body);
  assert('returns same candidate id', meRes.body.id === candidateId, meRes.body);
  assert('returns claimed skills', Array.isArray(meRes.body.claimedSkills), meRes.body);

  // ── 4. Auth — reject unauthenticated ──────────────────────────────────
  section('4. Auth — reject unauthenticated requests');
  const noAuthRes = await post('/api/agent/start', { profile: {} }, null);
  assert('POST /api/agent/start without token returns 401', noAuthRes.status === 401, noAuthRes.body);
  assert('error message present', typeof noAuthRes.body.error === 'string', noAuthRes.body);

  const badTokenRes = await post('/api/agent/start', { profile: {} }, 'bad.token.here');
  assert('POST with invalid token returns 401', badTokenRes.status === 401, badTokenRes.body);

  // ── 5. Chatbot — start session (with claimed skills) ──────────────────
  section('5. Chatbot — start session with claimed skills');
  const profile = {
    name: 'Test Candidate',
    email: testEmail,
    qualification: 'Bachelor Degree',
    domain: 'Full Stack Engineering',
    interestedRoles: ['Full Stack Developer Trainee'],
    claimedSkills: ['React', 'Node.js'],
  };
  const startRes = await post('/api/agent/start', { profile }, token);
  assert('POST /api/agent/start returns 200', startRes.status === 200, startRes.body);
  assert('response has sessionId', typeof startRes.body.sessionId === 'string', startRes.body);
  assert('status is active', startRes.body.status === 'active', startRes.body);
  assert('has currentQuestion', startRes.body.currentQuestion !== null, startRes.body);
  assert('currentQuestion has text', typeof startRes.body.currentQuestion?.text === 'string', startRes.body.currentQuestion);
  assert('currentQuestion has dueAt', typeof startRes.body.currentQuestion?.dueAt === 'string', startRes.body.currentQuestion);
  assert('transcript has entries', Array.isArray(startRes.body.transcript) && startRes.body.transcript.length > 0, startRes.body.transcript);
  assert('skillStates populated', Array.isArray(startRes.body.skillStates) && startRes.body.skillStates.length > 0, startRes.body.skillStates);

  const sessionId = startRes.body.sessionId;
  const questionId = startRes.body.currentQuestion?.id;

  // ── 6. Chatbot — submit answer ────────────────────────────────────────
  section('6. Chatbot — submit answer');
  if (sessionId && questionId) {
    const answerRes = await post('/api/agent/answer', {
      sessionId,
      questionId,
      answer: 'React uses a virtual DOM to efficiently reconcile UI updates. The useState hook manages component-level state and triggers re-renders when state changes. React.memo and useMemo can optimize performance by preventing unnecessary re-renders.',
      timedOut: false,
    }, token);
    assert('POST /api/agent/answer returns 200', answerRes.status === 200, answerRes.body);
    assert('sessionId matches', answerRes.body.sessionId === sessionId, answerRes.body);
    assert('status is active or completed', ['active', 'completed'].includes(answerRes.body.status), answerRes.body);
    assert('transcript grew', Array.isArray(answerRes.body.transcript) && answerRes.body.transcript.length > startRes.body.transcript.length, answerRes.body.transcript?.length);
  } else {
    console.log(`  ${YELLOW('⚠ Skipping answer test — session or question not created (Gemini may be offline)')}`);
  }

  // ── 7. Chatbot — proctor event ────────────────────────────────────────
  section('7. Chatbot — proctor event');
  if (sessionId) {
    // Create a fresh session for proctor testing to avoid interference
    const proctorSession = await post('/api/agent/start', {
      profile: {
        ...profile,
        email: `proctor-${Date.now()}@skillpath-test.com`,
      },
    }, token);

    if (proctorSession.status === 200 && proctorSession.body.sessionId) {
      const proctorRes = await post('/api/agent/proctor', {
        sessionId: proctorSession.body.sessionId,
        type: 'tab_hidden',
        detail: 'Test: browser tab became hidden.',
      }, token);
      assert('POST /api/agent/proctor returns 200', proctorRes.status === 200, proctorRes.body);
      assert('warningCount incremented to 1', proctorRes.body.warningCount === 1, proctorRes.body);
    } else {
      console.log(`  ${YELLOW('⚠ Skipping proctor test — could not create fresh session')}`);
    }
  } else {
    console.log(`  ${YELLOW('⚠ Skipping proctor test — no active session')}`);
  }

  // ── 8. Chatbot — no claimed skills (skipped) ──────────────────────────
  section('8. Chatbot — no claimed skills → skipped');
  const noSkillEmail = `noskills-${Date.now()}@skillpath-test.com`;
  const noSkillLogin = await post('/api/auth/login', {
    email: noSkillEmail,
    name: 'No Skills Candidate',
    qualification: 'High School',
    domain: 'Full Stack Engineering',
    interestedRoles: [],
    claimedSkills: [],
  });

  if (noSkillLogin.status === 200) {
    const skippedRes = await post('/api/agent/start', {
      profile: { name: 'No Skills', email: noSkillEmail, qualification: 'High School', domain: 'Full Stack Engineering', interestedRoles: [], claimedSkills: [] },
    }, noSkillLogin.body.token);
    assert('skipped session returns 200', skippedRes.status === 200, skippedRes.body);
    assert('status is skipped', skippedRes.body.status === 'skipped', skippedRes.body);
    assert('skipped is true', skippedRes.body.skipped === true, skippedRes.body);
  } else {
    console.log(`  ${YELLOW('⚠ Skipping no-skills test — login failed')}`);
  }

  // ── 9. MCQ — create skill assessment ────────────────────────────────
  section('9. MCQ — create skill assessment');
  const mcqRes = await post('/api/skill-assessment', { profile }, token);
  assert('POST /api/skill-assessment returns 200', mcqRes.status === 200, mcqRes.body);
  assert('response has assessmentId', typeof mcqRes.body.assessmentId === 'string', mcqRes.body);
  assert('status is active', mcqRes.body.status === 'active', mcqRes.body);
  assert('items array present', Array.isArray(mcqRes.body.items) && mcqRes.body.items.length > 0, mcqRes.body);
  assert('items have id and choices', mcqRes.body.items[0]?.id && Array.isArray(mcqRes.body.items[0]?.choices), mcqRes.body.items[0]);
  assert('items do NOT expose correctChoice', !('correctChoice' in (mcqRes.body.items[0] ?? {})), mcqRes.body.items[0]);
  assert('dueAt is a future ISO date', typeof mcqRes.body.dueAt === 'string' && new Date(mcqRes.body.dueAt) > new Date(), mcqRes.body.dueAt);

  const assessmentId = mcqRes.body.assessmentId;
  const mcqItems = mcqRes.body.items || [];

  // ── 10. MCQ — submit all answers ─────────────────────────────────────
  section('10. MCQ — submit all answers');
  if (assessmentId && mcqItems.length > 0) {
    // Build answers map (always pick choice 0)
    const answers = {};
    for (const item of mcqItems) {
      answers[item.id] = 0;
    }

    const submitRes = await post('/api/skill-assessment/submit', {
      assessmentId,
      answers,
      timedOut: false,
    }, token);
    assert('POST /api/skill-assessment/submit returns 200', submitRes.status === 200, submitRes.body);
    assert('status is submitted', submitRes.body.status === 'submitted', submitRes.body);
    assert('score is 0-100', typeof submitRes.body.score === 'number' && submitRes.body.score >= 0 && submitRes.body.score <= 100, submitRes.body.score);
    assert('level is present', typeof submitRes.body.level === 'string', submitRes.body.level);
    assert('correctCount is number', typeof submitRes.body.correctCount === 'number', submitRes.body.correctCount);
    assert('total matches items count', submitRes.body.total === mcqItems.length, submitRes.body.total);
    assert('results array matches items', Array.isArray(submitRes.body.results) && submitRes.body.results.length === mcqItems.length, submitRes.body.results?.length);
    assert('results have explanation', typeof submitRes.body.results[0]?.explanation === 'string', submitRes.body.results[0]);
    assert('results have correctChoice', typeof submitRes.body.results[0]?.correctChoice === 'number', submitRes.body.results[0]);
  } else {
    console.log(`  ${YELLOW('⚠ Skipping MCQ submit test — assessment not created')}`);
  }

  // ── 11. MCQ — proctor event ───────────────────────────────────────────
  section('11. MCQ — proctor event');
  const mcqProctorEmail = `mcq-proctor-${Date.now()}@skillpath-test.com`;
  const mcqProctorLogin = await post('/api/auth/login', {
    email: mcqProctorEmail,
    name: 'MCQ Proctor Candidate',
    qualification: 'Bachelor Degree',
    domain: 'Full Stack Engineering',
    interestedRoles: [],
    claimedSkills: [],
  });

  if (mcqProctorLogin.status === 200) {
    const freshMcq = await post('/api/skill-assessment', {
      profile: { name: 'MCQ Proctor', email: mcqProctorEmail, qualification: 'Bachelor Degree', domain: 'Full Stack Engineering', interestedRoles: [], claimedSkills: [] },
    }, mcqProctorLogin.body.token);

    if (freshMcq.status === 200 && freshMcq.body.assessmentId) {
      const proctorRes = await post('/api/skill-assessment/proctor', {
        assessmentId: freshMcq.body.assessmentId,
        type: 'window_blur',
        detail: 'Assessment window lost focus.',
      }, mcqProctorLogin.body.token);
      assert('POST /api/skill-assessment/proctor returns 200', proctorRes.status === 200, proctorRes.body);
      assert('warningCount incremented', proctorRes.body.warningCount === 1, proctorRes.body);
    } else {
      console.log(`  ${YELLOW('⚠ Skipping MCQ proctor — assessment creation failed')}`);
    }
  } else {
    console.log(`  ${YELLOW('⚠ Skipping MCQ proctor — login failed')}`);
  }

  // ── 12. MCQ — submit terminated assessment (409) ──────────────────────
  section('12. MCQ — terminated assessment rejects submission');
  // Terminate via 3 proctor warnings
  const termEmail = `term-${Date.now()}@skillpath-test.com`;
  const termLogin = await post('/api/auth/login', {
    email: termEmail,
    name: 'Term Candidate',
    qualification: 'Bachelor Degree',
    domain: 'Full Stack Engineering',
    interestedRoles: [],
    claimedSkills: [],
  });

  if (termLogin.status === 200) {
    const termMcq = await post('/api/skill-assessment', {
      profile: { name: 'Term Candidate', email: termEmail, qualification: 'Bachelor Degree', domain: 'Full Stack Engineering', interestedRoles: [], claimedSkills: [] },
    }, termLogin.body.token);

    if (termMcq.status === 200 && termMcq.body.assessmentId) {
      const termId = termMcq.body.assessmentId;
      const termToken = termLogin.body.token;

      // Fire 3 proctor events to terminate
      await post('/api/skill-assessment/proctor', { assessmentId: termId, type: 'tab_hidden', detail: 'Violation 1' }, termToken);
      await post('/api/skill-assessment/proctor', { assessmentId: termId, type: 'window_blur', detail: 'Violation 2' }, termToken);
      const thirdWarning = await post('/api/skill-assessment/proctor', { assessmentId: termId, type: 'copy', detail: 'Violation 3' }, termToken);

      assert('3rd warning terminates assessment', thirdWarning.body.status === 'terminated', thirdWarning.body);

      // Now try to submit — should get 409
      const badSubmit = await post('/api/skill-assessment/submit', {
        assessmentId: termId,
        answers: {},
        timedOut: false,
      }, termToken);
      assert('Submit on terminated returns 409', badSubmit.status === 409, badSubmit.body);
    } else {
      console.log(`  ${YELLOW('⚠ Skipping termination test — assessment not created')}`);
    }
  } else {
    console.log(`  ${YELLOW('⚠ Skipping termination test — login failed')}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(55)}`);
  console.log(BOLD(`Results: ${GREEN(`${passed} passed`)}  ${failed > 0 ? RED(`${failed} failed`) : '0 failed'}`));

  if (failed > 0) {
    console.log(`\n${RED('Failed tests:')}`);
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ${RED('✗')} ${r.name}`);
    });
    process.exit(1);
  } else {
    console.log(`\n${GREEN('All tests passed! ✓')}`);
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error(RED(`\nUnexpected test runner error: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
