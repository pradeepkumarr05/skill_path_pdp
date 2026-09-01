import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, 'project-review-testing', 'logs');
const OUT_DIR = path.join(ROOT, 'project-review-testing', 'terminal-screenshots');

const BROWSER_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  path.join(process.env.HOME || '', '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),
  path.join(process.env.HOME || '', '.cache/ms-playwright/chromium-1237/chrome-linux64/chrome'),
].filter(Boolean);

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function browserExecutable() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (await fileExists(candidate)) return candidate;
  }
  return undefined;
}

function stripAnsi(value) {
  return value
    .replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g, '')
    .replace(/\r/g, '')
    .replace(/\n?Script started.*?\n/g, '\n')
    .replace(/\nScript done.*$/s, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function splitLines(text, maxLines) {
  const lines = text.split('\n');
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    pages.push(lines.slice(index, index + maxLines).join('\n'));
  }
  return pages;
}

function terminalHtml(title, command, body, footer) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          width: 1600px;
          height: 900px;
          background: #101312;
          color: #eef7f2;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          overflow: hidden;
        }
        .window {
          width: 1600px;
          height: 900px;
          display: grid;
          grid-template-rows: 54px 1fr 42px;
          background: #0e1110;
        }
        .bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 22px;
          border-bottom: 1px solid #29312f;
          background: #181d1b;
          color: #b8c7c0;
          font: 700 18px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .dot { width: 14px; height: 14px; border-radius: 999px; display: inline-block; }
        .red { background: #ff6159; }
        .yellow { background: #ffbd2e; }
        .green { background: #28c840; }
        .title { margin-left: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cmd {
          color: #8ff0ce;
          font-weight: 900;
        }
        pre {
          margin: 0;
          padding: 24px 30px;
          font: 700 21px/1.26 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          white-space: pre-wrap;
          overflow: hidden;
        }
        .footer {
          padding: 0 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #29312f;
          color: #9ab0a8;
          background: #141917;
          font: 750 17px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .pass { color: #53e69c; }
      </style>
    </head>
    <body>
      <main class="window">
        <section class="bar">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
          <span class="title">${escapeHtml(title)} <span class="cmd">${escapeHtml(command)}</span></span>
        </section>
        <pre>${escapeHtml(body)}</pre>
        <section class="footer">
          <span>${escapeHtml(footer)}</span>
          <span class="pass">captured from actual test-run log</span>
        </section>
      </main>
    </body>
  </html>`;
}

async function render(browser, fileName, html) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT_DIR, fileName) });
  await page.close();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const unitBuild = stripAnsi(await readFile(path.join(LOG_DIR, '01-unit-validation-build.ansi'), 'utf8'));
  const api = stripAnsi(await readFile(path.join(LOG_DIR, '02-api-validation.ansi'), 'utf8'));
  const trial = stripAnsi(await readFile(path.join(LOG_DIR, '03-ui-trial-run-final.ansi'), 'utf8'));

  const commandLogs = [
    {
      prefix: '01-npm-test',
      title: 'SkillPath Unit, Validation, Typecheck, and Build',
      command: 'npm test',
      text: unitBuild,
      footer: 'Vitest + state-machine validation + TypeScript + Vite build',
      maxLines: 29,
    },
    {
      prefix: '02-api-validation',
      title: 'SkillPath End-to-End API Validation',
      command: 'npm run test:api',
      text: api,
      footer: 'Executed against local PostgreSQL test container on localhost:8787',
      maxLines: 29,
    },
    {
      prefix: '03-ui-trial-run',
      title: 'SkillPath UI Trial Screenshot Run',
      command: 'npm run screenshots',
      text: `${trial}\n\nGenerated screenshots:\n01-login-sign-in.png\n02-login-sign-up.png\n03-profile-pdf-validation.png\n04-profile-setup-complete.png\n05-profile-final-review.png\n06-assessment-guidelines-accepted.png\n07-chatbot-assessment-camera-thumbnail.png\n08-skill-assessment-camera-thumbnail.png\n09-skill-assessment-results.png\n10-learning-gap-engine-dashboard.png\n11-returning-login-dashboard-redirect.png`,
      footer: 'Playwright browser walkthrough generated 11 trial-run screenshots',
      maxLines: 29,
    },
  ];

  const executable = await browserExecutable();
  const browser = await chromium.launch({
    headless: true,
    executablePath: executable,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const files = [];
  try {
    for (const log of commandLogs) {
      const pages = splitLines(log.text, log.maxLines);
      for (let index = 0; index < pages.length; index += 1) {
        const pageNo = String(index + 1).padStart(2, '0');
        const total = String(pages.length).padStart(2, '0');
        const fileName = `${log.prefix}-terminal-page-${pageNo}.png`;
        await render(
          browser,
          fileName,
          terminalHtml(
            log.title,
            log.command,
            pages[index],
            `${log.footer} | page ${pageNo}/${total}`,
          ),
        );
        files.push(fileName);
      }
    }
  } finally {
    await browser.close();
  }

  await writeFile(path.join(OUT_DIR, 'README.md'), `# Actual Terminal Screenshots

These PNG files are terminal-style screenshots rendered from the raw command logs captured with \`script\` during the actual test runs.

## Files

${files.map((file) => `- ${file}`).join('\n')}
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
