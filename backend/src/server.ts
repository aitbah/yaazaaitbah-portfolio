import { createApp } from './app.js';
import { env } from './config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
} from './core/database/connection.js';
import { logger } from './core/logging/logger.js';
import { reportMailConfiguration } from './core/mail/mailer.js';

async function bootstrap() {
  await connectDatabase();

  reportMailConfiguration();

  const server = createApp().listen(env.BACKEND_PORT, () => {
    logger.info(
      { port: env.BACKEND_PORT, environment: env.NODE_ENV },
      'Backend started',
    );
  });

  const SHUTDOWN_GRACE_MS = 10_000;

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');

    // A connection that never closes must not hold the process open forever.
    const giveUp = setTimeout(() => {
      logger.warn('Connections still open; exiting anyway');
      process.exit(0);
    }, SHUTDOWN_GRACE_MS);
    giveUp.unref();

    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => shutdown(signal));
  }
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Backend failed to start');
  process.exit(1);
});
