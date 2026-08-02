import { defineConfig } from '@playwright/test';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env.local');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'receipt-ocr-accuracy.evaluation.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 240_000,
});
