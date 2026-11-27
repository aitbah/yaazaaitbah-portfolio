import { describe, expect, it } from 'vitest';
import { toValidationDetails } from '@portfolio/shared';

import {
  optionEditSchema,
  optionSchema,
} from '../../../src/features/option/option.validation.js';

const platform = optionSchema('social-platform');
const level = optionSchema('education-level');

const VALID = { code: 'bluesky', name: { en: 'Bluesky' } };

function codesFor(
  schema: { safeParse: (input: unknown) => unknown },
  input: unknown,
) {
  const result = schema.safeParse(input) as ReturnType<
    typeof platform.safeParse
  >;
  if (result.success) throw new Error('expected validation to fail');

  return toValidationDetails(result.error);
}

describe('what a list allows', () => {
  it('accepts a code and a name, which is every list', () => {
    expect(
      level.safeParse({ code: 'phd', name: { en: 'Doctorate' } }).success,
    ).toBe(true);
  });

  it('accepts a heading and a mark on the list that has them', () => {
    expect(
      platform.safeParse({ ...VALID, group: 'social', icon: 'bluesky' })
        .success,
    ).toBe(true);
  });

  /**
   * Refused rather than dropped. `z.object` would strip an unknown key without
   * a word, so a client that had set a heading on an education level would be
   * told it worked. `NOT_ALLOWED` names the field that does not belong here -
   * the same answer a logo on a skill already gets.
   */
  it('refuses a heading on a list that has none', () => {
    expect(
      codesFor(level, { code: 'phd', name: { en: 'PhD' }, group: 'social' }),
    ).toEqual({ group: 'NOT_ALLOWED' });
  });

  it('refuses a mark on a list that has none', () => {
    expect(
      codesFor(level, { code: 'phd', name: { en: 'PhD' }, icon: 'github' }),
    ).toEqual({ icon: 'NOT_ALLOWED' });
  });

  it('refuses a mark with no drawing behind it', () => {
    expect(codesFor(platform, { ...VALID, icon: 'myspace' })).toEqual({
      icon: 'INVALID_VALUE',
    });
  });

  it('requires the default locale, like every other localized field', () => {
    expect(
      codesFor(platform, { code: 'bluesky', name: { fr: 'Bluesky' } }),
    ).toEqual({
      'name.en': 'REQUIRED',
    });
  });

  it('reports a malformed code on the code', () => {
    expect(codesFor(platform, { ...VALID, code: 'Blue Sky' })).toEqual({
      code: 'INVALID_CODE',
    });
  });
});

/**
 * An edit is everything but the code, because rows point at the code. Sending a
 * different one is asking for something this design cannot do, and saying so is
 * more useful than dropping it silently and appearing to have worked.
 */
describe('an edit', () => {
  it('accepts a new name for the same option', () => {
    expect(
      optionEditSchema('education-level').safeParse({
        name: { en: 'Doctorate' },
      }).success,
    ).toBe(true);
  });

  it('refuses a code, rather than ignoring one', () => {
    expect(
      codesFor(optionEditSchema('education-level'), {
        code: 'phd',
        name: { en: 'Doctorate' },
      }),
    ).toEqual({ code: 'NOT_ALLOWED' });
  });

  it('still refuses a heading on a list that has none', () => {
    expect(
      codesFor(optionEditSchema('education-level'), {
        name: { en: 'Doctorate' },
        group: 'social',
      }),
    ).toEqual({ group: 'NOT_ALLOWED' });
  });
});
