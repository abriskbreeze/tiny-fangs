import { defineConfig, devices } from '@playwright/test';

const DEFAULT_VITE_PORT = 4173;
const DEFAULT_WS_PORT = 3101;

function readPort(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be an integer from 1 to 65535`);
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65_535) {
    throw new Error(`${name} must be an integer from 1 to 65535`);
  }

  return port;
}

const vitePort = readPort('TINY_FANGS_VITE_PORT', DEFAULT_VITE_PORT);
const wsPort = readPort('TINY_FANGS_WS_PORT', DEFAULT_WS_PORT);

if (vitePort === wsPort) {
  throw new Error('TINY_FANGS_VITE_PORT and TINY_FANGS_WS_PORT must differ');
}

process.env.TINY_FANGS_VITE_PORT = String(vitePort);
process.env.TINY_FANGS_WS_PORT = String(wsPort);

const isCI = process.env.CI === 'true' || process.env.CI === '1';
const baseURL = `http://127.0.0.1:${vitePort}`;

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/artifacts',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    [isCI ? 'line' : 'list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      name: 'vite',
      command:
        `npm run dev -- --host 127.0.0.1 --strictPort --port ${vitePort}`,
      url: `${baseURL}/`,
      reuseExistingServer: !isCI,
      gracefulShutdown: {
        signal: 'SIGTERM',
        timeout: 5_000,
      },
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'websocket',
      command: 'npm --prefix server start',
      url: `http://127.0.0.1:${wsPort}/healthz`,
      env: {
        ...process.env,
        TINY_FANGS_WS_PORT: String(wsPort),
      },
      reuseExistingServer: !isCI,
      gracefulShutdown: {
        signal: 'SIGTERM',
        timeout: 5_000,
      },
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [
    {
      name: 'e2e',
      testMatch: /e2e\/(?!multiplayer\/).*\.spec\.js$/,
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'multiplayer',
      testMatch: /e2e\/multiplayer\/.*\.spec\.js$/,
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'visual',
      testMatch: /visual\/.*\.visual\.spec\.js$/,
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: 1672,
          height: 941,
        },
      },
    },
  ],
});
