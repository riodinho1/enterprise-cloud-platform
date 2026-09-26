import { createApp } from './app.js';
import { loadConfig, loadDotEnv } from './config.js';
import { createDb } from './db.js';
import { createStorage } from './lib/storage.js';
import { createLogger } from './middleware/logging.js';

loadDotEnv();
const config = loadConfig();
const logger = createLogger(config);
const db = createDb(config.DATABASE_URL);
const storage = createStorage(config);
const app = createApp(config, { db, storage, logger });

// Locally the bucket is created on first start. In AWS it is created by Terraform
// and this call only confirms it exists. Storage being down must not stop the API
// from starting: /ready reports it and the orchestrator holds traffic.
try {
  await storage.ensureBucket();
} catch (err) {
  logger.warn({ err, bucket: storage.bucket }, 'object storage not ready at startup');
}

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'api listening');
});

// Containers receive SIGTERM on stop. Closing the listener lets in-flight requests
// finish, then the database pool is released before the process exits.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
  });
}
