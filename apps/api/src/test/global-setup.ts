import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from '../config.js';
import { createStorage } from '../lib/storage.js';

const START_HINT = 'Copy .env.example to .env and start the services with `npm run db:up`.';

// Runs once before any test file: applies every migration to the test database and
// empties the test bucket, so tests always start from the schema in git and no files.
export default async function setup(): Promise<void> {
  loadDotEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error(`TEST_DATABASE_URL is not set. ${START_HINT}`);
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

  const bucket = process.env.TEST_S3_BUCKET;
  if (!bucket || !bucket.endsWith('-test')) {
    throw new Error(`TEST_S3_BUCKET must be set and end in -test. ${START_HINT}`);
  }
  const storage = createStorage({
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:8333',
    S3_REGION: process.env.S3_REGION ?? 'us-east-1',
    S3_BUCKET: bucket,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? '',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? '',
    S3_FORCE_PATH_STYLE: true,
  });
  try {
    await storage.ensureBucket();
    await storage.emptyBucket();
  } catch (err) {
    throw new Error(
      `object storage is not reachable at ${process.env.S3_ENDPOINT}. ${START_HINT}`,
      {
        cause: err,
      },
    );
  }
}
