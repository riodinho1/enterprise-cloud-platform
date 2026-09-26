import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  login,
  promoteToAdmin,
  registerAndLogin,
  registerUser,
  resetDb,
  testDb,
  type Session,
} from '../test/helpers.js';

const app = createTestApp();
const ADMIN = 'admin@example.com';
const USER = 'bob@example.com';

let admin: Session;
let user: Session;

beforeEach(async () => {
  await resetDb();
  await registerUser(app, ADMIN, 'Admin');
  await promoteToAdmin(ADMIN);
  admin = await login(app, ADMIN);
  user = await registerAndLogin(app, USER);
});

const asAdmin = () => `Bearer ${admin.accessToken}`;
const asUser = () => `Bearer ${user.accessToken}`;

describe('requirement B2: non-admins are blocked from admin routes', () => {
  it('rejects an ordinary user with 403 and no token with 401', async () => {
    const forbidden = await request(app).get('/admin/users').set('Authorization', asUser());
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    expect((await request(app).get('/admin/users')).status).toBe(401);
    expect(
      (await request(app).patch(`/admin/users/${admin.userId}/role`).set('Authorization', asUser()))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/admin/users/${admin.userId}/deactivate`)
          .set('Authorization', asUser())
      ).status,
    ).toBe(403);
  });
});

describe('GET /admin/users', () => {
  it('lists users without password hashes', async () => {
    const res = await request(app).get('/admin/users').set('Authorization', asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.users.map((u: { email: string }) => u.email)).toEqual([ADMIN, USER]);
    expect(res.text).not.toContain('passwordHash');
  });
});

describe('PATCH /admin/users/:id/role', () => {
  it('changes the role, audits it, and the change applies to existing tokens at once', async () => {
    const res = await request(app)
      .patch(`/admin/users/${user.userId}/role`)
      .set('Authorization', asAdmin())
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');

    // Same access token as before the change: the role is read from the database, not the JWT.
    const nowAdmin = await request(app).get('/admin/users').set('Authorization', asUser());
    expect(nowAdmin.status).toBe(200);

    const audit = await testDb().auditEvent.findFirst({ where: { action: 'ROLE_CHANGED' } });
    expect(audit?.actorId).toBe(admin.userId);
    expect(audit?.targetId).toBe(user.userId);
    expect(audit?.metadata).toEqual({ from: 'user', to: 'admin' });
  });

  it('refuses to change your own role', async () => {
    const res = await request(app)
      .patch(`/admin/users/${admin.userId}/role`)
      .set('Authorization', asAdmin())
      .send({ role: 'user' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');
  });

  it('validates the role and hides whether an ID exists', async () => {
    const bad = await request(app)
      .patch(`/admin/users/${user.userId}/role`)
      .set('Authorization', asAdmin())
      .send({ role: 'superuser' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    for (const id of [randomUUID(), 'not-a-uuid']) {
      const res = await request(app)
        .patch(`/admin/users/${id}/role`)
        .set('Authorization', asAdmin())
        .send({ role: 'admin' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    }
  });
});

describe('POST /admin/users/:id/deactivate (requirement A3)', () => {
  it('deactivates the user and ends their sessions immediately', async () => {
    const res = await request(app)
      .post(`/admin/users/${user.userId}/deactivate`)
      .set('Authorization', asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);

    const me = await request(app).get('/auth/me').set('Authorization', asUser());
    expect(me.status).toBe(403);
    const refresh = await request(app).post('/auth/refresh').set('Cookie', user.cookie);
    expect(refresh.status).toBe(403);

    const live = await testDb().refreshToken.count({
      where: { userId: user.userId, revokedAt: null },
    });
    expect(live).toBe(0);
    const audit = await testDb().auditEvent.findFirst({ where: { action: 'USER_DEACTIVATED' } });
    expect(audit?.actorId).toBe(admin.userId);
    expect(audit?.targetId).toBe(user.userId);
  });

  it('refuses to deactivate yourself', async () => {
    const res = await request(app)
      .post(`/admin/users/${admin.userId}/deactivate`)
      .set('Authorization', asAdmin());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
  });
});
