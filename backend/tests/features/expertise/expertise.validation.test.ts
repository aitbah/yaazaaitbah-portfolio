import { describe, expect, it } from 'vitest';
import { toValidationDetails } from '@portfolio/shared';

import { expertiseSchema } from '../../../src/features/expertise/expertise.validation.js';

const technology = expertiseSchema('technology');
const skill = expertiseSchema('skill');

const VALID = {
  name: { en: 'TypeScript' },
  category: 'frontend',
  level: 80,
};

function codesFor(input: unknown) {
  const result = technology.safeParse(input);
  if (result.success) throw new Error('expected validation to fail');

  return toValidationDetails(result.error);
}

describe('the technology schema', () => {
  it('accepts a row without a position, defaulting it to the back', () => {
    const result = technology.safeParse(VALID);
    if (!result.success) throw new Error('expected validation to succeed');

    expect(result.data.order).toBe(0);
  });

  it('accepts any further locale without being told about it', () => {
    expect(
      technology.safeParse({
        ...VALID,
        name: { en: 'Team leadership', ar: 'قيادة الفريق' },
      }).success,
    ).toBe(true);
  });

  it('requires the launch locale on the name', () => {
    expect(codesFor({ ...VALID, name: { ar: 'قيادة' } })).toEqual({
      'name.en': 'REQUIRED',
    });
  });

  it('reports each missing field on itself', () => {
    expect(codesFor({})).toEqual({
      name: 'REQUIRED',
      category: 'REQUIRED',
      level: 'REQUIRED',
    });
  });

  /**
   * "Not a code" is all a schema can say now. Whether `nonsense` is a category
   * this kind offers is a question about rows, answered by the service - see
   * `option/option.reference.test.ts`.
   */
  it('rejects a category that is not a code', () => {
    expect(codesFor({ ...VALID, category: 'Not A Category' })).toEqual({
      category: 'INVALID_CODE',
    });
  });

  // 0 is a real answer, so it must not be treated as absent.
  it('accepts a level of zero', () => {
    expect(technology.safeParse({ ...VALID, level: 0 }).success).toBe(true);
  });

  // Asserting the code, not merely that it failed: a fraction used to answer
  // REQUIRED, which put "this field is required" under a box the admin could
  // clearly see a value in.
  it.each([
    [-1, 'TOO_SMALL'],
    [101, 'TOO_BIG'],
    [42.5, 'INVALID_INTEGER'],
    [70.5, 'INVALID_INTEGER'],
  ])('rejects the level %s as %s', (level, code) => {
    expect(codesFor({ ...VALID, level })).toEqual({ level: code });
  });

  it('rejects a fractional position for the same reason', () => {
    expect(codesFor({ ...VALID, order: 1.5 })).toEqual({
      order: 'INVALID_INTEGER',
    });
  });

  // The admin form reads a number input, which yields a string.
  it('rejects a numeric string, so the form must convert first', () => {
    expect(technology.safeParse({ ...VALID, level: '80' }).success).toBe(false);
  });

  it('rejects a blank name', () => {
    expect(codesFor({ ...VALID, name: { en: '   ' } })).toEqual({
      'name.en': 'REQUIRED',
    });
  });
});

/**
 * The whole point of the split, as a rule rather than a convention: a category
 * belongs to one kind, and only two of the three kinds carry a logo. A form
 * could hide the wrong options; the schema is what makes them impossible.
 */
describe('what each kind allows', () => {
  const SKILL = {
    name: { en: 'Problem Solving' },
    category: 'engineering',
    level: 90,
  };

  it('accepts a skill in a skill category', () => {
    expect(skill.safeParse(SKILL).success).toBe(true);
  });

  /**
   * There is no matching refusal here any more. A skill holding `frontend` is
   * wrong because `frontend` is not a row in the `skill-category` list - which
   * is a fact about the database, not about the shape of the request, so the
   * check moved to where the lists can be read.
   */

  /**
   * There is no brand mark for "Problem Solving". Saying so is more useful
   * than silently dropping the field, which is what a plain object schema
   * would do - the client would go on believing it had set one.
   */
  it('refuses a logo on a skill, by name', () => {
    const result = skill.safeParse({
      ...SKILL,
      icon: { kind: 'preset', value: 'react' },
    });
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({ icon: 'NOT_ALLOWED' });
  });

  it('accepts a logo on a technology and on a tool', () => {
    const icon = { kind: 'preset', value: 'react' } as const;

    expect(technology.safeParse({ ...VALID, icon }).success).toBe(true);
    expect(
      expertiseSchema('tool').safeParse({
        name: { en: 'Docker' },
        category: 'devops',
        level: 80,
        icon,
      }).success,
    ).toBe(true);
  });
});
