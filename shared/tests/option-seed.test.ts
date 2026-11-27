import { describe, expect, it } from 'vitest';
import {
  optionCode,
  optionIcon,
  OPTION_LISTS,
  OPTION_LIST_SHAPES,
  type OptionListKey,
  type OptionListShape,
} from '../src/option-lists.js';
import { DEFAULT_LOCALE } from '../src/validation-rules.js';
import { SEED_OPTIONS, type SeedOption } from '../src/option-seed.data.js';

/**
 * The seed is the only definition of these lists a fresh install ever gets, and
 * it is also where 122 codes and 244 labels landed after being lifted out of
 * the message files. A mistake in it is a dropdown that is empty, mislabelled,
 * or missing a code that stored rows already hold.
 */
/**
 * The locales every seeded label carries, taken from the shape of the label
 * itself - so adding one to `SeedOption` is what makes these tests demand it,
 * rather than somebody remembering to widen an array down here.
 */
const SEEDED_LOCALES = [
  DEFAULT_LOCALE,
  'fr',
  'ar',
] as const satisfies readonly (keyof SeedOption['name'])[];

describe('the seeded option lists', () => {
  it('seeds every declared list', () => {
    expect(Object.keys(SEED_OPTIONS).sort()).toEqual([...OPTION_LISTS].sort());
  });

  it.each(OPTION_LISTS)('gives %s at least one option', (list) => {
    expect(SEED_OPTIONS[list].length).toBeGreaterThan(0);
  });

  it.each(OPTION_LISTS)('gives every %s option a valid code', (list) => {
    for (const option of SEED_OPTIONS[list]) {
      expect(optionCode.safeParse(option.code).success).toBe(true);
    }
  });

  it.each(OPTION_LISTS)('gives no two %s options the same code', (list) => {
    const codes = SEED_OPTIONS[list].map((option) => option.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  /**
   * A unique index covers the default-locale name, so two options spelled alike
   * would not merely look wrong - the second would fail to insert, and the
   * seeder would leave the list short with nothing said.
   */
  it.each(OPTION_LISTS)('gives no two %s options the same name', (list) => {
    for (const locale of SEEDED_LOCALES) {
      const names = SEED_OPTIONS[list].map((option) => option.name[locale]);

      expect(new Set(names).size).toBe(names.length);
    }
  });

  /**
   * Every locale, because these labels were translations before they were rows.
   * A missing one falls back to English silently - which is the right runtime
   * behaviour and the wrong thing to ship.
   *
   * Driven by `SEEDED_LOCALES` rather than by a pair spelled out here, which is
   * what this was until Arabic arrived: the list said `['en', 'fr']`, Arabic
   * was added to the type, and nothing in the suite would have noticed a label
   * that never got one.
   */
  it.each(OPTION_LISTS)('labels every %s option in every locale', (list) => {
    for (const option of SEED_OPTIONS[list]) {
      for (const locale of SEEDED_LOCALES) {
        expect(option.name[locale]?.trim()).toBeTruthy();
      }
    }
  });

  it.each(OPTION_LISTS)('gives %s only what its shape allows', (list) => {
    const shape: OptionListShape = OPTION_LIST_SHAPES[list];

    for (const option of SEED_OPTIONS[list]) {
      if (!shape.groupedBy) {
        expect(option.group).toBeUndefined();
      }

      if (!shape.icons) {
        expect(option.icon).toBeUndefined();
      }
    }
  });

  it('files every grouped option under a heading that is seeded', () => {
    for (const list of OPTION_LISTS) {
      const shape: OptionListShape = OPTION_LIST_SHAPES[list];

      if (!shape.groupedBy) {
        continue;
      }

      const headings = new Set(
        SEED_OPTIONS[shape.groupedBy].map((option) => option.code),
      );

      for (const option of SEED_OPTIONS[list]) {
        // Ungrouped is allowed; grouped under something that does not exist is
        // an option the picker cannot draw a title for.
        if (option.group !== undefined) {
          expect(headings).toContain(option.group);
        }
      }
    }
  });

  it('gives every mark a slug with a drawing behind it', () => {
    for (const list of OPTION_LISTS) {
      for (const option of SEED_OPTIONS[list]) {
        if (option.icon !== undefined) {
          expect(optionIcon.safeParse(option.icon).success).toBe(true);
        }
      }
    }
  });
});

/**
 * Codes are a contract with stored rows, not a list of what looks tidy today.
 *
 * This guarantee used to live in `shared`, where the codes were frozen arrays.
 * It matters more now, not less: the owner may delete an option from the admin,
 * and the service refuses that while a row holds it - but the *seed* is not
 * protected by anything, and a code quietly dropped from it is a code a fresh
 * install no longer has while an existing database still does.
 *
 * These are the codes that have shipped. Adding is free; this is what makes
 * removing deliberate.
 */
describe('no shipped code is ever removed from the seed', () => {
  const SHIPPED: Partial<Record<OptionListKey, readonly string[]>> = {
    'skill-category': [
      'engineering',
      'architecture',
      'data',
      'product',
      'collaboration',
      'other',
    ],
    'technology-category': [
      'language',
      'frontend',
      'backend',
      'database',
      'mobile',
      'infrastructure',
      'other',
    ],
    'tool-category': [
      'editor',
      'versioning',
      'devops',
      'testing',
      'design',
      'productivity',
      'other',
    ],
    'employment-type': [
      'full-time',
      'part-time',
      'contract',
      'freelance',
      'internship',
      'apprenticeship',
      'volunteer',
    ],
    'education-level': [
      'secondary',
      'bachelor',
      'master',
      'doctorate',
      'other',
    ],
    'language-level': ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'],
    'availability-status': ['open-to-work', 'not-looking'],
    'social-platform': [
      'github',
      'linkedin',
      'x',
      'mastodon',
      'bluesky',
      'youtube',
      'instagram',
      'website',
      'other',
    ],
    'social-platform-group': ['code', 'social', 'elsewhere'],
  };

  it.each(Object.entries(SHIPPED))(
    'keeps every %s that has shipped',
    (list, shipped) => {
      const codes = SEED_OPTIONS[list as OptionListKey].map(
        (option) => option.code,
      );

      for (const code of shipped ?? []) {
        expect(codes).toContain(code);
      }
    },
  );
});
