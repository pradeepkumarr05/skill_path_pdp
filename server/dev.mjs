import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, API_PORT: process.env.API_PORT || '8787' },
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], {
    stdio: 'inherit',
    env: process.env,
  }),
];

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      shutdown('SIGTERM');
      process.exit(code);
    }
  });
}
