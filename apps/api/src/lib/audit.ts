import type { Request } from 'express';
import type { Db } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';

export type AuditAction =
  | 'REGISTER'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'REFRESH_FAILURE'
  | 'REFRESH_REUSE_DETECTED'
  | 'ROLE_CHANGED'
  | 'USER_DEACTIVATED'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'DELETE';

export interface AuditInput {
  actorId?: string | null | undefined;
  action: AuditAction;
  targetType?: string | undefined;
  targetId?: string | undefined;
  result: 'SUCCESS' | 'FAILURE';
  // Small and structured. Never a password, token or file content. Emails are fine.
  metadata?: Prisma.InputJsonValue | undefined;
}

const USER_AGENT_MAX = 256;

export function requestContext(req: Request): { ip: string | null; userAgent: string | null } {
  const ua = req.get('user-agent');
  return {
    ip: req.ip ?? null,
    userAgent: ua ? ua.slice(0, USER_AGENT_MAX) : null,
  };
}

// Deliberately awaited, not fire-and-forget: if the audit row cannot be written the
// request fails, because an action without a trail is worse than a failed action.
export async function recordAudit(db: Db, req: Request, input: AuditInput): Promise<void> {
  const { ip, userAgent } = requestContext(req);
  await db.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      result: input.result,
      ip,
      userAgent,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
