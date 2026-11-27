import { describe, expect, it } from 'vitest';
import { toValidationDetails } from '@portfolio/shared';

import validation from '../../../messages/en/validation.json';
import { loginSchema } from '../../../src/features/auth/login-schema';

function codesFor(input: unknown) {
  const result = loginSchema.safeParse(input);
  if (result.success) throw new Error('expected validation to fail');

  return toValidationDetails(result.error);
}

describe('login schema', () => {
  it('accepts valid credentials', () => {
    expect(
      loginSchema.safeParse({ email: 'admin@example.com', password: 'x' })
        .success,
    ).toBe(true);
  });

  // These are the exact codes the backend returns for the same input.
  it('produces the backend field codes', () => {
    expect(codesFor({ email: 'not-an-email', password: '' })).toEqual({
      email: 'INVALID_EMAIL',
      password: 'REQUIRED',
    });

    expect(codesFor({})).toEqual({
      email: 'REQUIRED',
      password: 'REQUIRED',
    });
  });

  // An empty required field must not read as a length hint on the login form.
  it('never reports the password as too short', () => {
    expect(codesFor({ email: 'admin@example.com', password: '' })).toEqual({
      password: 'REQUIRED',
    });
  });
});

describe('field code messages', () => {
  it('translates every code the schema can produce', () => {
    for (const code of ['REQUIRED', 'INVALID_EMAIL']) {
      expect(validation.validation[code as 'REQUIRED']).toBeTruthy();
    }
  });

  it('has no password length wording', () => {
    expect(validation.validation.REQUIRED).not.toMatch(/character|\d/i);
  });
});
