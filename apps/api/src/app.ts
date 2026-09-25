import express, { type Express } from 'express';
import type { Config } from './config.js';
import { healthRouter } from './routes/health.js';

export const APP_VERSION = '0.1.0';

// The app is built by a function so tests can construct it with their own config
// and without opening a port.
export function createApp(_config: Config): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use('/health', healthRouter());

  return app;
}
