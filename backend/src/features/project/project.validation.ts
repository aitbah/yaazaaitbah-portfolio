import { z } from 'zod';

import {
  documentId,
  externalUrl,
  gallery,
  imageAlt,
  localizedText,
  photoReference,
  projectOrder,
  slug,
  MAX_DESCRIPTION_LENGTH,
  MAX_PROJECT_NARRATIVE_LENGTH,
  MAX_PROJECT_ROLE_LENGTH,
  MAX_TITLE_LENGTH,
} from '@portfolio/shared';

/**
 * The whole project. `PUT` replaces rather than merges, so an omitted optional
 * field is cleared - the same contract the profile and the expertise rows use.
 */
export const projectSchema = z.object({
  /**
   * Required on every write, including an update: `PUT` replaces, and a project
   * that lost its address would lose its page. The client sends back what it
   * was given unless the owner edited it.
   */
  slug,
  title: localizedText(MAX_TITLE_LENGTH),
  description: localizedText(MAX_DESCRIPTION_LENGTH),
  // A project may legitimately have none yet, so absent means an empty list
  // rather than a missing field.
  stack: z.array(documentId).default([]),
  // The cover: the one image that stands for the project in a list.
  imageUrl: photoReference.optional(),
  imageAlt: imageAlt.optional(),
  /**
   * Screenshots and detail shots. Position in the array is the display order,
   * and `PUT` sends the whole gallery - so reordering is sending the same
   * entries in a different sequence, with no separate endpoint to disagree
   * with. Absent means an empty gallery rather than a missing field.
   */
  gallery: gallery.default([]),
  /**
   * What the project says about itself beyond what it is: what the owner did,
   * what made it hard, what was decided, what changed.
   *
   * Optional, every one of them. `PUT` clears what it is not sent, and
   * `replacementUpdate` reads its field list from this schema - so a field
   * added here is cleared correctly without a second list to keep in step.
   */
  role: localizedText(MAX_PROJECT_ROLE_LENGTH).optional(),
  problem: localizedText(MAX_PROJECT_NARRATIVE_LENGTH).optional(),
  approach: localizedText(MAX_PROJECT_NARRATIVE_LENGTH).optional(),
  outcome: localizedText(MAX_PROJECT_NARRATIVE_LENGTH).optional(),
  repoUrl: externalUrl.optional(),
  liveUrl: externalUrl.optional(),
  featured: z.boolean().default(false),
  // Absent means "leave it at the front"; there is no reorder UI to send it.
  order: projectOrder.default(0),
});

export type ProjectInput = z.infer<typeof projectSchema>;
