import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_LOCALE } from '@portfolio/shared';
import { describe, expect, it } from 'vitest';

import { localeDirection, routing } from '../../src/i18n/routing';

const MESSAGES_DIR = join(import.meta.dirname, '..', '..', 'messages');

function namespaceFiles(locale: string) {
  return readdirSync(join(MESSAGES_DIR, locale)).filter((file) =>
    file.endsWith('.json'),
  );
}

function loadMessages(locale: string) {
  const merged: Record<string, unknown> = {};

  for (const file of namespaceFiles(locale)) {
    const contents = JSON.parse(
      readFileSync(join(MESSAGES_DIR, locale, file), 'utf8'),
    ) as Record<string, unknown>;

    Object.assign(merged, contents);
  }

  return merged;
}

function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];

  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n configuration', () => {
  /**
   * English is no longer the only locale, and the assertion that said so was
   * the first thing French broke. What has to stay true is narrower and more
   * useful: the default is the locale the *contract* requires, because that is
   * the key every unique index is built on and the text every other locale
   * falls back to. Two sources for that could disagree.
   */
  it('takes its default locale from the contract', () => {
    expect(routing.defaultLocale).toBe(DEFAULT_LOCALE);
    expect(routing.locales).toContain(DEFAULT_LOCALE);
  });

  it('prefixes every locale, including the default', () => {
    // `/en/...` stays a real URL rather than becoming a redirect the day a
    // second locale arrives - which is what makes adding one a non-event for
    // anything already linking into the site.
    expect(routing.localePrefix).toBe('always');
  });

  it('has a message folder for every configured locale', () => {
    for (const locale of routing.locales) {
      expect(statSync(join(MESSAGES_DIR, locale)).isDirectory()).toBe(true);
      expect(namespaceFiles(locale).length).toBeGreaterThan(0);
    }
  });

  // The loader merges by file, so a file must own the namespace it is named for.
  it('names every file after the namespace it contains', () => {
    for (const locale of routing.locales) {
      for (const file of namespaceFiles(locale)) {
        const contents = JSON.parse(
          readFileSync(join(MESSAGES_DIR, locale, file), 'utf8'),
        ) as Record<string, unknown>;

        expect(Object.keys(contents)).toEqual([file.replace('.json', '')]);
      }
    }
  });

  // Guards the architecture: a new locale must not silently ship missing keys.
  it('defines the same keys in every locale', () => {
    const expectedKeys = flatten(loadMessages(routing.defaultLocale)).sort();

    for (const locale of routing.locales) {
      expect(flatten(loadMessages(locale)).sort()).toEqual(expectedKeys);
    }
  });
});

/**
 * The UI is built entirely in logical properties, which resolve against the
 * document's direction. Getting this wrong does not fail loudly - it mirrors
 * the whole layout the wrong way while every word is correctly translated.
 */
describe('reading direction', () => {
  it('reads the launch locale left to right', () => {
    expect(localeDirection(routing.defaultLocale)).toBe('ltr');
  });

  it('reads a right-to-left language right to left', () => {
    // Arabic is the language the docs use throughout as the second locale.
    expect(localeDirection('ar')).toBe('rtl');
    expect(localeDirection('he')).toBe('rtl');
  });

  it('falls back to left to right for a language it does not know', () => {
    expect(localeDirection('fr')).toBe('ltr');
  });
});
