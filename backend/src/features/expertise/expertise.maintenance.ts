import {
  deleteManagedFile,
  listStoredReferences,
} from '../../core/storage/storage.service.js';
import { logger } from '../../core/logging/logger.js';
import { ExpertiseModel } from './expertise.model.js';

export type PruneResult = {
  removed: number;
  kept: number;
};

/**
 * Deletes stored logos no row points at. Only uploaded logos have files, and
 * all three kinds share one storage category, so they are swept together.
 */
export async function removeOrphanIcons(): Promise<PruneResult> {
  const stored = await listStoredReferences('expertise');

  // A failure here throws rather than returning nothing: treating an unreadable
  // collection as "references nothing" would delete every logo it owns.
  const rows = await ExpertiseModel.find().select('icon');

  const inUse = new Set(
    rows
      .map((row) => (row.icon?.kind === 'upload' ? row.icon.value : null))
      .filter((reference): reference is string => Boolean(reference)),
  );

  const orphans = stored.filter((reference) => !inUse.has(reference));

  for (const orphan of orphans) {
    await deleteManagedFile(orphan);
  }

  if (orphans.length > 0) {
    logger.info({ removed: orphans.length }, 'Removed orphaned logos');
  }

  return { removed: orphans.length, kept: stored.length - orphans.length };
}
