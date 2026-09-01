/**
 * server/test.mjs
 * End-to-end API test suite for SkillPath.
 *
 * Requires a running API on http://localhost:8787 and DATABASE_URL in .env.
 */

const BASE_URL = `http://localhost:${process.env.API_PORT || 8787}`;

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

class TestClient {
  constructor() {
    this.cookies = new Map();
    this.csrfToken = null;
    this.token = null;
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  storeCookies(headers) {
    const getSetCookie = headers.getSetCookie?.bind(headers);
    const values = getSetCookie ? getSetCookie() : headers.get('set-cookie') ? [headers.get('set-cookie')] : [];
    for (const value of values) {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      if (separator > 0) {
        this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
  }

  async request(method, path, body, { auth = true, csrf = false } = {}) {
    const headers = {};
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    if (csrf) {
      if (!this.csrfToken) await this.fetchCsrf();
      headers['X-CSRF-Token'] = this.csrfToken;
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(res.headers);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  }

  async fetchCsrf() {
    const res = await this.request('GET', '/api/auth/csrf-token', undefined, { auth: false });
    this.csrfToken = res.body.csrfToken;
    return res;
  }

  get(path, options) {
    return this.request('GET', path, undefined, options);
  }

  post(path, body, options) {
    return this.request('POST', path, body, options);
  }
}

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
      console.log(`    ${YELLOW('actual:')} ${JSON.stringify(actual, null, 2).slice(0, 600)}`);
    }
    failed++;
    results.push({ name, pass: false, actual });
  }
}

function section(title) {
  console.log(`\n${BOLD(title)}`);
}

function profileFor(email, overrides = {}) {
  return {
    name: 'Test Candidate',
    email,
    qualification: 'Bachelor Degree',
    domain: 'Full Stack Engineering',
    interestedRoles: ['Associate Software Engineer'],
    claimedSkills: ['React', 'Node.js'],
    resumeFileName: 'resume.pdf',
    transcriptFileName: 'transcript.PDF',
    ...overrides,
  };
}

async function runTests() {
  console.log(BOLD(`\nSkillPath End-to-End API Tests`));
  console.log(`Base URL: ${BASE_URL}\n`);

  const client = new TestClient();
  const testEmail = `test-${Date.now()}@skillpath-test.com`;
  const password = 'CorrectHorse42!';

  section('1. Health check');
  const health = await client.get('/api/health', { auth: false });
  assert('GET /api/health returns 200', health.status === 200, health.body);
  assert('ok: true', health.body.ok === true, health.body);
  assert('geminiConfigured field present', 'geminiConfigured' in health.body, health.body);

  section('2. Auth - CSRF and registration');
  const csrf = await client.fetchCsrf();
  assert('GET /api/auth/csrf-token returns a token', csrf.status === 200 && typeof csrf.body.csrfToken === 'string', csrf.body);

  const registerRes = await client.post(
    '/api/auth/register',
    {
      email: testEmail,
      password,
      fullName: 'Test Candidate',
      rememberDevice: true,
    },
    { auth: false, csrf: true },
  );
  assert('POST /api/auth/register returns 201', registerRes.status === 201, registerRes.body);
  assert('registration returns access token', typeof registerRes.body.token === 'string' && registerRes.body.token.length > 20, registerRes.body);
  assert('registered user has no completed profile yet', registerRes.body.user?.profileComplete === false, registerRes.body);
  client.token = registerRes.body.token;

  section('3. Auth - profile PDF validation and persistence');
  const invalidProfile = await client.post(
    '/api/auth/profile',
    profileFor(testEmail, { resumeFileName: 'resume.docx' }),
    { csrf: true },
  );
  assert('profile rejects non-PDF resume metadata', invalidProfile.status === 400, invalidProfile.body);
  assert('profile rejection explains PDF-only rule', String(invalidProfile.body.error || '').includes('PDF'), invalidProfile.body);

  const profileRes = await client.post('/api/auth/profile', profileFor(testEmail), { csrf: true });
  assert('POST /api/auth/profile returns 200', profileRes.status === 200, profileRes.body);
  assert('profileComplete is true after setup save', profileRes.body.user?.profileComplete === true, profileRes.body);
  assert('candidate setup is returned', profileRes.body.user?.candidate?.email === testEmail, profileRes.body);
  assert('PDF document names are persisted', profileRes.body.user?.candidate?.resumeFileName === 'resume.pdf', profileRes.body.user?.candidate);

  section('4. Auth - login returns saved setup');
  const loginClient = new TestClient();
  await loginClient.fetchCsrf();
  const loginRes = await loginClient.post(
    '/api/auth/login',
    {
      email: testEmail,
      password,
      rememberDevice: true,
    },
    { auth: false, csrf: true },
  );
  assert('POST /api/auth/login returns 200', loginRes.status === 200, loginRes.body);
  assert('login returns token', typeof loginRes.body.token === 'string' && loginRes.body.token.length > 20, loginRes.body);
  assert('login hydrates persisted profile', loginRes.body.user?.profileComplete === true && loginRes.body.user?.candidate?.name === 'Test Candidate', loginRes.body);
  assert('login has no latest result before assessment submit', loginRes.body.user?.latestSkillResult === null, loginRes.body);
  loginClient.token = loginRes.body.token;

  const meRes = await loginClient.get('/api/auth/me');
  assert('GET /api/auth/me returns 200', meRes.status === 200, meRes.body);
  assert('GET /api/auth/me includes candidate setup', meRes.body.user?.candidate?.claimedSkills?.includes('React'), meRes.body);

  section('5. Protected route enforcement');
  const anon = new TestClient();
  const noAuthRes = await anon.post('/api/agent/start', { profile: profileFor(testEmail) }, { auth: false });
  assert('POST /api/agent/start without token returns 401', noAuthRes.status === 401, noAuthRes.body);

  anon.token = 'bad.token.here';
  const badTokenRes = await anon.post('/api/skill-assessment', { profile: profileFor(testEmail) });
  assert('POST /api/skill-assessment with invalid token returns 401', badTokenRes.status === 401, badTokenRes.body);

  section('6. Chatbot - no claimed skills skip path');
  const skippedRes = await loginClient.post('/api/agent/start', {
    profile: profileFor(testEmail, { claimedSkills: [] }),
  });
  assert('no-skill chatbot path returns 200', skippedRes.status === 200, skippedRes.body);
  assert('no-skill chatbot path is skipped', skippedRes.body.status === 'skipped' && skippedRes.body.skipped === true, skippedRes.body);

  section('7. Chatbot - Gemini path');
  if (health.body.geminiConfigured !== true) {
    console.log(`  ${YELLOW('⚠ GEMINI_API_KEY not configured - skipping live Gemini question/evaluation assertions.')}`);
  } else {
    const startRes = await loginClient.post('/api/agent/start', { profile: profileFor(testEmail) });
    assert('POST /api/agent/start returns 200', startRes.status === 200, startRes.body);
    assert('chatbot starts active with currentQuestion', startRes.body.status === 'active' && startRes.body.currentQuestion?.id, startRes.body);

    const answerRes = await loginClient.post('/api/agent/answer', {
      sessionId: startRes.body.sessionId,
      questionId: startRes.body.currentQuestion?.id,
      answer: 'React reconciles state-driven UI changes through component renders. I would keep state colocated, memoize expensive selectors, and verify behavior with user-facing tests.',
      timedOut: false,
    });
    assert('POST /api/agent/answer returns 200', answerRes.status === 200, answerRes.body);
    assert('chatbot answer keeps or completes session', ['active', 'completed'].includes(answerRes.body.status), answerRes.body);
  }

  section('8. MCQ assessment - create and submit');
  const mcqRes = await loginClient.post('/api/skill-assessment', { profile: profileFor(testEmail) });
  assert('POST /api/skill-assessment returns 200', mcqRes.status === 200, mcqRes.body);
  assert('assessment has id and active status', typeof mcqRes.body.assessmentId === 'string' && mcqRes.body.status === 'active', mcqRes.body);
  assert('items do not expose correctChoice', !('correctChoice' in (mcqRes.body.items?.[0] ?? {})), mcqRes.body.items?.[0]);

  const answers = {};
  for (const item of mcqRes.body.items || []) {
    answers[item.id] = 0;
  }

  const submitRes = await loginClient.post('/api/skill-assessment/submit', {
    assessmentId: mcqRes.body.assessmentId,
    answers,
    timedOut: false,
  });
  assert('POST /api/skill-assessment/submit returns 200', submitRes.status === 200, submitRes.body);
  assert('submission returns scored result', submitRes.body.status === 'submitted' && typeof submitRes.body.score === 'number', submitRes.body);
  assert('result count matches item count', submitRes.body.total === mcqRes.body.items.length && submitRes.body.results.length === mcqRes.body.items.length, submitRes.body);

  section('9. Auth - returning login hydrates dashboard result');
  const returningClient = new TestClient();
  await returningClient.fetchCsrf();
  const returningLogin = await returningClient.post(
    '/api/auth/login',
    { email: testEmail, password, rememberDevice: true },
    { auth: false, csrf: true },
  );
  assert('returning login returns 200', returningLogin.status === 200, returningLogin.body);
  assert('returning login includes latest skill result', returningLogin.body.user?.latestSkillResult?.assessmentId === mcqRes.body.assessmentId, returningLogin.body.user);

  section('10. MCQ proctoring and terminated-submit rejection');
  returningClient.token = returningLogin.body.token;
  const freshMcq = await returningClient.post('/api/skill-assessment', { profile: profileFor(testEmail) });
  assert('fresh assessment for proctor test is active', freshMcq.status === 200 && freshMcq.body.status === 'active', freshMcq.body);

  const termId = freshMcq.body.assessmentId;
  await returningClient.post('/api/skill-assessment/proctor', { assessmentId: termId, type: 'tab_hidden', detail: 'Violation 1' });
  await returningClient.post('/api/skill-assessment/proctor', { assessmentId: termId, type: 'window_blur', detail: 'Violation 2' });
  const thirdWarning = await returningClient.post('/api/skill-assessment/proctor', { assessmentId: termId, type: 'copy', detail: 'Violation 3' });
  assert('third MCQ warning terminates assessment', thirdWarning.body.status === 'terminated', thirdWarning.body);

  const badSubmit = await returningClient.post('/api/skill-assessment/submit', {
    assessmentId: termId,
    answers: {},
    timedOut: false,
  });
  assert('submit on terminated assessment returns 409', badSubmit.status === 409, badSubmit.body);

  console.log(`\n${'-'.repeat(55)}`);
  console.log(BOLD(`Results: ${GREEN(`${passed} passed`)}  ${failed > 0 ? RED(`${failed} failed`) : '0 failed'}`));

  if (failed > 0) {
    console.log(`\n${RED('Failed tests:')}`);
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ${RED('✗')} ${r.name}`);
    });
    process.exit(1);
  }

  console.log(`\n${GREEN('All tests passed!')}`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error(RED(`\nUnexpected test runner error: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
