import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
await mkdir('screenshots/test-output', { recursive: true });
const commands = [
  ['unit-policy', process.execPath, ['server/assessmentPolicy.test.mjs']],
  ['unit-state-machine', process.execPath, ['server/test-state-machine.mjs']],
  ['api-integration', process.execPath, ['--test', 'server/integration.test.mjs'], { ALLOW_DETERMINISTIC_AI_FALLBACK: 'true' }],
  ['production-build', 'npm', ['run', 'build']],
];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const [name, command, args] of commands) {
    const output = execFileSync(command, args, { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', ...(commands.find(item => item[0] === name)?.[3] || {}) }, stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\u001b\[[0-9;]*m/g, '');
    await writeFile(`screenshots/test-output/${name}.txt`, output);
    const page = await browser.newPage({ viewport: { width: 1250, height: 900 } });
    await page.setContent('<html><body style="margin:0;background:#111817;color:#dcebe5;font:15px/1.6 monospace;padding:28px"><h1 style="font-size:22px"></h1><pre style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></body></html>');
    await page.evaluate(({ name, output }) => { document.querySelector('h1').textContent = `SkillPath: ${name} - passed`; document.querySelector('pre').textContent = output; }, { name, output });
    await page.screenshot({ path: `screenshots/test-output/${name}.png`, fullPage: true });
    await page.close();
    console.log(`${name}: passed, log and screenshot saved`);
  }
} finally { await browser.close(); }
