import { routing } from '@/i18n/routing';

const FALLBACK = 'http://localhost:3000';

/**
 * The site's own public origin, needed for absolute URLs in metadata, the
 * sitemap and Open Graph tags - relative ones are not valid there.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK).replace(/\/$/, '');
}

/**
 * Every configured locale's URL, for `hreflang`. `x-default` is the default
 * locale, the only one guaranteed complete.
 */
export function localeAlternates(path = ''): Record<string, string> {
  return {
    ...Object.fromEntries(
      routing.locales.map((locale) => [
        locale,
        `${siteUrl()}/${locale}${path}`,
      ]),
    ),
    'x-default': `${siteUrl()}/${routing.defaultLocale}${path}`,
  };
}

/**
 * Open Graph's spelling of a locale, `language_TERRITORY`; a bare subtag reads
 * as `en_US`. A lookup, since territories are per-platform conventions (`ar_AR`
 * is Facebook's). Unknown locales fall back to their subtag.
 */
const OPEN_GRAPH_LOCALES: Record<string, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  ar: 'ar_AR',
};

export function openGraphLocale(locale: string): string {
  return OPEN_GRAPH_LOCALES[locale] ?? locale;
}

/** The other locales a share card can offer, in Open Graph's spelling. */
export function openGraphAlternateLocales(locale: string): string[] {
  return routing.locales
    .filter((candidate) => candidate !== locale)
    .map(openGraphLocale);
}
