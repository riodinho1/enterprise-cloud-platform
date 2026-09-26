import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Storage } from './lib/storage.js';
import { AccessTokens } from './lib/tokens.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createLogger, requestLogger } from './middleware/logging.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';
import { foldersRouter, tagsRouter } from './routes/folders.js';
import { healthRouter } from './routes/health.js';

export { APP_VERSION } from './version.js';

export interface AppDeps {
  db: Db;
  storage: Storage;
  logger?: Logger;
}

// The app is built by a function so tests can construct it with their own config,
// database and storage, and without opening a port.
export function createApp(config: Config, deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);

  const logger = deps.logger ?? createLogger(config);
  const tokens = new AccessTokens(config.JWT_ACCESS_SECRET, config.ACCESS_TOKEN_TTL_SECONDS);

  // Middleware order is deliberate: identify the request, log it, harden headers,
  // gate the origin, parse input, then route. See architecture.md 5.2.
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  app.use(healthRouter(deps.db, deps.storage));
  app.use('/auth', authRouter({ db: deps.db, tokens, config }));
  app.use('/admin', adminRouter({ db: deps.db, tokens }));
  app.use('/documents', documentsRouter({ db: deps.db, storage: deps.storage, tokens, config }));
  app.use('/folders', foldersRouter({ db: deps.db, tokens }));
  app.use('/tags', tagsRouter({ db: deps.db, tokens }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
