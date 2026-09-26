import { Router } from 'express';
import type { HealthResponse, ReadyResponse } from '@ecp/shared';
import type { Db } from '../db.js';
import { APP_VERSION } from '../version.js';

const READY_TIMEOUT_MS = 2000;

// A hung database must not hang the readiness probe: the orchestrator needs an
// answer within its own timeout to decide whether to route traffic here.
async function databaseIsReachable(db: Db): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('readiness check timed out')), READY_TIMEOUT_MS);
    timer.unref();
  });
  try {
    await Promise.race([db.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function healthRouter(db: Db): Router {
  const router = Router();

  // Liveness: the process is up. Never touches dependencies.
  router.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      version: APP_VERSION,
    };
    res.json(body);
  });

  // Readiness: the process can serve requests. Object storage joins the checks in Phase 4.
  router.get('/ready', async (_req, res) => {
    const database = await databaseIsReachable(db);
    const body: ReadyResponse = {
      status: database ? 'ok' : 'degraded',
      checks: { database: database ? 'ok' : 'failed' },
    };
    res.status(database ? 200 : 503).json(body);
  });

  return router;
}
