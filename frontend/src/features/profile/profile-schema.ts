import { z } from 'zod';

import {
  MAX_ALT_LENGTH,
  MAX_BIO_LENGTH,
  MAX_HEADLINE_LENGTH,
  MAX_LOCATION_TEXT_LENGTH,
  MAX_NAME_LENGTH,
  availabilityStatus,
  localizedText,
  localizedDocument,
  photoReference,
} from '@portfolio/shared';
import {
  filledLocales,
  isEmpty,
  optionalLocalized,
} from '@/lib/localized-schema';

/** Dropping a blank `en` leaves it missing, which reports on `field.en`. */
function requiredLocalizedText(maxLength: number) {
  return z.preprocess(filledLocales, localizedText(maxLength));
}

/**
 * An image field holds '' when nothing is chosen, which is not a reference.
 * Dropped rather than sent, so PUT clears the stored one.
 */
function optionalReference() {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || undefined : value),
    photoReference.optional(),
  );
}

/**
 * The CV, one stored path per locale. A locale with no file holds '' in the
 * form; dropped here, so PUT clears what is no longer pointed at.
 */
function optionalResume() {
  return z.preprocess((value) => {
    const kept = filledLocales(value);

    return isEmpty(kept) ? undefined : kept;
  }, localizedDocument.optional());
}

/**
 * The contact block as the form holds it.
 *
 * Each value is optional and each flag is not: a checkbox always has an answer,
 * and the answer is what decides whether the value beside it is published.
 * Blank values are dropped rather than sent, so clearing one clears it.
 */
const contactValues = z.object({
  email: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || undefined : value),
    z.email().optional(),
  ),
  emailPublic: z.boolean(),
  location: optionalLocalized(MAX_LOCATION_TEXT_LENGTH),
  locationPublic: z.boolean(),
  availability: z.preprocess(
    (value) => (typeof value === 'string' ? value || undefined : value),
    availabilityStatus.optional(),
  ),
  availabilityPublic: z.boolean(),
});

/** True once the block holds anything a flag could be about. */
function hasContactValue(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const contact = value as Record<string, unknown>;
  const location = filledLocales(contact.location);

  return (
    (typeof contact.email === 'string' && contact.email.trim().length > 0) ||
    !isEmpty(location) ||
    (typeof contact.availability === 'string' &&
      contact.availability.length > 0)
  );
}

/**
 * The whole block goes when it holds no value at all.
 *
 * Three flags about nothing are not a choice worth persisting, and sending them
 * would leave every profile carrying a contact block whose only content is
 * "none of this is published". The form rebuilds the defaults from the same
 * contract next time it opens.
 */
const contactSchema = z.preprocess(
  (value) => (hasContactValue(value) ? value : undefined),
  contactValues.optional(),
);

export const profileSchema = z.object({
  firstName: requiredLocalizedText(MAX_NAME_LENGTH),
  lastName: requiredLocalizedText(MAX_NAME_LENGTH),
  headline: requiredLocalizedText(MAX_HEADLINE_LENGTH),
  bio: optionalLocalized(MAX_BIO_LENGTH),
  photoUrl: optionalReference(),
  photoAlt: optionalLocalized(MAX_ALT_LENGTH),
  resume: optionalResume(),
  contact: contactSchema,
});

/** What the API is sent. */
export type ProfileInput = z.infer<typeof profileSchema>;

export type LocalizedValues = Record<string, string>;

/**
 * What the form holds: every locale input exists and is a string, blank or not.
 * Declared rather than inferred, because the preprocessing above types the
 * schema's own input as `unknown`.
 */
export type ProfileFormValues = {
  firstName: LocalizedValues;
  lastName: LocalizedValues;
  headline: LocalizedValues;
  bio: LocalizedValues;
  /** The avatar: a square portrait, shown small beside a name. */
  photoUrl: string;
  photoAlt: LocalizedValues;
  /** The CV, one stored path per locale; '' where there is none. */
  resume: LocalizedValues;
  /** How to reach the person, and how much of it a stranger may see. */
  contact: {
    email: string;
    emailPublic: boolean;
    location: LocalizedValues;
    locationPublic: boolean;
    /** '' until a status is chosen, so the select starts controlled. */
    availability: string;
    availabilityPublic: boolean;
  };
};
