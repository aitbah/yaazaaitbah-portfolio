import { routing } from './routing';

/** Locale-keyed text, as every entity returns it. */
export type LocalizedValues = Record<string, string> | undefined;

/**
 * A localized value in the reader's locale, falling back to the default - which
 * is what lets a language be added before anything is translated. A blank
 * counts as absent.
 */
export function localizedValue(
  values: LocalizedValues,
  locale: string,
): string {
  return values?.[locale]?.trim() || values?.[routing.defaultLocale] || '';
}
