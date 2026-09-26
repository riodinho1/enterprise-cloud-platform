import { Router, type Request, type Response } from 'express';
import {
  loginSchema,
  registerSchema,
  type AuthResponse,
  type LoginInput,
  type RegisterInput,
} from '@ecp/shared';
import type { Config } from '../config.js';
import { isUniqueViolation, type Db } from '../db.js';
import { recordAudit, requestContext } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  newTokenFamilyId,
  type AccessTokens,
} from '../lib/tokens.js';
import { currentUser, publicUserSelect, requireAuth, toPublicUser } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';

export const REFRESH_COOKIE = 'ecp_refresh';

export interface AuthDeps {
  db: Db;
  tokens: AccessTokens;
  config: Config;
}

interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: Date;
}

export function authRouter({ db, tokens, config }: AuthDeps): Router {
  const router = Router();
  const limiter = authRateLimiter(config.AUTH_RATE_LIMIT_MAX);

  // httpOnly: JavaScript cannot read it, so XSS cannot steal it.
  // secure: HTTPS only (browsers exempt localhost). sameSite strict: never sent cross-site.
  // path: only sent to the auth routes, never with ordinary API calls.
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: config.REFRESH_COOKIE_PATH,
  };

  function readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, unknown>;
    const value = cookies[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  async function issueSession(
    req: Request,
    res: Response,
    user: SessionUser,
    familyId: string,
  ): Promise<AuthResponse> {
    const raw = generateRefreshToken();
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(raw),
        familyId,
        expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000),
        ...requestContext(req),
      },
    });
    res.cookie(REFRESH_COOKIE, raw, {
      ...cookieOptions,
      maxAge: config.REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
    const accessToken = await tokens.sign({ sub: user.id, role: user.role });
    return {
      accessToken,
      expiresInSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
      user: toPublicUser(user),
    };
  }

  router.post('/register', limiter, validateBody(registerSchema), async (req, res) => {
    const input = req.body as RegisterInput;
    let user: SessionUser;
    try {
      user = await db.user.create({
        data: {
          email: input.email,
          passwordHash: await hashPassword(input.password),
          displayName: input.displayName,
        },
        select: publicUserSelect,
      });
    } catch (err) {
      // Trade-off: a 409 confirms the address has an account. The rate limiter bounds
      // how fast that can be probed; a silent 201 would break the sign-up form instead.
      if (isUniqueViolation(err)) {
        throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      }
      throw err;
    }
    await recordAudit(db, req, {
      actorId: user.id,
      action: 'REGISTER',
      targetType: 'user',
      targetId: user.id,
      result: 'SUCCESS',
    });
    res.status(201).json({ user: toPublicUser(user) });
  });

  router.post('/login', limiter, validateBody(loginSchema), async (req, res) => {
    const input = req.body as LoginInput;
    const user = await db.user.findUnique({ where: { email: input.email } });
    // Always run a verify so an unknown email takes as long as a wrong password.
    const passwordOk = await verifyPassword(
      user?.passwordHash ?? (await dummyPasswordHash()),
      input.password,
    );
    if (!user || !passwordOk) {
      await recordAudit(db, req, {
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        targetId: user?.id,
        result: 'FAILURE',
        metadata: { email: input.email, reason: 'invalid_credentials' },
      });
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    if (!user.isActive) {
      await recordAudit(db, req, {
        actorId: user.id,
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        targetId: user.id,
        result: 'FAILURE',
        metadata: { reason: 'deactivated' },
      });
      throw new HttpError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated');
    }
    const body = await issueSession(req, res, user, newTokenFamilyId());
    await recordAudit(db, req, {
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      targetType: 'user',
      targetId: user.id,
      result: 'SUCCESS',
    });
    res.json(body);
  });

  router.post('/refresh', limiter, async (req, res) => {
    const raw = readRefreshCookie(req);
    if (!raw) throw new HttpError(401, 'UNAUTHORIZED', 'Refresh token missing');

    const stored = await db.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(raw) },
      include: { user: true },
    });
    if (!stored) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      await recordAudit(db, req, {
        action: 'REFRESH_FAILURE',
        result: 'FAILURE',
        metadata: { reason: 'unknown_token' },
      });
      throw new HttpError(401, 'UNAUTHORIZED', 'Refresh token is not valid');
    }

    // Checked before the reuse test: deactivation revokes every token the user has,
    // so a later refresh from their browser is expected, not a sign of theft.
    if (!stored.user.isActive) {
      await db.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      await recordAudit(db, req, {
        actorId: stored.userId,
        action: 'REFRESH_FAILURE',
        result: 'FAILURE',
        metadata: { reason: 'deactivated' },
      });
      throw new HttpError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated');
    }

    if (stored.revokedAt) {
      // A token that was already rotated is being presented again: either the
      // legitimate client or an attacker holds a stale copy. Nobody can tell which,
      // so every token descended from the same login is revoked (requirement B4).
      await db.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      await recordAudit(db, req, {
        actorId: stored.userId,
        action: 'REFRESH_REUSE_DETECTED',
        targetType: 'refresh_token_family',
        targetId: stored.familyId,
        result: 'FAILURE',
      });
      throw new HttpError(401, 'UNAUTHORIZED', 'Refresh token is no longer valid');
    }

    if (stored.expiresAt <= new Date()) {
      await db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      await recordAudit(db, req, {
        actorId: stored.userId,
        action: 'REFRESH_FAILURE',
        result: 'FAILURE',
        metadata: { reason: 'expired' },
      });
      throw new HttpError(401, 'UNAUTHORIZED', 'Refresh token has expired');
    }

    // Rotation: claim the old token first so two concurrent refreshes cannot both
    // succeed, then issue the successor inside the same family.
    const claimed = await db.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Refresh token is no longer valid');
    }
    const body = await issueSession(req, res, stored.user, stored.familyId);
    res.json(body);
  });

  router.post('/logout', async (req, res) => {
    const raw = readRefreshCookie(req);
    let actorId: string | null = null;
    if (raw) {
      const stored = await db.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(raw) },
        select: { id: true, userId: true, revokedAt: true },
      });
      if (stored) {
        actorId = stored.userId;
        if (!stored.revokedAt) {
          await db.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
          });
        }
      }
    }
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    await recordAudit(db, req, { actorId, action: 'LOGOUT', result: 'SUCCESS' });
    res.status(204).end();
  });

  router.get('/me', requireAuth(db, tokens), (_req, res) => {
    res.json({ user: currentUser(res) });
  });

  return router;
}
