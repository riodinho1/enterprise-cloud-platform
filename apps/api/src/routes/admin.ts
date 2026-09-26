import { Router } from 'express';
import { changeRoleSchema, type ChangeRoleInput } from '@ecp/shared';
import { z } from 'zod';
import type { Db } from '../db.js';
import { recordAudit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import type { AccessTokens } from '../lib/tokens.js';
import {
  currentUser,
  publicUserSelect,
  requireAuth,
  requireRole,
  toPublicUser,
} from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export interface AdminDeps {
  db: Db;
  tokens: AccessTokens;
}

const uuid = z.string().uuid();

// A malformed ID gets the same 404 as an unknown one, so nothing can be learned
// from the difference (decision D8).
function parseUserId(raw: unknown): string {
  const result = uuid.safeParse(raw);
  if (!result.success) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  return result.data;
}

const USER_LIST_LIMIT = 200;

export function adminRouter({ db, tokens }: AdminDeps): Router {
  const router = Router();

  // Every admin route: valid token, active user, admin role. Order matters.
  router.use(requireAuth(db, tokens), requireRole('admin'));

  router.get('/users', async (_req, res) => {
    const users = await db.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: 'asc' },
      take: USER_LIST_LIMIT,
    });
    res.json({ users: users.map(toPublicUser) });
  });

  router.patch('/users/:id/role', validateBody(changeRoleSchema), async (req, res) => {
    const actor = currentUser(res);
    const id = parseUserId(req.params.id);
    const { role } = req.body as ChangeRoleInput;
    // Admins cannot demote themselves: the last admin locking everyone out is a
    // classic self-inflicted outage.
    if (id === actor.id) {
      throw new HttpError(400, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
    }
    const target = await db.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

    const updated = await db.user.update({
      where: { id },
      data: { role },
      select: publicUserSelect,
    });
    await recordAudit(db, req, {
      actorId: actor.id,
      action: 'ROLE_CHANGED',
      targetType: 'user',
      targetId: id,
      result: 'SUCCESS',
      metadata: { from: target.role, to: role },
    });
    res.json({ user: toPublicUser(updated) });
  });

  router.post('/users/:id/deactivate', async (req, res) => {
    const actor = currentUser(res);
    const id = parseUserId(req.params.id);
    if (id === actor.id) {
      throw new HttpError(400, 'CANNOT_DEACTIVATE_SELF', 'You cannot deactivate yourself');
    }
    const target = await db.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

    // Deactivation ends existing sessions too: the flag stops new access tokens
    // at requireAuth, and revoking the refresh tokens stops new ones being minted.
    const [updated] = await db.$transaction([
      db.user.update({ where: { id }, data: { isActive: false }, select: publicUserSelect }),
      db.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await recordAudit(db, req, {
      actorId: actor.id,
      action: 'USER_DEACTIVATED',
      targetType: 'user',
      targetId: id,
      result: 'SUCCESS',
    });
    res.json({ user: toPublicUser(updated) });
  });

  return router;
}
