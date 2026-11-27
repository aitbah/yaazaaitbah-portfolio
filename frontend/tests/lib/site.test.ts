import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  localeAlternates,
  openGraphAlternateLocales,
  openGraphLocale,
  siteUrl,
} from '../../src/lib/site';

// Derived rather than listed, so adding a language extends the alternates
// without touching this code. Two locales are enough to prove that.
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'ar'], defaultLocale: 'en' },
}));

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe('siteUrl', () => {
  it('uses the configured origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portfolio.example';

    expect(siteUrl()).toBe('https://portfolio.example');
  });

  // A trailing slash would produce '//en' in every canonical and sitemap entry.
  it('drops a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portfolio.example/';

    expect(siteUrl()).toBe('https://portfolio.example');
  });

  it('falls back to localhost so nothing breaks unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(siteUrl()).toBe('http://localhost:3000');
  });
});

describe('localeAlternates', () => {
  it('maps every configured locale to its own absolute URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portfolio.example';

    expect(localeAlternates()).toEqual({
      en: 'https://portfolio.example/en',
      ar: 'https://portfolio.example/ar',
      // The page for a reader none of the others match, which has to be the
      // locale every row is guaranteed to carry.
      'x-default': 'https://portfolio.example/en',
    });
  });

  it('keeps the path on every locale', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portfolio.example';

    expect(localeAlternates('/projects')).toEqual({
      en: 'https://portfolio.example/en/projects',
      ar: 'https://portfolio.example/ar/projects',
      'x-default': 'https://portfolio.example/en/projects',
    });
  });
});

/**
 * Open Graph treats a bare subtag as absent and falls back to `en_US`, so an
 * Arabic share card was announcing itself as English. There is no rule that
 * derives a territory from a language - only a convention per platform - so
 * this is a table, and what is asserted is that it *is* one.
 */
describe('openGraphLocale', () => {
  it('spells a locale the way Open Graph does', () => {
    expect(openGraphLocale('ar')).toBe('ar_AR');
    expect(openGraphLocale('fr')).toBe('fr_FR');
  });

  it('falls back to the subtag for a locale it does not know', () => {
    // No worse than the bare subtag this replaced, and it never renders blank.
    expect(openGraphLocale('zgh')).toBe('zgh');
  });

  it('offers the other configured locales as alternates', () => {
    expect(openGraphAlternateLocales('en')).toEqual(['ar_AR']);
    expect(openGraphAlternateLocales('ar')).toEqual(['en_US']);
  });
});
