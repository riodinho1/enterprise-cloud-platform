import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { HttpError } from '../lib/errors.js';

// Parses and replaces req.body with the typed, trimmed, normalised value, so handlers
// never see raw input. Error details name the field but never echo the value.
export function validateBody<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      next(new HttpError(400, 'VALIDATION_ERROR', 'Request body is invalid', details));
      return;
    }
    req.body = result.data;
    next();
  };
}
