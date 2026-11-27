import { describe, expect, it } from 'vitest';
import { toValidationDetails } from '@portfolio/shared';

import { experienceSchema } from '../../../src/features/experience/experience.validation.js';

const PAST = {
  role: { en: 'Backend Engineer' },
  organisation: { en: 'Acme' },
  employmentType: 'full-time',
  startDate: '2021-03',
  endDate: '2023-06',
  current: false,
};

const CURRENT = {
  role: { en: 'Lead Engineer' },
  organisation: { en: 'Acme' },
  employmentType: 'full-time',
  startDate: '2023-07',
  current: true,
};

function codesFor(input: unknown) {
  const result = experienceSchema.safeParse(input);
  if (result.success) throw new Error('expected validation to fail');

  return toValidationDetails(result.error);
}

describe('the fields', () => {
  it('accepts a past position', () => {
    expect(experienceSchema.safeParse(PAST).success).toBe(true);
  });

  it('accepts a current one', () => {
    expect(experienceSchema.safeParse(CURRENT).success).toBe(true);
  });

  it('defaults `current` to false, so an omission is not "still there"', () => {
    const result = experienceSchema.safeParse({
      ...PAST,
      current: undefined,
    });
    if (!result.success) throw new Error('expected validation to succeed');

    expect(result.data.current).toBe(false);
  });

  /**
   * The period rule does not appear here, and should not: a refinement runs
   * only once the fields it relates have parsed. "The end cannot be before the
   * start" is not a useful thing to say about two values that are missing.
   */
  it('reports each missing field on itself', () => {
    expect(codesFor({})).toEqual({
      role: 'REQUIRED',
      organisation: 'REQUIRED',
      employmentType: 'REQUIRED',
      startDate: 'REQUIRED',
    });
  });

  it('requires the launch locale on the role and the organisation', () => {
    expect(codesFor({ ...PAST, role: { ar: 'مهندس' } })).toEqual({
      'role.en': 'REQUIRED',
    });
  });

  // Whether `consultant` is a type the owner offers is the service's question;
  // whether it is shaped like a code at all is this one.
  it('rejects an employment type that is not a code', () => {
    expect(codesFor({ ...PAST, employmentType: 'Consultant!' })).toEqual({
      employmentType: 'INVALID_CODE',
    });
  });

  it('accepts the optional fields being absent', () => {
    const result = experienceSchema.safeParse(PAST);
    if (!result.success) throw new Error('expected validation to succeed');

    expect(result.data.location).toBeUndefined();
    expect(result.data.description).toBeUndefined();
  });
});

/**
 * Months are stored as `YYYY-MM` strings rather than dates: a CV says
 * "March 2021", and a timestamp would claim a precision the data does not have
 * as well as dragging in a timezone bug. The format is therefore the contract.
 */
describe('the month format', () => {
  it.each(['2021-03', '1999-12', '2030-01'])('accepts %s', (month) => {
    expect(
      experienceSchema.safeParse({ ...CURRENT, startDate: month }).success,
    ).toBe(true);
  });

  it.each([
    '2021-3',
    '2021-13',
    '2021-00',
    '2021',
    '2021-03-15',
    'March 2021',
    '',
  ])('rejects %s', (month) => {
    expect(codesFor({ ...CURRENT, startDate: month })).toEqual({
      startDate: 'INVALID_MONTH',
    });
  });
});

/**
 * The three date fields only make sense together, and no field rule can say so
 * on its own. An absent end date could mean "still there" or "not filled in";
 * `current` is what makes those different answers rather than one ambiguity.
 */
describe('the period', () => {
  it('refuses an end date on a current position', () => {
    expect(codesFor({ ...CURRENT, endDate: '2024-01' })).toEqual({
      endDate: 'NOT_ALLOWED',
    });
  });

  it('requires an end date on a past one', () => {
    expect(codesFor({ ...PAST, endDate: undefined })).toEqual({
      endDate: 'REQUIRED',
    });
  });

  it('refuses an end before the start', () => {
    expect(
      codesFor({ ...PAST, startDate: '2023-06', endDate: '2021-03' }),
    ).toEqual({
      endDate: 'BEFORE_START',
    });
  });

  // The same month is a position held for one month, not an error.
  it('accepts an end in the same month as the start', () => {
    expect(
      experienceSchema.safeParse({
        ...PAST,
        startDate: '2022-05',
        endDate: '2022-05',
      }).success,
    ).toBe(true);
  });

  /**
   * Comparing the strings is the whole point of storing months this way: it is
   * chronological because it is lexicographic, with no parsing in between.
   */
  it('compares across a year boundary', () => {
    expect(
      experienceSchema.safeParse({
        ...PAST,
        startDate: '2021-12',
        endDate: '2022-01',
      }).success,
    ).toBe(true);

    expect(
      codesFor({ ...PAST, startDate: '2022-01', endDate: '2021-12' }),
    ).toEqual({ endDate: 'BEFORE_START' });
  });
});
