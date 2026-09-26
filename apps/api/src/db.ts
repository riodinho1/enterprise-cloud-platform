import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export type Db = PrismaClient;

// Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres here) instead
// of a bundled engine, so the connection pool is ordinary `pg` and easy to reason about.
export function createDb(databaseUrl: string): Db {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

// Prisma error code for a unique constraint violation. Used to turn a race between
// two identical registrations into a 409 instead of a 500.
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}
