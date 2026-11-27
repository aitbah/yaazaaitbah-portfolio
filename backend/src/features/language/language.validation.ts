import { z } from 'zod';

import { languageCode, languageLevel, languageOrder } from '@portfolio/shared';

/**
 * A language and how well it is spoken. `PUT` replaces rather than merges, like
 * every other entity.
 *
 * There is no name: it is rendered from the code in the reader's locale. See
 * `language.model.ts`.
 */
export const languageSchema = z.object({
  code: languageCode,
  level: languageLevel,
  /** Absent means "leave it at the back"; the ordering has its own endpoint. */
  order: languageOrder.optional(),
});

export type LanguageInput = z.infer<typeof languageSchema>;
