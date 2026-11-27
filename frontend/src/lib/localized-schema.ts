import { z } from 'zod';

import { localizedText } from '@portfolio/shared';

/**
 * A locale the admin left blank means "not translated yet", never an empty
 * string: the form renders an input per configured locale, so blanks are
 * dropped here rather than sent and rejected.
 *
 * Seven form schemas had a byte-identical private copy of this.
 */
export function filledLocales(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([, text]) => typeof text === 'string' && text.trim().length > 0,
    ),
  );
}

/** An object with no keys left - every locale was blank. */
export function isEmpty(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length === 0
  );
}

/**
 * Localized text that may be left out entirely.
 *
 * Dropping the blank locales can empty the object, and an empty object is not
 * "no translations" - it is a field the reader did not fill in at all, which
 * `PUT` has to clear rather than store.
 */
export function optionalLocalized(maxLength: number) {
  return z.preprocess((value) => {
    const kept = filledLocales(value);

    // `null` as well as `{}`: the five schemas this replaces were split between
    // two spellings of the same idea, one of which mapped a null to absent and
    // one of which passed it through to fail validation. Absent is the right
    // answer for a field that is optional in the first place.
    return kept === null || isEmpty(kept) ? undefined : kept;
  }, localizedText(maxLength).optional());
}
