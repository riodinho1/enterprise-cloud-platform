import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// The Prisma CLI runs from apps/api but the single .env lives at the repository root.
// Variables already in the environment win, so CI and tests can point at another database.
if (!process.env.DATABASE_URL) {
  const rootEnv = resolve(import.meta.dirname, '../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
