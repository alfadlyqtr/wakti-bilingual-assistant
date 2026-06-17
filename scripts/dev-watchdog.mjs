import { spawn } from 'node:child_process';

const MAX_RESTARTS = 10;
const RESTART_DELAY_MS = 1000;

let restartCount = 0;
let stopping = false;
let child = null;

function startVite() {
  child = spawn('npm run dev:raw', {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (stopping) {
      process.exit(code ?? 0);
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
    if (restartCount >= MAX_RESTARTS) {
      console.error(`\n[dev-watchdog] Vite exited (${reason}) too many times. Stopping.`);
      process.exit(code ?? 1);
      return;
    }

    restartCount += 1;
    console.warn(`\n[dev-watchdog] Vite exited (${reason}). Restarting ${restartCount}/${MAX_RESTARTS} in ${RESTART_DELAY_MS}ms...`);
    setTimeout(startVite, RESTART_DELAY_MS);
  });
}

function shutdown(signal) {
  stopping = true;
  if (child && !child.killed) {
    child.kill(signal);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('[dev-watchdog] Starting Vite with auto-restart guard...');
startVite();
