import {
  deleteManagedFile,
  listStoredReferences,
} from '../../core/storage/storage.service.js';
import { logger } from '../../core/logging/logger.js';
import { projectImageReferences } from './project.images.js';
import { ProjectModel } from './project.model.js';

export type PruneResult = {
  removed: number;
  kept: number;
};

/**
 * Deletes stored images no project points at - files uploaded for a form that
 * was never saved. Each feature sweeps its own category.
 */
export async function removeOrphanCovers(): Promise<PruneResult> {
  const stored = await listStoredReferences('project');

  // A failure here throws rather than returning nothing: treating an unreadable
  // collection as "references nothing" would delete every cover it owns.
  const projects = await ProjectModel.find().select('imageUrl gallery');

  // Covers *and* gallery images, from the one list the model declares. Reading
  // the cover alone - which is all this did before galleries existed - treats
  // every gallery image as an orphan and deletes it.
  const inUse = new Set(projects.flatMap(projectImageReferences));

  const orphans = stored.filter((reference) => !inUse.has(reference));

  for (const orphan of orphans) {
    await deleteManagedFile(orphan);
  }

  if (orphans.length > 0) {
    logger.info({ removed: orphans.length }, 'Removed orphaned project images');
  }

  return { removed: orphans.length, kept: stored.length - orphans.length };
}
