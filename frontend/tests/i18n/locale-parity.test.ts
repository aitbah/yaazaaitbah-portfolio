import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  parse,
  TYPE,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import { routing } from '../../src/i18n/routing';

const MESSAGES_DIR = join(import.meta.dirname, '..', '..', 'messages');

const { defaultLocale } = routing;
const OTHER_LOCALES = routing.locales.filter(
  (locale) => locale !== defaultLocale,
);

function namespaceFiles(locale: string): string[] {
  return readdirSync(join(MESSAGES_DIR, locale))
    .filter((file) => file.endsWith('.json'))
    .sort();
}

function load(locale: string, file: string): unknown {
  return JSON.parse(
    readFileSync(join(MESSAGES_DIR, locale, file), 'utf8'),
  ) as unknown;
}

/** Every leaf, by its full dotted path - the unit a translation is missing in. */
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function messages(locale: string, file: string): Map<string, string> {
  const found = new Map<string, string>();

  const walk = (value: unknown, prefix: string) => {
    if (typeof value === 'string') {
      found.set(prefix, value);

      return;
    }

    if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        walk(child, prefix ? `${prefix}.${key}` : key);
      }
    }
  };

  walk(load(locale, file), '');

  return found;
}

/**
 * The named arguments a message expects - `{name}`, and the `count` a plural
 * chooses on.
 *
 * A translation that drops one does not fail: it renders a sentence with a hole
 * where the name should be, on a screen nobody reads in that language until
 * somebody does.
 *
 * Parsed rather than matched with a regular expression. The first version of
 * this read `{Nothing}` - a plural branch's own text - as an argument called
 * `Nothing`, and reported the French translation as wrong for having translated
 * it. ICU nests, so only a parser knows which braces name an argument.
 */
function argumentsOf(message: string): string[] {
  const found = new Set<string>();

  const visit = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (element.type !== TYPE.literal && element.type !== TYPE.pound) {
        found.add(element.value);
      }

      if (element.type === TYPE.plural || element.type === TYPE.select) {
        for (const option of Object.values(element.options)) {
          visit(option.value);
        }
      }

      if (element.type === TYPE.tag) {
        visit(element.children);
      }
    }
  };

  visit(parse(message));

  return [...found].sort();
}

/**
 * `routing.ts` says adding a language is "add its code here + a `messages/<code>/`
 * folder holding the same namespace files". Until French arrived, nothing
 * checked the second half - and the failure it prevents is the quiet kind: a
 * missing key renders as its own dotted path, in a language the person who
 * added it does not read.
 *
 * Derived from the default locale rather than from a list, so a namespace or a
 * key added to English is immediately something French is missing.
 */
describe.each(OTHER_LOCALES)('the %s messages', (locale) => {
  it('holds the same namespace files as the default locale', () => {
    expect(namespaceFiles(locale)).toEqual(namespaceFiles(defaultLocale));
  });

  it.each(namespaceFiles(defaultLocale))(
    'translates every key in %s',
    (file) => {
      const expected = paths(load(defaultLocale, file)).sort();
      const actual = paths(load(locale, file)).sort();

      // Both directions: a key the default has lost is dead copy that will be
      // translated forever, and one it never had renders nowhere.
      expect(actual).toEqual(expected);
    },
  );

  it.each(namespaceFiles(defaultLocale))(
    'keeps every placeholder in %s',
    (file) => {
      const source = messages(defaultLocale, file);
      const translated = messages(locale, file);

      for (const [path, message] of source) {
        expect(
          argumentsOf(translated.get(path) ?? ''),
          `${path} does not take the same arguments`,
        ).toEqual(argumentsOf(message));
      }
    },
  );

  /**
   * Not a translation check - a copy-the-folder check. A locale added by
   * copying the default's files and never translating them passes every other
   * test here, and is visible without reading a word of the language.
   *
   * Across the whole locale rather than per file: proper nouns, product names
   * and one-word labels legitimately match - "GitHub" is "GitHub" everywhere -
   * and a two-key file holding a person's name is half identical by nature.
   */
  it('is not the default locale copied across', () => {
    let total = 0;
    let identical = 0;

    for (const file of namespaceFiles(defaultLocale)) {
      const source = messages(defaultLocale, file);
      const translated = messages(locale, file);

      total += source.size;
      identical += [...source].filter(
        ([path, message]) => translated.get(path) === message,
      ).length;
    }

    expect(identical / total).toBeLessThan(0.5);
  });
});
