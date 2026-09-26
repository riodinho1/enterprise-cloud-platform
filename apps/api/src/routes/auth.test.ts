import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccessTokens } from '../lib/tokens.js';
import {
  PASSWORD,
  TEST_JWT_SECRET,
  cookieFromResponse,
  createTestApp,
  login,
  registerAndLogin,
  registerUser,
  resetDb,
  testDb,
} from '../test/helpers.js';

const app = createTestApp();
const EMAIL = 'alice@example.com';

async function auditActions(): Promise<string[]> {
  const rows = await testDb().auditEvent.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map((r) => r.action);
}

beforeEach(resetDb);

describe('POST /auth/register', () => {
  it('creates a user, normalises the email and never returns the hash', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: '  Alice@Example.COM ', password: PASSWORD, displayName: ' Alice ' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: EMAIL, displayName: 'Alice', role: 'user' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('$argon2');
    expect(await auditActions()).toEqual(['REGISTER']);
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser(app, EMAIL);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, displayName: 'Again' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a short password without echoing it', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: EMAIL, password: 'short', displayName: 'Alice' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('password');
    expect(res.text).not.toContain('short"');
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => registerUser(app, EMAIL));

  it('returns an access token and a locked-down refresh cookie', async () => {
    const res = await request(app).post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expect(res.body.expiresInSeconds).toBe(900);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^ecp_refresh=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth');
    expect(await auditActions()).toEqual(['REGISTER', 'LOGIN_SUCCESS']);
  });

  it('rejects a wrong password and records the failure', async () => {
    const res = await request(app).post('/auth/login').send({ email: EMAIL, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.headers['set-cookie']).toBeUndefined();
    const failures = await testDb().auditEvent.findMany({ where: { action: 'LOGIN_FAILURE' } });
    expect(failures).toHaveLength(1);
    expect(failures[0]?.result).toBe('FAILURE');
  });

  it('gives an unknown email the same answer as a wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /auth/me (requirement B3: token checks)', () => {
  it('returns the current user with a valid token', async () => {
    const session = await registerAndLogin(app, EMAIL);
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
  });

  it('rejects a missing token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a tampered token', async () => {
    const session = await registerAndLogin(app, EMAIL);
    const [header, payload, signature] = session.accessToken.split('.') as [string, string, string];
    const flipped = signature.slice(0, -1) + (signature.endsWith('A') ? 'B' : 'A');
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${header}.${payload}.${flipped}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const session = await registerAndLogin(app, EMAIL);
    const expired = await new AccessTokens(TEST_JWT_SECRET, -10).sign({
      sub: session.userId,
      role: 'user',
    });
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const session = await registerAndLogin(app, EMAIL);
    const forged = await new AccessTokens('not-the-real-secret-'.repeat(2), 900).sign({
      sub: session.userId,
      role: 'admin',
    });
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects a valid token for a user that no longer exists', async () => {
    const ghost = await new AccessTokens(TEST_JWT_SECRET, 900).sign({
      sub: randomUUID(),
      role: 'user',
    });
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${ghost}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh (requirement B4: rotation and reuse detection)', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const session = await registerAndLogin(app, EMAIL);
    const res = await request(app).post('/auth/refresh').set('Cookie', session.cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(cookieFromResponse(res)).not.toBe(session.cookie);
    const tokens = await testDb().refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.revokedAt).not.toBeNull();
    expect(tokens[1]?.revokedAt).toBeNull();
    expect(tokens[1]?.familyId).toBe(tokens[0]?.familyId);
  });

  it('revokes the whole family when a rotated token is reused', async () => {
    const session = await registerAndLogin(app, EMAIL);
    const rotated = await request(app).post('/auth/refresh').set('Cookie', session.cookie);
    const newCookie = cookieFromResponse(rotated);

    // Replay the old token: an attacker (or a stale client) is using a copy.
    const replay = await request(app).post('/auth/refresh').set('Cookie', session.cookie);
    expect(replay.status).toBe(401);

    // The legitimate successor is now dead too.
    const successor = await request(app).post('/auth/refresh').set('Cookie', newCookie);
    expect(successor.status).toBe(401);

    const live = await testDb().refreshToken.count({ where: { revokedAt: null } });
    expect(live).toBe(0);
    expect(await auditActions()).toContain('REFRESH_REUSE_DETECTED');
  });

  it('rejects a missing or unknown cookie', async () => {
    expect((await request(app).post('/auth/refresh')).status).toBe(401);
    const res = await request(app).post('/auth/refresh').set('Cookie', 'ecp_refresh=garbage');
    expect(res.status).toBe(401);
    expect(await auditActions()).toContain('REFRESH_FAILURE');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const session = await registerAndLogin(app, EMAIL);
    const res = await request(app).post('/auth/logout').set('Cookie', session.cookie);
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^ecp_refresh=;.*Expires=Thu, 01 Jan 1970/);
    const again = await request(app).post('/auth/refresh').set('Cookie', session.cookie);
    expect(again.status).toBe(401);
    expect(await auditActions()).toContain('LOGOUT');
  });
});

describe('deactivated users (requirement A3)', () => {
  it('are rejected on every route, including refresh and login', async () => {
    const session = await registerAndLogin(app, EMAIL);
    await testDb().user.update({ where: { email: EMAIL }, data: { isActive: false } });

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`);
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe('ACCOUNT_DEACTIVATED');

    const refresh = await request(app).post('/auth/refresh').set('Cookie', session.cookie);
    expect(refresh.status).toBe(403);

    const relogin = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(relogin.status).toBe(403);
  });
});

describe('rate limiting on auth routes', () => {
  it('returns 429 after the configured number of attempts', async () => {
    const limited = createTestApp({ AUTH_RATE_LIMIT_MAX: '3' });
    await registerUser(limited, EMAIL);
    const attempt = () =>
      request(limited).post('/auth/login').send({ email: EMAIL, password: 'x' });
    for (let i = 0; i < 2; i += 1) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['ratelimit']).toBeDefined();
    // A real login is blocked too: the limit is per IP, not per outcome.
    expect((await login(limited, EMAIL).catch((e: Error) => e.message)) as string).toContain('429');
  });
});
