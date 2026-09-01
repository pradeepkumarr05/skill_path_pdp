import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');
const PASSWORD = 'CorrectHorse42!';
const email = `screens-${Date.now()}@skillpath-test.com`;

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const guidelineTitles = [
  'Allow camera (microphone optional)',
  'Share your assessment screen',
  'Stay in full-screen mode',
  'Do not switch tabs or windows',
  'Copy, cut, paste, and right-click are blocked',
  'Use a quiet, well-lit room',
  'Do not use external help',
  'Keep a stable internet connection',
  'Understand that activity is recorded',
];

function fakeChatSession(profile, status = 'active') {
  const now = new Date();
  const question = status === 'active'
    ? {
        id: 'question-1',
        skill: 'React',
        difficulty: 'medium',
        text: 'Describe how you would prevent unnecessary React re-renders in a dashboard with frequently updating assessment metrics.',
        intent: 'Checks practical React rendering and memoization judgment.',
        sequence: 1,
        startedAt: now.toISOString(),
        dueAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
        secondsAllowed: 45,
      }
    : null;

  return {
    sessionId: 'chat-session-screenshot',
    status,
    reason: '',
    candidateName: profile.name,
    selectedDomain: profile.domain,
    assessmentDomain: 'Full Stack Engineering',
    claimedSkills: profile.claimedSkills,
    currentQuestion: question,
    transcript: [
      {
        id: 'system-1',
        role: 'system',
        text: 'Gemini-backed SkillPath chatbot started for React, Node.js.',
        createdAt: now.toISOString(),
        meta: { type: 'session_started' },
      },
      {
        id: 'agent-1',
        role: 'agent',
        text: question?.text || 'Chatbot assessment complete. Overall chatbot readiness level: job ready.',
        createdAt: now.toISOString(),
        meta: { type: status === 'active' ? 'question' : 'complete', skill: 'React', difficulty: 'medium' },
      },
    ],
    skillStates: [
      { skill: 'React', status: status === 'active' ? 'medium' : 'completed', mediumAttempts: status === 'active' ? 0 : 1, hardAttempts: 0, finalScore: status === 'active' ? null : 76, finalLevel: status === 'active' ? null : 'job_ready' },
      { skill: 'Node.js', status: status === 'active' ? 'pending' : 'completed_medium_only', mediumAttempts: status === 'active' ? 0 : 1, hardAttempts: 0, finalScore: status === 'active' ? null : 68, finalLevel: status === 'active' ? null : 'developing' },
    ],
    warningCount: 0,
    warningLimit: 3,
    answerSeconds: 45,
    aggregate: status === 'active' ? null : { score: 72, level: 'job_ready', skillsAssessed: 2 },
    model: 'gemini-3.6-flash',
    geminiConfigured: false,
    completedAt: status === 'active' ? null : now.toISOString(),
    terminatedAt: null,
  };
}

async function prepareContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  await context.grantPermissions(['camera', 'microphone'], { origin: APP_URL });

  await context.addInitScript(() => {
    const makeCanvasStream = (label) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      let frame = 0;
      const draw = () => {
        if (!ctx) return;
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#123d35');
        gradient.addColorStop(0.5, '#00a884');
        gradient.addColorStop(1, '#101314');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(247, 240, 230, 0.92)';
        ctx.font = '700 38px sans-serif';
        ctx.fillText(label, 36, 76);
        ctx.font = '700 24px sans-serif';
        ctx.fillText('SkillPath proctor preview', 36, 122);
        ctx.fillStyle = '#d7ff4f';
        ctx.beginPath();
        ctx.arc(520 + Math.sin(frame / 12) * 16, 92, 28, 0, Math.PI * 2);
        ctx.fill();
        frame += 1;
      };
      draw();
      setInterval(draw, 120);
      return canvas.captureStream(15);
    };

    const withAudio = (stream) => {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return stream;
        const audioContext = new AudioContextCtor();
        const oscillator = audioContext.createOscillator();
        const destination = audioContext.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        const [audioTrack] = destination.stream.getAudioTracks();
        if (audioTrack) stream.addTrack(audioTrack);
      } catch {
        // The visual camera thumbnail is the screenshot-critical track.
      }
      return stream;
    };

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.documentElement,
    });
    document.documentElement.requestFullscreen = async () => {};

    const mediaDevices = {
      getUserMedia: async (constraints) => {
        const stream = makeCanvasStream('Camera live');
        return constraints?.audio ? withAudio(stream) : stream;
      },
      getDisplayMedia: async () => makeCanvasStream('Screen shared'),
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });
  });

  return context;
}

async function screenshot(page, fileName) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName), fullPage: true });
}

async function installChatRoutes(page) {
  await page.route('**/api/agent/start', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeChatSession(payload.profile || { name: 'Candidate', domain: 'Full Stack Engineering', claimedSkills: [] })),
    });
  });

  await page.route('**/api/agent/answer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        fakeChatSession(
          {
            name: 'Ananya Rao',
            domain: 'Full Stack Engineering',
            claimedSkills: ['React', 'Node.js'],
          },
          'completed',
        ),
      ),
    });
  });
}

