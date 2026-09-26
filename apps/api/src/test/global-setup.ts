import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from '../config.js';

// Runs once before any test file: applies every migration to the test database so
// tests always run against the exact schema that is checked into git.
export default function setup(): void {
  loadDotEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Copy .env.example to .env and start PostgreSQL with `npm run db:up`.',
    );
  }
  // Tests truncate tables. Refuse anything that does not look like a throwaway database.
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
  }
  const apiRoot = fileURLToPath(new URL('../..', import.meta.url));
  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
