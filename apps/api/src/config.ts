import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Every environment variable is validated once at startup. A missing or malformed
// value fails fast with a readable message instead of surfacing as a runtime bug later.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  // How many reverse proxies sit in front of the API. Decides which X-Forwarded-For
  // hop is believed to be the client; trusting too many lets clients spoof their IP.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),

  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).default(604800),
  REFRESH_COOKIE_PATH: z.string().startsWith('/').default('/api/auth'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

// Development convenience: read the repository-root .env when nothing has configured
// the process yet. In Docker and CI the environment is injected, so this is a no-op.
// Values already present in the environment are never overwritten.
export function loadDotEnv(): void {
  if (process.env.DATABASE_URL) return;
  const here = fileURLToPath(new URL('.', import.meta.url));
  const candidates = [resolve(process.cwd(), '.env'), resolve(here, '../../../.env')];
  const found = candidates.find((p) => existsSync(p));
  if (found) process.loadEnvFile(found);
}
