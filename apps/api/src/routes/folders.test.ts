import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PDF_BYTES,
  createTestApp,
  registerAndLogin,
  resetDb,
  testDb,
  upload,
  type Session,
} from '../test/helpers.js';

const app = createTestApp();
let alice: Session;
let bob: Session;
const bearer = (s: Session) => `Bearer ${s.accessToken}`;

async function createFolder(session: Session, name: string): Promise<string> {
  const res = await request(app)
    .post('/folders')
    .set('Authorization', bearer(session))
    .send({ name });
  if (res.status !== 201) throw new Error(`folder failed: ${res.status} ${res.text}`);
  return res.body.folder.id as string;
}

beforeEach(async () => {
  await resetDb();
  alice = await registerAndLogin(app, 'alice@example.com');
  bob = await registerAndLogin(app, 'bob@example.com');
});

describe('folders', () => {
  it('creates, lists, renames and rejects duplicates per owner', async () => {
    const id = await createFolder(alice, 'Invoices');
    await createFolder(bob, 'Invoices'); // same name, different owner: fine

    const dup = await request(app)
      .post('/folders')
      .set('Authorization', bearer(alice))
      .send({ name: 'Invoices' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('FOLDER_EXISTS');

    const renamed = await request(app)
      .patch(`/folders/${id}`)
      .set('Authorization', bearer(alice))
      .send({ name: 'Receipts' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.folder.name).toBe('Receipts');

    const list = await request(app).get('/folders').set('Authorization', bearer(alice));
    expect(list.body.folders.map((f: { name: string }) => f.name)).toEqual(['Receipts']);
  });

  it('deleting a folder un-files its documents instead of deleting them', async () => {
    const id = await createFolder(alice, 'Tax');
    const up = await upload(app, alice, 'a.pdf', PDF_BYTES, { folderId: id });
    expect(up.body.document.folder.id).toBe(id);

    const del = await request(app).delete(`/folders/${id}`).set('Authorization', bearer(alice));
    expect(del.status).toBe(204);

    const doc = await request(app)
      .get(`/documents/${up.body.document.id}`)
      .set('Authorization', bearer(alice));
    expect(doc.status).toBe(200);
    expect(doc.body.document.folder).toBeNull();
  });

  it('hides other users’ folders (404 on read, rename and delete)', async () => {
    const id = await createFolder(alice, 'Private');
    for (const target of [id, randomUUID(), 'nope']) {
      const rename = await request(app)
        .patch(`/folders/${target}`)
        .set('Authorization', bearer(bob))
        .send({ name: 'Mine now' });
      expect(rename.status).toBe(404);
      expect(
        (await request(app).delete(`/folders/${target}`).set('Authorization', bearer(bob))).status,
      ).toBe(404);
    }
    const list = await request(app).get('/folders').set('Authorization', bearer(bob));
    expect(list.body.folders).toEqual([]);
    expect(await testDb().folder.count({ where: { ownerId: alice.userId, name: 'Private' } })).toBe(
      1,
    );
  });
});

describe('tags', () => {
  it('are created on demand, counted, scoped to the owner and deletable', async () => {
    const up = await upload(app, alice, 'a.pdf', PDF_BYTES);
    await request(app)
      .patch(`/documents/${up.body.document.id}`)
      .set('Authorization', bearer(alice))
      .send({ tags: ['work', 'work', ' urgent '] });

    const mine = await request(app).get('/tags').set('Authorization', bearer(alice));
    expect(
      mine.body.tags.map((t: { name: string; documentCount: number }) => [t.name, t.documentCount]),
    ).toEqual([
      ['urgent', 1],
      ['work', 1],
    ]);
    const theirs = await request(app).get('/tags').set('Authorization', bearer(bob));
    expect(theirs.body.tags).toEqual([]);

    const tagId = mine.body.tags[0].id as string;
    expect(
      (await request(app).delete(`/tags/${tagId}`).set('Authorization', bearer(bob))).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/tags/${tagId}`).set('Authorization', bearer(alice))).status,
    ).toBe(204);
    const doc = await request(app)
      .get(`/documents/${up.body.document.id}`)
      .set('Authorization', bearer(alice));
    expect(doc.body.document.tags).toEqual(['work']);
  });
});
