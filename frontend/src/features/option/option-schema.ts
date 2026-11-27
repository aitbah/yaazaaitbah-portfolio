import { z } from 'zod';

import {
  localizedText,
  notAllowed,
  optionCode,
  optionIcon,
  optionList,
  OPTION_LIST_SHAPES,
  MAX_OPTION_NAME_LENGTH,
  type OptionListKey,
  type OptionListShape,
} from '@portfolio/shared';
import { filledLocales } from '@/lib/localized-schema';

/** A select holds `''` and a cleared picker holds `null`; both mean absent. */
function blankIsAbsent<T extends z.ZodTypeAny>(rule: T) {
  return z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    rule,
  );
}

/**
 * The form's schema per list, as on the backend, so a field a list does not
 * have is refused here without a round trip. A blank select holds `''`, which
 * `optionCode` already refuses.
 */
export function optionSchema(list: OptionListKey) {
  // Widened from the literal, whose members do not all carry both keys.
  const shape: OptionListShape = OPTION_LIST_SHAPES[list];

  return z.object({
    list: optionList,
    code: optionCode,
    name: z.preprocess(filledLocales, localizedText(MAX_OPTION_NAME_LENGTH)),
    /**
     * Blank is "not set" on every list, since a select cannot hold `undefined`.
     * A real value on a list without that field still answers `NOT_ALLOWED`, as
     * the API does.
     */
    group: blankIsAbsent(shape.groupedBy ? optionCode.optional() : notAllowed),
    icon: blankIsAbsent(shape.icons ? optionIcon.optional() : notAllowed),
    order: z.number().int().min(0),
  });
}

/** What the API is sent. */
export type OptionInput = z.infer<ReturnType<typeof optionSchema>>;

export type LocalizedValues = Record<string, string>;

/**
 * What the form holds. Declared rather than inferred, because preprocessing
 * types the schema's own input as `unknown`.
 *
 * `code` is present even when editing, where it is shown and disabled: rows
 * point at it, so it cannot change once anything might.
 */
export type OptionFormValues = {
  list: OptionListKey;
  code: string;
  name: LocalizedValues;
  /**
   * Held on every list, blank where the list has none.
   *
   * Uniform on purpose: a select cannot hold `undefined` without React calling
   * it an uncontrolled input, and the schema reads a blank as absent - so a
   * form on a list with no heading sends nothing rather than sending `''` and
   * being told `NOT_ALLOWED` about a field it never rendered.
   */
  group: string;
  /** `null` rather than `undefined`: a controlled input cannot hold the latter. */
  icon: string | null;
  order: number;
};
