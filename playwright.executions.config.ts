import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'expenditure-execution-integration.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/e2e/expenditure-execution-integration.setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/upstage-mock-server.mjs',
      url: 'http://127.0.0.1:54319/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        'npm run build && npm run start -- --hostname 127.0.0.1 --port 3101',
      url: 'http://127.0.0.1:3101',
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        UPSTAGE_API_KEY: 'integration-test-key',
        UPSTAGE_OCR_URL: 'http://127.0.0.1:54319/v1/document-digitization',
      },
    },
  ],
});
