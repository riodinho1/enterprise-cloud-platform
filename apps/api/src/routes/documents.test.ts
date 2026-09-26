import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PDF_BYTES,
  PNG_BYTES,
  TEXT_BYTES,
  binaryParser,
  createTestApp,
  registerAndLogin,
  resetDb,
  testDb,
  testStorage,
  upload,
  type Session,
} from '../test/helpers.js';

const app = createTestApp();
let alice: Session;
let bob: Session;

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const bearer = (s: Session) => `Bearer ${s.accessToken}`;

async function uploadOk(session: Session, name: string, bytes: Buffer, query = {}) {
  const res = await upload(app, session, name, bytes, query);
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${res.text}`);
  return res.body.document as { id: string; originalName: string; tags: string[] };
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

beforeEach(async () => {
  await resetDb();
  alice = await registerAndLogin(app, 'alice@example.com');
  bob = await registerAndLogin(app, 'bob@example.com');
});

describe('POST /documents (requirement U4)', () => {
  it('streams a PDF to storage and returns its metadata', async () => {
    const res = await upload(app, alice, 'Quarterly Report.pdf', PDF_BYTES);
    expect(res.status).toBe(201);
    expect(res.body.document).toMatchObject({
      originalName: 'Quarterly Report.pdf',
      sizeBytes: PDF_BYTES.length,
      mimeType: 'application/pdf',
      checksumSha256: sha256(PDF_BYTES),
      scanStatus: 'CLEAN',
      folder: null,
      tags: [],
    });
    expect(res.body.document.storageKey).toBeUndefined();

    const row = await testDb().document.findUniqueOrThrow({ where: { id: res.body.document.id } });
    expect(row.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    const stored = await testStorage().getStream(row.storageKey);
    expect((await readAll(stored.body)).equals(PDF_BYTES)).toBe(true);

    const audit = await testDb().auditEvent.findFirst({ where: { action: 'UPLOAD' } });
    expect(audit?.actorId).toBe(alice.userId);
    expect(audit?.targetId).toBe(row.id);
  });

  it('records the MIME type the bytes prove, not the one the client declares', async () => {
    const res = await request(app)
      .post('/documents')
      .set('Authorization', bearer(alice))
      .attach('file', PDF_BYTES, { filename: 'a.pdf', contentType: 'text/plain' });
    expect(res.status).toBe(201);
    expect(res.body.document.mimeType).toBe('application/pdf');
  });

  it('sanitises the filename and keeps it display-only', async () => {
    const doc = await uploadOk(alice, '../../etc/passwd<script>.PDF', PDF_BYTES);
    expect(doc.originalName).toBe('passwd_script_.pdf');
  });

  it('accepts plain text and marks it text/plain', async () => {
    const res = await upload(app, alice, 'notes.txt', TEXT_BYTES);
    expect(res.status).toBe(201);
    expect(res.body.document.mimeType).toBe('text/plain');
  });

  it('leaves uploads PENDING_SCAN when scanning is on, and blocks their download', async () => {
    const scanning = createTestApp({ MALWARE_SCAN: 'clamav' });
    const res = await upload(scanning, alice, 'a.pdf', PDF_BYTES);
    expect(res.body.document.scanStatus).toBe('PENDING_SCAN');
    const dl = await request(scanning)
      .get(`/documents/${res.body.document.id}/download`)
      .set('Authorization', bearer(alice));
    expect(dl.status).toBe(409);
    expect(dl.body.error.code).toBe('SCAN_PENDING');
  });

  it('files the document into an owned folder, and only an owned one', async () => {
    const folder = await request(app)
      .post('/folders')
      .set('Authorization', bearer(alice))
      .send({ name: 'Invoices' });
    const ok = await upload(app, alice, 'a.pdf', PDF_BYTES, { folderId: folder.body.folder.id });
    expect(ok.status).toBe(201);
    expect(ok.body.document.folder).toEqual({ id: folder.body.folder.id, name: 'Invoices' });

    const stolen = await upload(app, bob, 'b.pdf', PDF_BYTES, { folderId: folder.body.folder.id });
    expect(stolen.status).toBe(404);
    expect(stolen.body.error.code).toBe('FOLDER_NOT_FOUND');
  });
});

describe('requirement B5: oversized, disallowed and disguised uploads', () => {
  it('rejects an extension outside the allow-list', async () => {
    const res = await upload(app, alice, 'tool.exe', PDF_BYTES);
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('TYPE_NOT_ALLOWED');
  });

  it('rejects a PNG disguised as a PDF and says what it saw', async () => {
    const res = await upload(app, alice, 'invoice.pdf', PNG_BYTES);
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('TYPE_MISMATCH');
    expect(res.body.error.details).toEqual({ detected: 'image/png' });
  });

  it('rejects binary content disguised as text', async () => {
    expect((await upload(app, alice, 'readme.txt', PDF_BYTES)).body.error.code).toBe(
      'TYPE_MISMATCH',
    );
    const nulls = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]);
    expect((await upload(app, alice, 'data.csv', nulls)).body.error.code).toBe('TYPE_MISMATCH');
  });

  it('rejects an oversized file and leaves nothing behind', async () => {
    const small = createTestApp({ UPLOAD_MAX_BYTES: '2048' });
    const res = await upload(small, alice, 'big.txt', Buffer.alloc(8192, 0x61));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(await testDb().document.count()).toBe(0);
  });

  it('requires a file field', async () => {
    const res = await request(app)
      .post('/documents')
      .set('Authorization', bearer(alice))
      .field('note', 'no file here');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_REQUIRED');
  });
});

describe('listing, searching and organising (U5, U8, U9)', () => {
  it('lists only the caller’s live documents, newest first, with search and paging', async () => {
    await uploadOk(alice, 'a.pdf', PDF_BYTES);
    await uploadOk(alice, 'b.pdf', PDF_BYTES);
    const notes = await uploadOk(alice, 'notes.txt', TEXT_BYTES);
    await uploadOk(bob, 'bobs.pdf', PDF_BYTES);

    const all = await request(app).get('/documents').set('Authorization', bearer(alice));
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((d: { originalName: string }) => d.originalName)).toEqual([
      'notes.txt',
      'b.pdf',
      'a.pdf',
    ]);

    const search = await request(app)
      .get('/documents')
      .query({ q: 'NOTE' })
      .set('Authorization', bearer(alice));
    expect(search.body.items.map((d: { id: string }) => d.id)).toEqual([notes.id]);

    const page = await request(app)
      .get('/documents')
      .query({ pageSize: 2, page: 2 })
      .set('Authorization', bearer(alice));
    expect(page.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page.body.items).toHaveLength(1);
  });

  it('renames, moves and tags a document, and filters by tag', async () => {
    const doc = await uploadOk(alice, 'a.pdf', PDF_BYTES);
    const folder = await request(app)
      .post('/folders')
      .set('Authorization', bearer(alice))
      .send({ name: 'Tax' });
    const res = await request(app)
      .patch(`/documents/${doc.id}`)
      .set('Authorization', bearer(alice))
      .send({
        originalName: 'renamed.pdf',
        folderId: folder.body.folder.id,
        tags: ['Tax', '2026'],
      });
    expect(res.status).toBe(200);
    expect(res.body.document).toMatchObject({
      originalName: 'renamed.pdf',
      folder: { name: 'Tax' },
      tags: ['2026', 'Tax'],
    });

    const byTag = await request(app)
      .get('/documents')
      .query({ tag: '2026' })
      .set('Authorization', bearer(alice));
    expect(byTag.body.total).toBe(1);
    const tags = await request(app).get('/tags').set('Authorization', bearer(alice));
    expect(tags.body.tags).toEqual([
      expect.objectContaining({ name: '2026', documentCount: 1 }),
      expect.objectContaining({ name: 'Tax', documentCount: 1 }),
    ]);
  });

  it('soft-deletes: the document disappears from every route but the row stays', async () => {
    const doc = await uploadOk(alice, 'a.pdf', PDF_BYTES);
    const del = await request(app)
      .delete(`/documents/${doc.id}`)
      .set('Authorization', bearer(alice));
    expect(del.status).toBe(204);
    expect(
      (await request(app).get(`/documents/${doc.id}`).set('Authorization', bearer(alice))).status,
    ).toBe(404);
    const list = await request(app).get('/documents').set('Authorization', bearer(alice));
    expect(list.body.total).toBe(0);
    const row = await testDb().document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(await testDb().auditEvent.count({ where: { action: 'DELETE', targetId: doc.id } })).toBe(
      1,
    );
  });
});

describe('GET /documents/:id/download (U6)', () => {
  it('streams the exact bytes with download headers and an audit row', async () => {
    const doc = await uploadOk(alice, 'Résumé.pdf', PDF_BYTES);
    const res = await request(app)
      .get(`/documents/${doc.id}/download`)
      .set('Authorization', bearer(alice))
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-length']).toBe(String(PDF_BYTES.length));
    expect(res.headers['content-disposition']).toContain('attachment;');
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9.pdf");
    expect((res.body as Buffer).equals(PDF_BYTES)).toBe(true);
    expect(
      await testDb().auditEvent.count({ where: { action: 'DOWNLOAD', targetId: doc.id } }),
    ).toBe(1);
  });
});

describe('requirement B1: user A can never touch user B’s documents', () => {
  it('answers 404 for every route, including guessed and malformed IDs', async () => {
    const doc = await uploadOk(alice, 'secret.pdf', PDF_BYTES);
    const asBob = (r: request.Test) => r.set('Authorization', bearer(bob));

    for (const id of [doc.id, randomUUID(), 'not-a-uuid']) {
      expect((await asBob(request(app).get(`/documents/${id}`))).status).toBe(404);
      expect((await asBob(request(app).get(`/documents/${id}/download`))).status).toBe(404);
      expect(
        (await asBob(request(app).patch(`/documents/${id}`).send({ originalName: 'x.pdf' })))
          .status,
      ).toBe(404);
      expect((await asBob(request(app).delete(`/documents/${id}`))).status).toBe(404);
    }
    const list = await asBob(request(app).get('/documents'));
    expect(list.body.total).toBe(0);

    // Nothing Bob did changed Alice's document.
    const row = await testDb().document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(row.deletedAt).toBeNull();
    expect(row.originalName).toBe('secret.pdf');
  });

  it('rejects unauthenticated access outright', async () => {
    expect((await request(app).get('/documents')).status).toBe(401);
    expect((await request(app).post('/documents').attach('file', PDF_BYTES, 'a.pdf')).status).toBe(
      401,
    );
  });
});
