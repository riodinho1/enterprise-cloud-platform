import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@ecp/shared';
import { HttpError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = {
    error: { code: 'NOT_FOUND', message: 'Route not found', requestId: String(req.id) },
  };
  res.status(404).json(body);
};

interface BodyParserError {
  type: string;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string';
}

// Last middleware. Every failure leaves as the same JSON shape with a request ID.
// Internal errors are logged with their stack but never described to the client.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(req.id);
  let status = 500;
  let body: ApiError = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId },
  };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, requestId } };
    if (err.details !== undefined) body.error.details = err.details;
  } else if (isBodyParserError(err) && err.type === 'entity.parse.failed') {
    status = 400;
    body = {
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON', requestId },
    };
  } else if (isBodyParserError(err) && err.type === 'entity.too.large') {
    status = 413;
    body = {
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large', requestId },
    };
  } else {
    req.log.error({ err }, 'unhandled error');
  }

  res.status(status).json(body);
};
