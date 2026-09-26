import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { ApiError } from '@ecp/shared';

const WINDOW_MS = 15 * 60 * 1000;

// Applied to login, register and refresh only. Slows credential stuffing and
// account enumeration without touching ordinary API traffic.
export function authRateLimiter(max: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      const body: ApiError = {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts, try again later',
          requestId: String(req.id),
        },
      };
      res.status(429).json(body);
    },
  });
}
