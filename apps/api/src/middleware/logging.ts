import { randomUUID } from 'node:crypto';
import { pino, type Logger } from 'pino';
import { pinoHttp, type HttpLogger } from 'pino-http';
import type { Config } from '../config.js';

export function createLogger(config: Config): Logger {
  return pino({
    level: config.LOG_LEVEL,
    // Credentials must never reach the log pipeline, where retention is long and access is wide.
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  });
}

// One request ID per request, returned to the client so a support ticket can be
// matched to the exact log lines. The load balancer in AWS uses the same header.
export function requestLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    genReqId: (_req, res) => {
      const id = randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/health' },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}
