import { z } from 'zod';

import {
  MAX_BIO_LENGTH,
  MAX_HEADLINE_LENGTH,
  MAX_NAME_LENGTH,
  contactDetails,
  imageAlt,
  localizedDocument,
  localizedText,
  photoReference,
} from '@portfolio/shared';

export const profileSchema = z.object({
  firstName: localizedText(MAX_NAME_LENGTH),
  lastName: localizedText(MAX_NAME_LENGTH),
  headline: localizedText(MAX_HEADLINE_LENGTH),
  bio: localizedText(MAX_BIO_LENGTH).optional(),
  // The one photograph the site shows.
  photoUrl: photoReference.optional(),
  photoAlt: imageAlt.optional(),
  /**
   * The CV, one stored document per locale.
   *
   * Localized because a CV really differs by language, unlike a photograph.
   * Never an external URL: it is served from our own uploads with the headers
   * that make it a download rather than a document the browser renders.
   */
  resume: localizedDocument.optional(),
  /**
   * How to reach the person, and how much of it a stranger may see.
   *
   * Optional as a whole: a profile with no contact block is a normal profile,
   * and the inbox is a way to write to someone whether or not their address is
   * anywhere. The visibility flags inside it default to not published - see
   * `contactDetails`.
   */
  contact: contactDetails.optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
