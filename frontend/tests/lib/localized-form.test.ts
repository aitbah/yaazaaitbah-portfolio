import { describe, expect, it } from 'vitest';

import { localesWithErrors } from '../../src/lib/localized-form';

/** What React Hook Form puts at a leaf. */
const invalid = { type: 'REQUIRED', message: 'This field is required.' };

describe('the languages a form is refusing to save', () => {
  it('finds none in a form with no errors', () => {
    expect(localesWithErrors({})).toEqual(new Set());
  });

  it('finds the language a field is invalid in', () => {
    expect(localesWithErrors({ bio: { fr: invalid } })).toEqual(
      new Set(['fr']),
    );
  });

  it('finds every language, across every field', () => {
    const errors = {
      firstName: { en: invalid },
      bio: { fr: invalid },
    };

    expect(localesWithErrors(errors)).toEqual(new Set(['en', 'fr']));
  });

  /**
   * Errors nest as deeply as the values do. A gallery caption is
   * `gallery.0.caption.fr`, which is why this walks rather than reading the
   * paths it happens to know about today.
   */
  it('finds one nested under a list', () => {
    const errors = { gallery: [{ caption: { fr: invalid } }] };

    expect(localesWithErrors(errors)).toEqual(new Set(['fr']));
  });

  // The field as a whole is invalid, not one of its translations. There is no
  // language to send the admin to.
  it('ignores an error that is not on a language', () => {
    expect(localesWithErrors({ slug: invalid })).toEqual(new Set());
  });

  // A language the site no longer ships still has stored values, and an error
  // on one is not something any control on screen could show.
  it('ignores a language that is not configured', () => {
    expect(localesWithErrors({ bio: { de: invalid } })).toEqual(new Set());
  });

  /**
   * An error is a leaf. It carries a `ref` to the input it came from, and that
   * is a DOM node - walking into one would be reading the document instead of
   * the errors, and would find whatever happened to be named like a language.
   */
  it('does not walk into what an error points at', () => {
    const errors = {
      slug: { ...invalid, ref: { fr: invalid } },
    };

    expect(localesWithErrors(errors)).toEqual(new Set());
  });
});
