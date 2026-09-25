import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'api listening', port: config.PORT }));
});

// Containers receive SIGTERM on stop. Closing the listener lets in-flight requests finish.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
