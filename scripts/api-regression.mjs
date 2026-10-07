import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { SMTPServer } from 'smtp-server';

const smtp = new SMTPServer({ secure: false, disabledCommands: ['STARTTLS'],
  onAuth(auth, session, callback) { callback(null, { user: auth.username }); },
  onData(stream, session, callback) { stream.resume(); stream.on('end', callback); },
});
let api;
try {
  smtp.listen(0, '127.0.0.1'); await once(smtp.server, 'listening');
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  api = spawn(process.execPath, ['server/index.mjs'], { stdio: ['ignore', 'inherit', 'inherit'], env: {
    ...process.env, API_PORT: String(port), ALLOW_DETERMINISTIC_AI_FALLBACK: 'false',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.server.address().port), SMTP_SECURE: 'false',
    SMTP_USER: 'test', SMTP_PASS: 'local-test-only', SMTP_FROM: 'test@example.com',
  } });
  const base = `http://127.0.0.1:${port}`;
  for(let attempt=0;attempt<100;attempt++) {
    try { if((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if(attempt===99) throw new Error('Isolated test API did not start.');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  const test = spawn(process.execPath, ['--test', 'server/integration.test.mjs'], { stdio: 'inherit', env: {...process.env, TEST_API_URL: base} });
  const [code] = await once(test, 'exit'); process.exitCode = code ?? 1;
} finally {
  if(api && api.exitCode === null) { api.kill('SIGTERM'); await once(api,'exit'); }
  await new Promise(resolve=>smtp.close(resolve));
}
