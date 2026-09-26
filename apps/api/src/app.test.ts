import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { createStorage } from './lib/storage.js';
import { createTestApp, testConfig, testDb, testStorage } from './test/helpers.js';

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
  // Nothing listens on port 1, so both connections are refused immediately.
  const unreachableDb = createDb('postgresql://nobody:nothing@127.0.0.1:1/nowhere');
  const unreachableStorage = createStorage({ ...testConfig(), S3_ENDPOINT: 'http://127.0.0.1:1' });
  afterAll(() => unreachableDb.$disconnect());

  it('is 200 when the database and storage answer', async () => {
    const res = await request(createTestApp()).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'ok', storage: 'ok' } });
  });

  it('is 503 and names the database when it is unreachable', async () => {
    const app = createApp(testConfig(), { db: unreachableDb, storage: testStorage() });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'failed', storage: 'ok' } });
  });

  it('is 503 and names storage when it is unreachable', async () => {
    const app = createApp(testConfig(), { db: testDb(), storage: unreachableStorage });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'ok', storage: 'failed' } });
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
    S3_ENDPOINT: 'http://127.0.0.1:8333',
    S3_BUCKET: 'bucket',
    S3_ACCESS_KEY_ID: 'k',
    S3_SECRET_ACCESS_KEY: 's',
  };

  it('applies defaults', () => {
    const c = loadConfig(required);
    expect(c.PORT).toBe(3000);
    expect(c.NODE_ENV).toBe('development');
    expect(c.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(c.REFRESH_COOKIE_PATH).toBe('/api/auth');
    expect(c.UPLOAD_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(c.MALWARE_SCAN).toBe('off');
    expect(c.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('rejects an invalid port with a readable message', () => {
    expect(() => loadConfig({ ...required, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('requires a database URL, a long JWT secret and storage settings', () => {
    const { DATABASE_URL: _d, ...noDb } = required;
    expect(() => loadConfig(noDb)).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...required, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    const { S3_BUCKET: _b, ...noBucket } = required;
    expect(() => loadConfig(noBucket)).toThrow(/S3_BUCKET/);
  });
});
