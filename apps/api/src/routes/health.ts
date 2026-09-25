import { Router } from 'express';
import type { HealthResponse } from '@ecp/shared';
import { APP_VERSION } from '../app.js';

// Liveness only: "the process is up". Readiness (/ready, checks DB and storage)
// arrives in Phase 3 once there is a database to check.
export function healthRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      version: APP_VERSION,
    };
    res.json(body);
  });
  return router;
}
