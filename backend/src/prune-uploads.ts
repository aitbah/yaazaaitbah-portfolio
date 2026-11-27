import {
  connectDatabase,
  disconnectDatabase,
} from './core/database/connection.js';
import { logger } from './core/logging/logger.js';
import { unownedDirectories } from './core/storage/storage.service.js';
import {
  STORAGE_CATEGORIES,
  type StorageCategory,
} from './core/storage/storage.types.js';
import type { PruneResult } from './features/profile/profile.maintenance.js';
import { removeOrphanPhotos } from './features/profile/profile.maintenance.js';
import { removeOrphanResumes } from './features/profile/resume.maintenance.js';
import { removeOrphanCovers } from './features/project/project.maintenance.js';
import { removeOrphanIcons } from './features/expertise/expertise.maintenance.js';

/**
 * Deletes uploaded files nothing points at any more; safe at any time.
 *
 *   docker compose exec backend npm run uploads:prune
 *
 * Each feature owns what its category references; this composes them in a total
 * record, so a category without a reconciliation does not build.
 */
const RECONCILE: Record<StorageCategory, () => Promise<PruneResult>> = {
  profile: removeOrphanPhotos,
  project: removeOrphanCovers,
  expertise: removeOrphanIcons,
  resume: removeOrphanResumes,
};

async function run() {
  await connectDatabase();

  try {
    // In the order the categories are declared, so a run reads the same way
    // twice.
    for (const category of STORAGE_CATEGORIES) {
      logger.info(
        { category, ...(await RECONCILE[category]()) },
        'Category reconciled',
      );
    }

    const unowned = await unownedDirectories();

    if (unowned.length > 0) {
      logger.warn(
        { directories: unowned },
        'Upload directories belong to no category and are swept by nothing',
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Upload reconciliation failed');
  process.exit(1);
});
