import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb } from '../test/helpers.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password.js';
import { AccessTokens, generateRefreshToken, hashRefreshToken } from './tokens.js';

describe('password hashing', () => {
  it('round-trips with argon2id and rejects everything else', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse battery stapl')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('produces a different hash for the same password (random salt)', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('reuses one dummy hash for constant-time unknown-user checks', async () => {
    expect(await dummyPasswordHash()).toBe(await dummyPasswordHash());
  });
});

describe('access tokens', () => {
  const tokens = new AccessTokens('a'.repeat(32), 60);

  it('round-trips claims', async () => {
    const token = await tokens.sign({ sub: 'user-1', role: 'admin' });
    expect(await tokens.verify(token)).toEqual({ sub: 'user-1', role: 'admin' });
  });

  it('returns null, never throws, for bad input', async () => {
    expect(await tokens.verify('garbage')).toBeNull();
    expect(await tokens.verify('')).toBeNull();
    const other = new AccessTokens('b'.repeat(32), 60);
    expect(await tokens.verify(await other.sign({ sub: 'x', role: 'user' }))).toBeNull();
  });
});

describe('refresh tokens', () => {
  it('are long, random and hashed deterministically', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashRefreshToken(a)).toBe(hashRefreshToken(a));
    expect(hashRefreshToken(a)).toHaveLength(64);
  });
});

describe('audit_events is append-only (requirement L4)', () => {
  beforeEach(resetDb);

  it('rejects UPDATE and DELETE at the database level', async () => {
    const db = testDb();
    await db.auditEvent.create({ data: { action: 'LOGOUT', result: 'SUCCESS' } });
    await expect(
      db.$executeRawUnsafe(`UPDATE audit_events SET action = 'TAMPERED'`),
    ).rejects.toThrow(/append-only/);
    await expect(db.$executeRawUnsafe(`DELETE FROM audit_events`)).rejects.toThrow(/append-only/);
    expect(await db.auditEvent.count()).toBe(1);
  });
});
