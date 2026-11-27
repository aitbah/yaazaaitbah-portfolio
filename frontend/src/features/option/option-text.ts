import type { OptionListKey } from '@portfolio/shared';

import { localizedValue } from '@/i18n/localized-value';

import type { Option } from './option-api';

/** Reads one stored code back as the words the owner gave it. */
export type OptionText = (list: OptionListKey, code: string) => string;

/**
 * Turns stored codes into labels in the reader's language, through an index
 * rather than a scan per lookup. A code with no row falls back to itself, so a
 * deleted option shows up rather than leaving a blank.
 */
export function optionText(options: Option[], locale: string): OptionText {
  const find = optionIndex(options);

  return (list, code) => localizedValue(find(list, code)?.name, locale) || code;
}

/** The whole row, for the callers that want more than its name - its logo. */
export function optionIndex(
  options: Option[],
): (list: OptionListKey, code: string) => Option | undefined {
  const byCode = new Map(
    options.map((option) => [`${option.list}/${option.code}`, option]),
  );

  return (list, code) => byCode.get(`${list}/${code}`);
}
