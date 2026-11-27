import {
  deleteManagedFile,
  listStoredReferences,
} from '../../core/storage/storage.service.js';
import { logger } from '../../core/logging/logger.js';
import { PROFILE_DOCUMENT_FIELD } from './profile.images.js';
import { ProfileModel, SINGLETON_KEY } from './profile.model.js';

export type PruneResult = {
  removed: number;
  kept: number;
};

/**
 * Deletes stored CVs the profile no longer points at - its own sweep, since a
 * sweep reconciles one category. Every locale's file counts as in use.
 */
export async function removeOrphanResumes(): Promise<PruneResult> {
  const stored = await listStoredReferences('resume');

  // A failure here throws rather than returning nothing: treating an unreadable
  // profile as "references nothing" would delete every CV it owns.
  const profile = await ProfileModel.findOne({ key: SINGLETON_KEY }).select(
    PROFILE_DOCUMENT_FIELD,
  );

  const inUse = new Set(profile?.[PROFILE_DOCUMENT_FIELD]?.values() ?? []);

  const orphans = stored.filter((reference) => !inUse.has(reference));

  for (const orphan of orphans) {
    await deleteManagedFile(orphan);
  }

  if (orphans.length > 0) {
    logger.info({ removed: orphans.length }, 'Removed orphaned resumes');
  }

  return { removed: orphans.length, kept: stored.length - orphans.length };
}
