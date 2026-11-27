import responses from '../../messages/en/responses.json';
import validation from '../../messages/en/validation.json';

import { ApiRequestError } from './api-client';

/**
 * The message files are the single source of truth: a code exists exactly when
 * it has a translation, so neither list can drift into a raw key path on screen.
 * English is the reference locale - every other one must define the same keys.
 */
const FIELD_CODES = Object.keys(validation.validation) as FieldCode[];
const RESPONSE_CODES = Object.keys(responses.responses) as ResponseCode[];

export type FieldCode = keyof (typeof validation)['validation'];
export type ResponseCode = keyof (typeof responses)['responses'];

/** Per-field code from a `VALIDATION_ERROR`, on either side of the wire. */
export function toFieldCode(code: string | undefined): FieldCode {
  return FIELD_CODES.find((known) => known === code) ?? 'UNKNOWN';
}

/** Any failure - backend code, network error, unexpected status - as a code. */
export function toResponseCode(error: unknown): ResponseCode {
  if (error instanceof ApiRequestError) {
    const known = RESPONSE_CODES.find((code) => code === error.code);

    if (known) {
      return known;
    }
  }

  return 'UNKNOWN';
}

/** Keeps only the flat `field: CODE` pairs a form can render. */
export function toFieldErrors(
  details: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(details).filter(([, code]) => typeof code === 'string'),
  ) as Record<string, string>;
}