async function run() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--allow-http-screen-capture',
      '--enable-usermedia-screen-capturing',
      '--auto-select-desktop-capture-source=Entire screen',
    ],
  });

  try {
    const context = await prepareContext(browser);
    const page = await context.newPage();
    await installChatRoutes(page);

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await screenshot(page, '01-login-sign-in.png');

    await page.getByRole('button', { name: /^Sign up$/ }).first().click();
    await screenshot(page, '02-login-sign-up.png');

    await page.getByLabel('Full name').fill('Ananya Rao');
    await page.getByLabel('Email address').fill(email);
    await page.locator('input[type="password"]').nth(0).fill(PASSWORD);
    await page.locator('input[type="password"]').nth(1).fill(PASSWORD);
    await page.getByRole('button', { name: /^Create account$/ }).click();
    await page.getByRole('heading', { name: 'Profile Setup' }).waitFor();

    await page.getByLabel('Age').fill('22');
    await page.getByLabel('College name').selectOption('Vellore Institute of Technology');
    await page.getByLabel('College city').selectOption('Bengaluru');
    await page.getByLabel('CGPA').fill('8.4');
    await page.getByLabel('Start year').selectOption('2021');
    await page.getByLabel('End year').selectOption('2025');
    await page.locator('label:has-text("Resume") input[type="file"]').setInputFiles({
      name: 'resume.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('not a pdf'),
    });
    await screenshot(page, '03-profile-pdf-validation.png');

    await page.locator('label:has-text("Resume") input[type="file"]').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 resume fixture'),
    });
    await page.locator('label:has-text("Academic transcript") input[type="file"]').setInputFiles({
      name: 'transcript.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 transcript fixture'),
    });
    await page.getByRole('button', { name: 'Associate Software Engineer' }).click();
    await page.getByRole('button', { name: 'React' }).click();
    await page.getByRole('button', { name: 'Node.js' }).click();
    await screenshot(page, '04-profile-setup-complete.png');

    await page.getByRole('button', { name: 'Review profile' }).click();
    await screenshot(page, '05-profile-final-review.png');
    await page.getByRole('button', { name: /^Submit$/ }).click();
    await page.getByRole('button', { name: /Continue to assessment guidelines/ }).click();
    await page.getByRole('heading', { name: 'Agentic Assessment Guidelines' }).waitFor();

    for (const title of guidelineTitles) {
      await page.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    }
    await screenshot(page, '06-assessment-guidelines-accepted.png');

    await page.getByRole('button', { name: /Request access and start/ }).click();
    await page.waitForTimeout(1000);
    if (!(await page.getByRole('heading', { name: 'Live Chatbot Assessment' }).isVisible().catch(() => false))) {
      await screenshot(page, '06b-assessment-access-after-click.png');
      console.log(await page.locator('body').innerText());
    }
    await page.getByRole('heading', { name: 'Live Chatbot Assessment' }).waitFor();
    await screenshot(page, '07-chatbot-assessment-camera-thumbnail.png');

    await page.getByPlaceholder('Type your answer here').fill('I would split volatile metrics from static panels, memoize expensive derived values, and verify render frequency with React profiler before adding memoization.');
    await page.getByRole('button', { name: /Submit answer/ }).click();
    await page.getByRole('button', { name: /Continue to skill assessment/ }).waitFor();
    await page.getByRole('button', { name: /Continue to skill assessment/ }).click();
    await page.getByRole('heading', { name: 'Deterministic Skills Assessment' }).waitFor();
    await screenshot(page, '08-skill-assessment-camera-thumbnail.png');

    const questionCards = page.locator('article').filter({ has: page.locator('button') });
    const cardCount = await questionCards.count();
    for (let index = 0; index < cardCount; index += 1) {
      await questionCards.nth(index).locator('button').first().click();
    }
    await page.getByRole('button', { name: /Submit deterministic assessment/ }).click();
    await page.getByRole('button', { name: /Continue to gap analysis/ }).waitFor();
    await screenshot(page, '09-skill-assessment-results.png');

    await page.getByRole('button', { name: /Continue to gap analysis/ }).click();
    await page.getByRole('heading', { name: 'Learning Gap Engine' }).waitFor();
    await screenshot(page, '10-learning-gap-engine-dashboard.png');

    const returningContext = await prepareContext(browser);
    const returningPage = await returningContext.newPage();
    await returningPage.goto(APP_URL, { waitUntil: 'networkidle' });
    await returningPage.getByLabel('Email address').fill(email);
    await returningPage.locator('input[type="password"]').first().fill(PASSWORD);
    await returningPage.getByRole('button', { name: /^Sign in$/ }).click();
    await returningPage.getByRole('heading', { name: 'Learning Gap Engine' }).waitFor();
    await screenshot(returningPage, '11-returning-login-dashboard-redirect.png');
    await returningContext.close();

    await context.close();
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
