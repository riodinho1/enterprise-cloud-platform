import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { createTestApp, testConfig } from './test/helpers.js';

describe('GET /health', () => {
  it('reports ok with uptime, a request ID and hardened headers', async () => {
    const res = await request(createTestApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('GET /ready', () => {
  // Nothing listens on port 1, so the connection is refused immediately.
  const unreachable = createDb('postgresql://nobody:nothing@127.0.0.1:1/nowhere');
  afterAll(() => unreachable.$disconnect());

  it('is 200 when the database answers', async () => {
    const res = await request(createTestApp()).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'ok' } });
  });

  it('is 503 when the database is unreachable', async () => {
    const app = createApp(testConfig(), { db: unreachable });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'failed' } });
  });
});

describe('error format', () => {
  it('returns the shared error shape for unknown routes', async () => {
    const res = await request(createTestApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(createTestApp())
      .post('/auth/login')
      .set('content-type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('loadConfig', () => {
  const required = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'x'.repeat(32),
  };

  it('applies defaults', () => {
    const c = loadConfig(required);
    expect(c.PORT).toBe(3000);
    expect(c.NODE_ENV).toBe('development');
    expect(c.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(c.REFRESH_COOKIE_PATH).toBe('/api/auth');
  });

  it('rejects an invalid port with a readable message', () => {
    expect(() => loadConfig({ ...required, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('requires a database URL and a long JWT secret', () => {
    expect(() => loadConfig({ JWT_ACCESS_SECRET: required.JWT_ACCESS_SECRET })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => loadConfig({ ...required, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});
