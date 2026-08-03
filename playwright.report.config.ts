import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'report-generation-accuracy.evaluation.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 180_000,
});
