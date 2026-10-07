import { spawn } from 'node:child_process';
import net from 'node:net';

try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const apiPort = Number(process.env.API_PORT || 8787);
for (const port of [apiPort, 5173]) {
  try {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(port, '0.0.0.0', () => probe.close(resolve));
    });
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Use the existing app at http://localhost:5173, or stop its terminal with Ctrl+C before restarting.`
      : `Cannot listen on port ${port}: ${error.message}`);
    process.exit(1);
  }
}

const children = [
  spawn(process.execPath, ['server/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, API_PORT: String(apiPort) },
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
