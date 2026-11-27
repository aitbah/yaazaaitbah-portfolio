import {
  deleteManagedFile,
  listStoredReferences,
} from '../../core/storage/storage.service.js';
import { logger } from '../../core/logging/logger.js';
import { PROFILE_IMAGE_FIELDS } from './profile.images.js';
import { ProfileModel, SINGLETON_KEY } from './profile.model.js';

export type PruneResult = {
  removed: number;
  kept: number;
};

/**
 * Deletes stored images the profile no longer points at - files uploaded for a
 * form that was never saved. Each feature sweeps its own category.
 */
export async function removeOrphanPhotos(): Promise<PruneResult> {
  const stored = await listStoredReferences('profile');

  // A failure here throws rather than returning nothing: treating an unreadable
  // profile as "references nothing" would delete every photo it owns.
  const profile = await ProfileModel.findOne({ key: SINGLETON_KEY }).select(
    PROFILE_IMAGE_FIELDS.join(' '),
  );

  // Every image field, from the one list the model declares, so a field added
  // later cannot be read as an orphan and deleted.
  const inUse = new Set(
    PROFILE_IMAGE_FIELDS.map((field) => profile?.[field]).filter(
      (reference): reference is string => Boolean(reference),
    ),
  );

  const orphans = stored.filter((reference) => !inUse.has(reference));

  for (const orphan of orphans) {
    await deleteManagedFile(orphan);
  }

  if (orphans.length > 0) {
    logger.info({ removed: orphans.length }, 'Removed orphaned profile images');
  }

  return { removed: orphans.length, kept: stored.length - orphans.length };
}
