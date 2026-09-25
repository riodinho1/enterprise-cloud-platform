import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

describe('GET /health', () => {
  it('reports ok with uptime and version', async () => {
    const app = createApp(loadConfig({ NODE_ENV: 'test' }));
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig({});
    expect(c.PORT).toBe(3000);
    expect(c.NODE_ENV).toBe('development');
  });

  it('rejects an invalid port with a readable message', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
