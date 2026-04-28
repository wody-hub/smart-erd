import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';

const backendPortPattern = /Tomcat started on port (\d+)/;
const frontendUrlPattern = /(https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/?)/;
const backendProfile = process.env.SMART_ERD_PROFILE ?? 'local';
const frontendMode = process.env.VITE_MODE ?? `frontend-${backendProfile}`;
const defaultCorsOrigins = [
  'http://localhost:4501',
  'http://127.0.0.1:4501',
  'http://localhost:4502',
  'http://127.0.0.1:4502',
  'http://localhost:4503',
  'http://127.0.0.1:4503',
  'http://localhost:9501',
  'http://127.0.0.1:9501',
  'http://localhost:9502',
  'http://127.0.0.1:9502',
  'http://localhost:9503',
  'http://127.0.0.1:9503',
];

let backendProcess = null;
let frontendProcess = null;
let shuttingDown = false;
let frontendPort = null;

function prefixLines(prefix, chunk, stream) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length > 0) {
      stream.write(`${prefix} ${line}\n`);
    }
  }
}

function stopChild(child, signal = 'SIGTERM') {
  if (child && !child.killed) {
    child.kill(signal);
  }
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  stopChild(frontendProcess);
  stopChild(backendProcess);
  setTimeout(() => process.exit(code), 300).unref();
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
          return;
        }
        reject(new Error('Failed to allocate a frontend port.'));
      });
    });
  });
}

function buildCorsOrigins(port) {
  return [...defaultCorsOrigins, `http://localhost:${port}`, `http://127.0.0.1:${port}`].join(',');
}

async function startFrontend(backendPort) {
  if (!frontendPort) {
    throw new Error('Frontend port has not been allocated.');
  }

  const backendHttpUrl = `http://localhost:${backendPort}`;
  const backendWsUrl = `ws://localhost:${backendPort}`;

  console.log(`[dev] Backend is listening on ${backendHttpUrl}`);
  console.log(`[dev] Starting frontend (${frontendMode}) on http://127.0.0.1:${frontendPort}`);

  frontendProcess = spawn('npx', ['vite', '--mode', frontendMode, '--host', '127.0.0.1'], {
    cwd: 'client',
    env: {
      ...process.env,
      VITE_DEV_SERVER_PORT: String(frontendPort),
      VITE_DEV_SERVER_STRICT_PORT: 'true',
      VITE_API_PROXY_TARGET: backendHttpUrl,
      VITE_WS_PROXY_TARGET: backendWsUrl,
      VITE_WS_DIRECT_BASE_URL: backendWsUrl,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  frontendProcess.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    const frontendUrl = text.match(frontendUrlPattern)?.[1];
    if (frontendUrl) {
      console.log(`[dev] Frontend is listening on ${frontendUrl}`);
    }
    prefixLines('[frontend]', chunk, process.stdout);
  });

  frontendProcess.stderr.on('data', (chunk) => {
    prefixLines('[frontend]', chunk, process.stderr);
  });

  frontendProcess.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`[dev] Frontend exited (${signal ?? code}). Stopping backend...`);
      shutdown(code ?? 1);
    }
  });
}

async function startBackend() {
  frontendPort = await findAvailablePort();
  const corsOrigins = process.env.SMART_ERD_CORS_ORIGINS ?? buildCorsOrigins(frontendPort);

  console.log(`[dev] Reserved frontend port http://127.0.0.1:${frontendPort}`);
  console.log(`[dev] Starting backend (${backendProfile}) with SERVER_PORT=0...`);

  backendProcess = spawn('./gradlew', ['bootRun', `--args=--spring.profiles.active=${backendProfile}`], {
    env: {
      ...process.env,
      SERVER_PORT: '0',
      SMART_ERD_CORS_ORIGINS: corsOrigins,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let frontendStarted = false;

  backendProcess.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    const backendPort = text.match(backendPortPattern)?.[1];
    if (backendPort && !frontendStarted) {
      frontendStarted = true;
      startFrontend(backendPort).catch((error) => {
        console.error(`[dev] Failed to start frontend: ${error.message}`);
        shutdown(1);
      });
    }
    prefixLines('[backend]', chunk, process.stdout);
  });

  backendProcess.stderr.on('data', (chunk) => {
    prefixLines('[backend]', chunk, process.stderr);
  });

  backendProcess.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`[dev] Backend exited (${signal ?? code}). Stopping frontend...`);
      shutdown(code ?? 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startBackend().catch((error) => {
  console.error(`[dev] Failed to start backend: ${error.message}`);
  shutdown(1);
});
