import type { RequestHandler, Response } from 'express';
import type { PublicUser, Role } from '@ecp/shared';
import type { Db } from '../db.js';
import { HttpError } from '../lib/errors.js';
import type { AccessTokens } from '../lib/tokens.js';

export type AuthUser = PublicUser;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      user?: AuthUser;
    }
  }
}

// The one projection of a user row that may leave the API.
export const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export function toPublicUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}): PublicUser {
  return { ...user, createdAt: user.createdAt.toISOString() };
}

// Verifies the bearer token, then re-reads the user. That costs one query per
// request but means deactivation and role changes apply immediately instead of
// when the 15-minute token expires (requirement A3).
export function requireAuth(db: Db, tokens: AccessTokens): RequestHandler {
  return async (req, res, next) => {
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }
    const claims = await tokens.verify(token);
    if (!claims) {
      next(new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
      return;
    }
    const user = await db.user.findUnique({ where: { id: claims.sub }, select: publicUserSelect });
    if (!user) {
      next(new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
      return;
    }
    if (!user.isActive) {
      next(new HttpError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated'));
      return;
    }
    res.locals.user = toPublicUser(user);
    next();
  };
}

export function requireRole(role: Role): RequestHandler {
  return (_req, res, next) => {
    if (res.locals.user?.role !== role) {
      next(new HttpError(403, 'FORBIDDEN', 'Insufficient permissions'));
      return;
    }
    next();
  };
}

// For handlers mounted behind requireAuth. Throwing keeps the type narrow without
// every handler re-checking a value the middleware already guaranteed.
export function currentUser(res: Response): AuthUser {
  if (!res.locals.user) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  return res.locals.user;
}
