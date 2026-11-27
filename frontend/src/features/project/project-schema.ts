import { z } from 'zod';

import {
  documentId,
  externalUrl,
  gallery,
  localizedText,
  photoReference,
  projectOrder,
  slug,
  MAX_ALT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_PROJECT_NARRATIVE_LENGTH,
  MAX_PROJECT_ROLE_LENGTH,
  MAX_TITLE_LENGTH,
} from '@portfolio/shared';
import { filledLocales, optionalLocalized } from '@/lib/localized-schema';

/** A cleared text input is absence, which `PUT` then clears on the document. */
function blankToAbsent(value: unknown) {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

/** With every locale blank the field is absent, which PUT then clears. */
export const projectSchema = z.object({
  slug,
  title: z.preprocess(filledLocales, localizedText(MAX_TITLE_LENGTH)),
  description: z.preprocess(
    filledLocales,
    localizedText(MAX_DESCRIPTION_LENGTH),
  ),
  stack: z.array(documentId).default([]),
  imageUrl: z.preprocess(blankToAbsent, photoReference.optional()),
  imageAlt: optionalLocalized(MAX_ALT_LENGTH),
  /**
   * Position in the array is the display order, so reordering is submitting the
   * same entries in a different sequence. Each entry's alt is dropped when
   * every locale is blank, exactly as a top-level optional field is.
   */
  gallery: z
    .array(
      z.object({
        url: photoReference,
        alt: optionalLocalized(MAX_ALT_LENGTH),
      }),
    )
    .pipe(gallery),
  // Why it was hard, rather than what it is. Each is dropped when every locale
  // is blank, so a project the owner has not written up yet sends nothing
  // rather than four empty objects.
  role: optionalLocalized(MAX_PROJECT_ROLE_LENGTH),
  problem: optionalLocalized(MAX_PROJECT_NARRATIVE_LENGTH),
  approach: optionalLocalized(MAX_PROJECT_NARRATIVE_LENGTH),
  outcome: optionalLocalized(MAX_PROJECT_NARRATIVE_LENGTH),
  repoUrl: z.preprocess(blankToAbsent, externalUrl.optional()),
  liveUrl: z.preprocess(blankToAbsent, externalUrl.optional()),
  featured: z.boolean(),
  order: projectOrder,
});

/** What the API is sent. */
export type ProjectInput = z.infer<typeof projectSchema>;

export type LocalizedValues = Record<string, string>;

/** One gallery entry as the form holds it: every alt locale exists as a string. */
export type GalleryFormValue = {
  url: string;
  alt: LocalizedValues;
};

/**
 * What the form holds: every input exists and is a string, blank or not.
 * Declared rather than inferred, because the preprocessing above types the
 * schema's own input as `unknown`.
 */
export type ProjectFormValues = {
  slug: string;
  title: LocalizedValues;
  description: LocalizedValues;
  stack: string[];
  imageUrl: string;
  imageAlt: LocalizedValues;
  gallery: GalleryFormValue[];
  role: LocalizedValues;
  problem: LocalizedValues;
  approach: LocalizedValues;
  outcome: LocalizedValues;
  repoUrl: string;
  liveUrl: string;
  featured: boolean;
  order: number;
};
