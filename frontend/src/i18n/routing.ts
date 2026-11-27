import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE } from '@portfolio/shared';

/**
 * The locales the site offers. Adding one is its code here plus a
 * `messages/<code>/` folder; `locale-parity.test.ts` refuses the first without
 * the second. The default comes from the shared contract, since indexes are
 * built on it.
 */
export const routing = defineRouting({
  locales: [DEFAULT_LOCALE, 'fr', 'ar'],
  defaultLocale: DEFAULT_LOCALE,
  // Keep the prefix on every URL so `/en/...` stays stable when locales are added.
  localePrefix: 'always',
});

/**
 * The languages written right to left, of those a portfolio might plausibly
 * add. A property of the language, not a project decision - so it is a lookup
 * rather than something to configure.
 */
const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);

/**
 * Which way a locale reads. Every logical property resolves against `<html
 * dir>`; Radix needs `DirectionProvider` as well. `FRONTEND-RULES.md` lists
 * what logical properties could not reach.
 */
export function localeDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}
