import {
  connectDatabase,
  disconnectDatabase,
} from './core/database/connection.js';
import { seedOptions } from './features/option/option.seed.js';
import { logger } from './core/logging/logger.js';

/**
 * Fills in the option lists and nothing else - what every install needs, unlike
 * the example content of `db:seed`. Safe on a database with real content;
 * nothing stored is overwritten.
 *
 *   docker compose exec backend npm run db:options
 */
async function run(): Promise<void> {
  await connectDatabase();

  try {
    const added = await seedOptions();

    logger.info({ added }, 'Option lists filled in');
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.error({ err: error }, 'Filling in the option lists failed');
  process.exitCode = 1;
});
