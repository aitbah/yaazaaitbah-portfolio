import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  optionCode,
  optionIcon,
  optionList,
  optionOrder,
  MAX_OPTION_CODE_LENGTH,
  OPTION_LISTS,
  OPTION_LIST_SHAPES,
  type OptionListShape,
} from '../src/option-lists.js';

/**
 * The registry is the one place a managed list is declared, so a mistake here
 * is a dropdown that cannot be edited or one that groups under headings nobody
 * can write. TypeScript catches a missing entry; these catch the rest.
 */
describe('optionCode', () => {
  it.each(['github', 'full-time', 'ci-cd', 'a1', 'other', 'web3'])(
    'accepts %s',
    (code) => {
      expect(optionCode.safeParse(code).success).toBe(true);
    },
  );

  it.each([
    ['', 'the blank a fresh select holds'],
    ['Frontend', 'an uppercase letter'],
    ['full time', 'a space'],
    ['full_time', 'an underscore'],
    ['-leading', 'a leading dash'],
    ['trailing-', 'a trailing dash'],
    ['double--dash', 'a doubled dash'],
    ['café', 'an accent'],
  ])('rejects %j - %s', (code) => {
    expect(optionCode.safeParse(code).success).toBe(false);
  });

  it('rejects a code longer than the column allows', () => {
    expect(
      optionCode.safeParse('a'.repeat(MAX_OPTION_CODE_LENGTH)).success,
    ).toBe(true);
    expect(
      optionCode.safeParse('a'.repeat(MAX_OPTION_CODE_LENGTH + 1)).success,
    ).toBe(false);
  });

  /**
   * Absence and a malformed value must answer differently: a select the admin
   * has not touched is "you did not choose", not "that is not a code".
   */
  it('separates an absent code from a malformed one', () => {
    const wrapped = z.object({ code: optionCode });

    expect(wrapped.safeParse({}).error?.issues[0]?.code).toBe('invalid_type');
    expect(wrapped.safeParse({ code: '' }).error?.issues[0]?.code).toBe(
      'too_small',
    );
    expect(wrapped.safeParse({ code: 'Nope!' }).error?.issues[0]?.code).toBe(
      'invalid_format',
    );
  });
});

describe('optionList', () => {
  it.each(OPTION_LISTS)('accepts %s', (list) => {
    expect(optionList.safeParse(list).success).toBe(true);
  });

  it('rejects a list nobody declared, so a typo cannot invent one', () => {
    expect(optionList.safeParse('employment-types').success).toBe(false);
  });

  it('separates an absent list from an unknown one', () => {
    const wrapped = z.object({ list: optionList });

    expect(wrapped.safeParse({}).error?.issues[0]?.code).toBe('invalid_type');
    expect(wrapped.safeParse({ list: 'nonsense' }).error?.issues[0]?.code).toBe(
      'invalid_value',
    );
  });
});

describe('OPTION_LIST_SHAPES', () => {
  it('describes every list', () => {
    expect(Object.keys(OPTION_LIST_SHAPES).sort()).toEqual(
      [...OPTION_LISTS].sort(),
    );
  });

  /**
   * A heading is an option like any other, which is what makes it translatable -
   * but only one level deep. A list whose headings themselves group under
   * headings is a tree, and a select is not one.
   */
  it('groups only under a list that does not itself group', () => {
    for (const list of OPTION_LISTS) {
      // Widened from the literal, whose members do not all carry the key.
      const shape: OptionListShape = OPTION_LIST_SHAPES[list];

      if (shape.groupedBy) {
        const heading: OptionListShape = OPTION_LIST_SHAPES[shape.groupedBy];

        expect(heading.groupedBy).toBeUndefined();
      }
    }
  });

  it('leaves a list of headings unable to carry headings of its own', () => {
    const headings: OptionListShape =
      OPTION_LIST_SHAPES['social-platform-group'];

    expect(headings.groupedBy).toBeUndefined();
  });
});

describe('optionIcon', () => {
  it('accepts a vendored slug', () => {
    expect(optionIcon.safeParse('github').success).toBe(true);
  });

  // Nothing draws a slug with no drawing behind it, so it is refused rather
  // than stored and silently rendered as nothing.
  it('rejects a slug with no mark behind it', () => {
    expect(optionIcon.safeParse('myspace').success).toBe(false);
  });
});

describe('optionOrder', () => {
  it('accepts zero, which is where a new option lands', () => {
    expect(optionOrder.safeParse(0).success).toBe(true);
  });

  it('rejects a negative position', () => {
    expect(optionOrder.safeParse(-1).success).toBe(false);
  });
});
