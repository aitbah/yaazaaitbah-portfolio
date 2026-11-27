import type { ProjectDocument } from './project.model.js';

/**
 * Every stored file a project references, cover and gallery. Saving and pruning
 * must agree on it: a miss in pruning deletes an image still on the page.
 * Outside the model, which the API suite mocks.
 */
export function projectImageReferences(
  project: Partial<Pick<ProjectDocument, 'imageUrl' | 'gallery'>>,
): string[] {
  // `gallery` is defaulted by the schema, but a document stored before the
  // field existed - or one read without hydration - carries no array at all.
  // This runs inside the pruner, where throwing halts reconciliation and a
  // wrong answer deletes files, so an absent gallery means "no images".
  const images = project.gallery ?? [];

  return [project.imageUrl, ...images.map((image) => image.url)].filter(
    (reference): reference is string => Boolean(reference),
  );
}
