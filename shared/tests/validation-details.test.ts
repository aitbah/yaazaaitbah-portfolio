import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toValidationDetails } from '../src/validation-details.js';

const schema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

function failureOf(input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected validation to fail');

  return toValidationDetails(result.error);
}

describe('a whole-number rule', () => {
  const schema = z.object({ level: z.number().int() });

  /**
   * Zod raises a type error for a fraction, but the value is present and is a
   * number: answering REQUIRED would put "this field is required" under a box
   * the admin can clearly see a value in.
   */
  it('reports a fraction as not an integer, not as a missing field', () => {
    const result = schema.safeParse({ level: 42.5 });
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({
      level: 'INVALID_INTEGER',
    });
  });

  it('still reports a really absent number as REQUIRED', () => {
    const result = schema.safeParse({});
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({ level: 'REQUIRED' });
  });
});

describe('toValidationDetails', () => {
  it('returns one code per field, never a translated message', () => {
    expect(failureOf({ email: 'not-an-email' })).toEqual({
      email: 'INVALID_EMAIL',
      password: 'REQUIRED',
    });
  });

  // Zod cannot tell an absent key from a wrong type: its public issue carries
  // neither the value nor its type. Both deliberately answer REQUIRED.
  it('reports a wrong type as REQUIRED, like an absent field', () => {
    expect(failureOf({ email: 42, password: 12345678 })).toEqual({
      email: 'REQUIRED',
      password: 'REQUIRED',
    });
    expect(failureOf({ email: null })).toMatchObject({ email: 'REQUIRED' });
  });

  // Mirrors the frontend: a minimum of one means required, not too short.
  it('reports an empty required field as REQUIRED, not a length hint', () => {
    const required = z.object({ password: z.string().min(1) });
    const result = required.safeParse({ password: '' });
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({
      password: 'REQUIRED',
    });
  });

  it('reports length violations as codes', () => {
    expect(failureOf({ email: 'user@example.com', password: 'short' })).toEqual(
      {
        password: 'TOO_SMALL',
      },
    );
  });
});
