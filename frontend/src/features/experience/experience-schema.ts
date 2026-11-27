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
import { filledLocales, optionalLocalized } from '@/lib/localized-schema';

/**
 * The form's schema. Every rule comes from the shared package, including the
 * one that relates the three date fields - so the admin is told about a period
 * that contradicts itself before a request is made, by the same rule the server
 * would have used.
 */
export const experienceSchema = z
  .object({
    role: z.preprocess(filledLocales, localizedText(MAX_ROLE_LENGTH)),
    organisation: z.preprocess(
      filledLocales,
      localizedText(MAX_ORGANISATION_LENGTH),
    ),
    location: optionalLocalized(MAX_LOCATION_LENGTH),
    /**
     * The select holds '' while nothing is chosen, which the code rule already
     * reads as "you did not choose" - its minimum of one is what the enum this
     * replaced needed a preprocessing step to say.
     */
    employmentType,
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
export type ExperienceInput = z.infer<typeof experienceSchema>;

export type LocalizedValues = Record<string, string>;

/**
 * What the form holds. Declared rather than inferred, because preprocessing
 * types the schema's own input as `unknown`.
 *
 * Both months are plain strings while empty, and `employmentType` is a code
 * the option list offers - a plain string here, checked there.
 */
export type ExperienceFormValues = {
  role: LocalizedValues;
  organisation: LocalizedValues;
  location: LocalizedValues;
  employmentType: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: LocalizedValues;
};
