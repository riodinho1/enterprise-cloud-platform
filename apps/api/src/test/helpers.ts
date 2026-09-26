import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll } from 'vitest';
import { createApp } from '../app.js';
import { loadConfig, loadDotEnv, type Config } from '../config.js';
import { createDb, type Db } from '../db.js';
import { createStorage, type Storage } from '../lib/storage.js';

loadDotEnv();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is not set');
const testBucket = process.env.TEST_S3_BUCKET;
if (!testBucket) throw new Error('TEST_S3_BUCKET is not set');

// Fresh per run, so nothing secret-shaped is ever committed, and tests that sign
// tokens with a different secret are testing real verification.
export const TEST_JWT_SECRET = randomBytes(32).toString('hex');

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: testDatabaseUrl,
    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    AUTH_RATE_LIMIT_MAX: '1000',
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:8333',
    S3_BUCKET: testBucket as string,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? '',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? '',
    ...overrides,
  });
}

let db: Db | undefined;
export function testDb(): Db {
  db ??= createDb(testDatabaseUrl as string);
  return db;
}

let storage: Storage | undefined;
export function testStorage(): Storage {
  storage ??= createStorage(testConfig());
  return storage;
}

afterAll(async () => {
  await db?.$disconnect();
  db = undefined;
});

// TRUNCATE does not fire row triggers, so the append-only guard on audit_events
// does not block it. That guard is tested separately.
export async function resetDb(): Promise<void> {
  await testDb().$executeRawUnsafe(
    'TRUNCATE TABLE audit_events, refresh_tokens, document_tags, documents, tags, folders, users RESTART IDENTITY CASCADE',
  );
}

export function createTestApp(overrides: Record<string, string> = {}): Express {
  return createApp(testConfig(overrides), { db: testDb(), storage: testStorage() });
}

// Smallest byte sequences that the magic-byte detector recognises as each type.
export const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
export const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
  Buffer.from('IHDR'),
  Buffer.alloc(13),
  Buffer.alloc(4),
]);
export const TEXT_BYTES = Buffer.from('hello, world\nsecond line\n', 'utf8');

export function upload(
  app: Express,
  session: Session,
  filename: string,
  bytes: Buffer,
  query: Record<string, string> = {},
) {
  return request(app)
    .post('/documents')
    .query(query)
    .set('Authorization', `Bearer ${session.accessToken}`)
    .attach('file', bytes, filename);
}

// superagent only buffers known text types; downloads need the raw bytes.
export function binaryParser(
  res: request.Response,
  callback: (err: Error | null, body: Buffer) => void,
) {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
  stream.on('error', (err: Error) => callback(err, Buffer.alloc(0)));
}

export const PASSWORD = 'correct horse battery staple';

export interface Session {
  accessToken: string;
  cookie: string;
  userId: string;
}

export async function registerUser(app: Express, email: string, displayName = 'Test User') {
  const res = await request(app)
    .post('/auth/register')
    .send({ email, password: PASSWORD, displayName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${res.text}`);
  return res.body.user as { id: string; email: string };
}

export function cookieFromResponse(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const refresh = list.find((c) => c.startsWith('ecp_refresh='));
  if (!refresh) throw new Error('no refresh cookie in response');
  return refresh.split(';')[0] as string;
}

export async function login(app: Express, email: string, password = PASSWORD): Promise<Session> {
  const res = await request(app).post('/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.text}`);
  return {
    accessToken: res.body.accessToken as string,
    cookie: cookieFromResponse(res),
    userId: res.body.user.id as string,
  };
}

export async function registerAndLogin(app: Express, email: string): Promise<Session> {
  await registerUser(app, email);
  return login(app, email);
}

export async function promoteToAdmin(email: string): Promise<void> {
  await testDb().user.update({ where: { email }, data: { role: 'admin' } });
}
