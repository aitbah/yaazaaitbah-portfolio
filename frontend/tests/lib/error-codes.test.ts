import { describe, expect, it } from 'vitest';

import responses from '../../messages/en/responses.json';
import validation from '../../messages/en/validation.json';
import { ApiRequestError } from '../../src/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
} from '../../src/lib/error-codes';

describe('toResponseCode', () => {
  // Derived from the message file, so a translated code is always explained.
  it('keeps every code the messages can explain', () => {
    for (const code of Object.keys(responses.responses)) {
      expect(toResponseCode(new ApiRequestError(code))).toBe(code);
    }
  });

  it('collapses anything else to UNKNOWN, so no raw code reaches the user', () => {
    expect(toResponseCode(new ApiRequestError('SERVER_ERROR'))).toBe('UNKNOWN');
    expect(toResponseCode(new TypeError('network down'))).toBe('UNKNOWN');
    expect(toResponseCode(undefined)).toBe('UNKNOWN');
  });
});

describe('toFieldCode', () => {
  it('keeps every code the messages can explain', () => {
    for (const code of Object.keys(validation.validation)) {
      expect(toFieldCode(code)).toBe(code);
    }
  });

  it('falls back to UNKNOWN for a code it does not know', () => {
    expect(toFieldCode('SOMETHING_NEW')).toBe('UNKNOWN');
    expect(toFieldCode(undefined)).toBe('UNKNOWN');
  });
});

describe('toFieldErrors', () => {
  it('keeps the flat field codes a form can render', () => {
    expect(toFieldErrors({ email: 'INVALID_EMAIL' })).toEqual({
      email: 'INVALID_EMAIL',
    });
  });

  // Rendering a non-string would crash React, so it never reaches the form.
  it('drops anything that is not a code', () => {
    expect(toFieldErrors({ email: 'REQUIRED', nested: { deep: 1 } })).toEqual({
      email: 'REQUIRED',
    });
  });
});
