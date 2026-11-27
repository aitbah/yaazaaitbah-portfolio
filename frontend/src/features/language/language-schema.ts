import { z } from 'zod';

import {
  languageCode,
  languageLevel,
  type LanguageCode,
} from '@portfolio/shared';

/**
 * The form's schema, composed on the shared rules.
 *
 * The code select holds '' while nothing is chosen. Left as-is that would pass
 * the string check and fail the enum, so an untouched field would read as "that
 * is not a language" rather than "you did not choose". The *level* needs no
 * such step: it is a code now, and a code's minimum of one already says it.
 */
export const languageSchema = z.object({
  code: z.preprocess(
    (value) => (value === '' ? undefined : value),
    languageCode,
  ),
  level: languageLevel,
});

/** What the API is sent. */
export type LanguageInput = z.infer<typeof languageSchema>;

/**
 * What the form holds. Declared rather than inferred, because preprocessing
 * types the schema's own input as `unknown`.
 */
export type LanguageFormValues = {
  code: LanguageCode | '';
  level: string;
};
