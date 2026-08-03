import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'donation-report-rls.integration.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './tests/e2e/donation-report-rls.integration.setup.ts',
});
