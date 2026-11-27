import { DEFAULT_LOCALE } from '@portfolio/shared';
import { describe, expect, it } from 'vitest';

import {
  type SeedText,
  SEED_CREDENTIALS,
  SEED_EDUCATION,
  SEED_EXPERIENCE,
  SEED_PROFILE,
  SEED_PROJECTS,
  SEED_SKILLS,
  SEED_TECHNOLOGIES,
  SEED_TOOLS,
} from '../../src/seed/seed-data.js';

/**
 * The locales a translated seed value carries, taken from the shape of
 * `SeedText` itself rather than listed here - so widening the type is what
 * makes these tests demand the translation, instead of somebody remembering
 * to widen an array as well.
 */
const TRANSLATED_LOCALES = [
  DEFAULT_LOCALE,
  'fr',
  'ar',
] as const satisfies readonly (keyof Exclude<SeedText, string>)[];

/** Every localized value in the file, with a name to fail by. */
function localizedValues(): [string, SeedText][] {
  const found: [string, SeedText][] = [];

  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      return;
    }

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        walk(item, `${path}[${index}]`);
      }

      return;
    }

    if (typeof value !== 'object' || value === null) {
      return;
    }

    const record = value as Record<string, unknown>;

    // A localized map is exactly the thing with a default-locale string in it.
    if (typeof record[DEFAULT_LOCALE] === 'string') {
      found.push([path, record as unknown as SeedText]);

      return;
    }

    for (const [key, child] of Object.entries(record)) {
      walk(child, path ? `${path}.${key}` : key);
    }
  };

  walk(
    {
      SEED_PROFILE,
      SEED_SKILLS,
      SEED_TECHNOLOGIES,
      SEED_TOOLS,
      SEED_PROJECTS,
      SEED_EXPERIENCE,
      SEED_EDUCATION,
      SEED_CREDENTIALS,
    },
    '',
  );

  return found;
}

/**
 * Most of this file is the default locale alone, and that is deliberate: a
 * fresh install that arrived fully translated would demonstrate the wrong half
 * of the model, and the fallback is the half that makes adding a language
 * cheap. Proper nouns - TypeScript, GitHub, Le Wagon - are not translated into
 * any language, French included.
 *
 * So the rule is not "everything is translated". It is that **a value which is
 * translated at all is translated into every locale the seeder ships**, and a
 * value carrying two of the three is the shape of a language half-added. That
 * is what this holds, and it is the check that did not exist when Arabic was
 * added - `ar` went into the type and nothing would have noticed a row that
 * never got one.
 */
describe('the seed content', () => {
  it('finds the localized values to check', () => {
    // A walker that silently matched nothing would pass every test below.
    expect(localizedValues().length).toBeGreaterThan(15);
  });

  it.each(TRANSLATED_LOCALES)(
    'has %s wherever anything is translated',
    (locale) => {
      const partial = localizedValues().filter(([, value]) => {
        if (typeof value === 'string') {
          return false;
        }

        const locales = Object.keys(value);

        // Default-locale only is a decision; two out of three is an oversight.
        return locales.length > 1 && !locales.includes(locale);
      });

      expect(partial.map(([path]) => path)).toEqual([]);
    },
  );

  it('never leaves a translated value blank', () => {
    for (const [path, value] of localizedValues()) {
      if (typeof value === 'string') {
        continue;
      }

      for (const [locale, text] of Object.entries(value)) {
        expect(text.trim(), `${path}.${locale} is blank`).toBeTruthy();
      }
    }
  });

  /**
   * The CV is the one localized field whose value is a list of lines rather
   * than a sentence, and it is generated into a PDF drawn with the standard
   * fourteen fonts - which carry no Arabic glyphs. Its Arabic entry is
   * deliberately Latin script, so it is checked for existence and not for
   * language.
   */
  it('writes a CV for every locale the profile names', () => {
    expect(Object.keys(SEED_PROFILE.resume).sort()).toEqual(
      [...TRANSLATED_LOCALES].sort(),
    );

    for (const [locale, lines] of Object.entries(SEED_PROFILE.resume)) {
      expect(lines.length, `${locale} has no lines`).toBeGreaterThan(0);
    }
  });
});
