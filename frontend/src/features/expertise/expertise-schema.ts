import { z } from 'zod';

import {
  expertiseCategory,
  expertiseIcon,
  expertiseLevel,
  expertiseOrder,
  localizedText,
  notAllowed,
  KIND_HAS_ICON,
  MAX_EXPERTISE_NAME_LENGTH,
  type ExpertiseKind,
} from '@portfolio/shared';
import { filledLocales } from '@/lib/localized-schema';

/**
 * The form's schema, per kind - the same split the backend makes, so a skill
 * with a technology's category is refused on this side too rather than making
 * a round trip to be told.
 */
export function expertiseSchema(kind: ExpertiseKind) {
  return z.object({
    /** Dropping a blank `en` leaves it missing, which reports on `name.en`. */
    name: z.preprocess(filledLocales, localizedText(MAX_EXPERTISE_NAME_LENGTH)),
    /**
     * The select holds '' while nothing is chosen, which the code rule's
     * minimum of one already refuses. Whether the category belongs to this kind
     * is checked by the service, which sees the option lists.
     */
    category: expertiseCategory,
    level: expertiseLevel,
    /**
     * The form holds `null` for "no logo", because a controlled input cannot
     * hold `undefined` without React complaining about it becoming
     * uncontrolled. The API's absent field is the same thing, so null becomes
     * undefined here - which is also what lets a skill, whose shape has no
     * logo at all, share one set of form values with the other two.
     */
    icon: z.preprocess(
      (value) => value ?? undefined,
      KIND_HAS_ICON[kind] ? expertiseIcon.optional() : notAllowed,
    ),
    order: expertiseOrder,
  });
}

/** What the API is sent. */
export type ExpertiseInput = z.infer<ReturnType<typeof expertiseSchema>>;

export type LocalizedValues = Record<string, string>;

/** A chosen logo: a vendored preset by name, or one of our own uploads. */
export type ExpertiseIconValue = {
  kind: 'preset' | 'upload';
  value: string;
};

/**
 * What the form holds. Declared rather than inferred, because preprocessing
 * types the schema's own input as `unknown`.
 *
 * `category` is a code the kind's own option list offers - a plain string
 * here, checked there. `icon` is present for every kind and stays `null` for a
 * skill, whose form renders no picker.
 */
export type ExpertiseFormValues = {
  name: LocalizedValues;
  category: string;
  level: number;
  /** `null` rather than `undefined`: see the schema's note above. */
  icon: ExpertiseIconValue | null;
  order: number;
};
