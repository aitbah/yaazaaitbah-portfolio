import { z } from 'zod';

import {
  checkPeriod,
  educationLevel,
  localizedText,
  yearMonth,
  MAX_DESCRIPTION_LENGTH,
  MAX_FIELD_OF_STUDY_LENGTH,
  MAX_INSTITUTION_LENGTH,
  MAX_LOCATION_LENGTH,
  MAX_QUALIFICATION_LENGTH,
} from '@portfolio/shared';

/**
 * A course of study at an institution. `PUT` replaces rather than merges, so an
 * omitted optional field is cleared - the same contract every other entity uses.
 *
 * There is no `order`: what someone studied is ordered by when they studied it,
 * and a stored position that disagreed with the dates would be a state the
 * admin cannot see. Same rule as a career, for the same reason.
 */
const educationFields = z.object({
  institution: localizedText(MAX_INSTITUTION_LENGTH),
  qualification: localizedText(MAX_QUALIFICATION_LENGTH),
  fieldOfStudy: localizedText(MAX_FIELD_OF_STUDY_LENGTH).optional(),
  level: educationLevel,
  location: localizedText(MAX_LOCATION_LENGTH).optional(),
  startDate: yearMonth,
  /** Absent while the course is under way; required otherwise - `checkPeriod`. */
  endDate: yearMonth.optional(),
  current: z.boolean().default(false),
  description: localizedText(MAX_DESCRIPTION_LENGTH).optional(),
});

/**
 * The plain object, for the replacement update: it needs the field list, and
 * refining wraps the object in something that no longer exposes one.
 */
export const educationShape = educationFields;

// The same three date fields as a position, so the same shared rule relates
// them - written once in `shared` rather than restated per entity.
export const educationSchema = educationFields.superRefine(checkPeriod);

export type EducationInput = z.infer<typeof educationSchema>;
