import { z } from 'zod';

import {
  checkPeriod,
  employmentType,
  localizedText,
  yearMonth,
  MAX_DESCRIPTION_LENGTH,
  MAX_LOCATION_LENGTH,
  MAX_ORGANISATION_LENGTH,
  MAX_ROLE_LENGTH,
} from '@portfolio/shared';

/**
 * A position held at an organisation. `PUT` replaces rather than merges, so an
 * omitted optional field is cleared - the same contract every other entity uses.
 *
 * There is no `order`: a career is ordered by when things happened, and a
 * manual position that disagreed with the dates would be a state the admin
 * cannot see. See `experience.model.ts`.
 */
const experienceFields = z.object({
  role: localizedText(MAX_ROLE_LENGTH),
  organisation: localizedText(MAX_ORGANISATION_LENGTH),
  location: localizedText(MAX_LOCATION_LENGTH).optional(),
  employmentType,
  startDate: yearMonth,
  /** Absent for a current position; required otherwise - see `checkPeriod`. */
  endDate: yearMonth.optional(),
  current: z.boolean().default(false),
  description: localizedText(MAX_DESCRIPTION_LENGTH).optional(),
});

/**
 * The plain object, for the replacement update: it needs the field list, and
 * refining wraps the object in something that no longer exposes one.
 */
export const experienceShape = experienceFields;

// The three date fields only make sense together, so the rule that relates them
// is shared with the frontend rather than restated there.
export const experienceSchema = experienceFields.superRefine(checkPeriod);

export type ExperienceInput = z.infer<typeof experienceSchema>;
