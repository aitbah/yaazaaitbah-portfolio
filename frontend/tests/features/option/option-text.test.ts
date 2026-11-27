import { describe, expect, it } from 'vitest';

import type { Option } from '../../../src/features/option/option-api';
import { optionText } from '../../../src/features/option/option-text';

function option(partial: Partial<Option>): Option {
  return {
    id: 'x',
    list: 'employment-type',
    code: 'full-time',
    name: { en: 'Full time' },
    order: 0,
    updatedAt: '',
    ...partial,
  };
}

describe('reading a stored code back', () => {
  const options = [
    option({ code: 'full-time', name: { en: 'Full time', fr: 'Temps plein' } }),
    option({
      list: 'education-level',
      code: 'masters',
      name: { en: "Master's" },
    }),
  ];

  it('answers with the words the owner gave it', () => {
    expect(optionText(options, 'en')('employment-type', 'full-time')).toBe(
      'Full time',
    );
  });

  it('answers in the reader’s language', () => {
    expect(optionText(options, 'fr')('employment-type', 'full-time')).toBe(
      'Temps plein',
    );
  });

  it('falls back to the default locale for one not translated yet', () => {
    expect(optionText(options, 'fr')('education-level', 'masters')).toBe(
      "Master's",
    );
  });

  /**
   * Codes really do repeat across lists - `other`, `design`, `security`,
   * `testing` and five more are each in two or three of them today - so the
   * list is half the question and looking a code up on its own is wrong.
   */
  it('does not confuse two lists that share a code', () => {
    expect(optionText(options, 'en')('education-level', 'full-time')).toBe(
      'full-time',
    );
  });

  it('falls back to the code itself when the row is gone', () => {
    expect(optionText(options, 'en')('employment-type', 'freelance')).toBe(
      'freelance',
    );
  });
});
