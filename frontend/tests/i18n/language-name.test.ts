import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES } from '@portfolio/shared';

import { languageName } from '../../src/i18n/language-name';

/**
 * The entity stores a subtag and no name, so the name has to come from
 * somewhere at render time. These pin what "somewhere" produces.
 */
describe('languageName', () => {
  it('names a language in the reader’s own locale', () => {
    expect(languageName('de', 'en')).toBe('German');
    expect(languageName('de', 'fr')).toBe('allemand');
  });

  /**
   * The whole reason there is no stored name: a stored English "German" would
   * be wrong on every page written in another language.
   */
  it('gives a different name to a different reader', () => {
    expect(languageName('en', 'fr')).not.toBe(languageName('en', 'en'));
  });

  /**
   * A subtag with no name would render as the subtag - "zgh" in a list of
   * languages, which reads as a bug and is invisible until someone adds that
   * code. Every code the picker offers must actually name something.
   */
  it('names every code the contract offers', () => {
    for (const code of LANGUAGE_CODES) {
      const name = languageName(code, 'en');

      expect(name, `${code} has no name`).not.toBe(code);
      expect(name.length).toBeGreaterThan(1);
    }
  });

  /** Including the three-letter one, which is why the list is not ISO 639-1. */
  it('names Standard Moroccan Tamazight, which has no two-letter subtag', () => {
    expect(languageName('zgh', 'en')).toBe('Standard Moroccan Tamazight');
  });

  // The contract's enum keeps one from being stored; this is the fallback.
  it('falls back to the code itself for something it cannot name', () => {
    expect(languageName('qq', 'en')).toBe('qq');
  });
});
