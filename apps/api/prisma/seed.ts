// Local-only seed: creates (or resets) one admin account so the app is usable after
// `docker compose up`. Run with `npm run db:seed`. Refuses to run in production.
import { registerSchema } from '@ecp/shared';
import { loadDotEnv } from '../src/config.js';
import { createDb } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';

loadDotEnv();

if (process.env.NODE_ENV === 'production') {
  console.error('seed: refusing to run with NODE_ENV=production');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
const parsed = registerSchema.safeParse({
  email: process.env.SEED_ADMIN_EMAIL,
  password: process.env.SEED_ADMIN_PASSWORD,
  displayName: 'Local Admin',
});
if (!databaseUrl || !parsed.success) {
  console.error(
    'seed: DATABASE_URL, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) must be set in .env',
  );
  process.exit(1);
}

const db = createDb(databaseUrl);
const passwordHash = await hashPassword(parsed.data.password);
const admin = await db.user.upsert({
  where: { email: parsed.data.email },
  create: {
    email: parsed.data.email,
    passwordHash,
    displayName: parsed.data.displayName,
    role: 'admin',
  },
  update: { passwordHash, role: 'admin', isActive: true },
  select: { id: true, email: true },
});
console.log(JSON.stringify({ msg: 'seeded admin', id: admin.id, email: admin.email }));
await db.$disconnect();
