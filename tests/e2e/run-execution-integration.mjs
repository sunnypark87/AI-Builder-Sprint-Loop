import { execFileSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';
const output = execFileSync(npx, ['supabase', 'status', '--output', 'env'], {
  encoding: 'utf8',
  shell,
  stdio: ['ignore', 'pipe', 'inherit'],
});
const values = Object.fromEntries(
  output
    .split(/\r?\n/)
    .map((line) => line.match(/^([^=]+)="(.*)"$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
if (!values.API_URL || !values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
  throw new Error('Local Supabase environment is incomplete.');
}
execFileSync(
  npx,
  ['playwright', 'test', '--config', 'playwright.executions.config.ts'],
  {
    stdio: 'inherit',
    shell,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.ANON_KEY,
      SUPABASE_TEST_SECRET_KEY: values.SERVICE_ROLE_KEY,
      SUPABASE_SECRET_KEY: values.SERVICE_ROLE_KEY,
    },
  },
);
