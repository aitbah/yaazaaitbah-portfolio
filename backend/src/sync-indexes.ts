import {
  connectDatabase,
  disconnectDatabase,
} from './core/database/connection.js';
import { syncModelIndexes } from './core/database/sync-indexes.js';
import { logger } from './core/logging/logger.js';

// Imported for the registrations it performs, not for what it exports: every
// feature the application serves reaches its model through this graph, so a
// section built next year is covered without a line being added here.
import './app.js';

/**
 * Brings the database's indexes in line with the models - after changing an
 * index or a field one names, since Mongoose never drops an index on its own.
 * Run deliberately, not at boot, because building an index locks its
 * collection.
 *
 *   docker compose exec backend npm run db:indexes
 */
async function run() {
  await connectDatabase();

  try {
    for (const result of await syncModelIndexes()) {
      if (result.dropped.length === 0 && result.created.length === 0) {
        continue;
      }

      logger.info(result, 'Indexes reconciled');
    }
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Index reconciliation failed');
  process.exit(1);
});
