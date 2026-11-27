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
import { filledLocales, optionalLocalized } from '@/lib/localized-schema';

/**
 * The form's schema. Every rule comes from the shared package, including the
 * one relating the three date fields - the very same `checkPeriod` a career
 * uses, so the admin is told about a period that contradicts itself before a
 * request is made, by the rule the server would have used.
 */
export const educationSchema = z
  .object({
    institution: z.preprocess(
      filledLocales,
      localizedText(MAX_INSTITUTION_LENGTH),
    ),
    qualification: z.preprocess(
      filledLocales,
      localizedText(MAX_QUALIFICATION_LENGTH),
    ),
    fieldOfStudy: optionalLocalized(MAX_FIELD_OF_STUDY_LENGTH),
    /**
     * The select holds '' while nothing is chosen, which the code rule already
     * reads as "you did not choose" - its minimum of one is what the enum this
     * replaced needed a preprocessing step to say.
     */
    level: educationLevel,
    location: optionalLocalized(MAX_LOCATION_LENGTH),
    startDate: yearMonth,
    /**
     * The input holds '' when empty, which is not a month; absent is what the
     * API means by "no end date", and what `checkPeriod` reads.
     */
    endDate: z.preprocess(
      (value) => (value === '' ? undefined : value),
      yearMonth.optional(),
    ),
    current: z.boolean(),
    description: optionalLocalized(MAX_DESCRIPTION_LENGTH),
  })
  .superRefine(checkPeriod);

/** What the API is sent. */
export type EducationInput = z.infer<typeof educationSchema>;

export type LocalizedValues = Record<string, string>;

/**
 * What the form holds. Declared rather than inferred, because preprocessing
 * types the schema's own input as `unknown`.
 */
export type EducationFormValues = {
  institution: LocalizedValues;
  qualification: LocalizedValues;
  fieldOfStudy: LocalizedValues;
  level: string;
  location: LocalizedValues;
  startDate: string;
  endDate: string;
  current: boolean;
  description: LocalizedValues;
};
