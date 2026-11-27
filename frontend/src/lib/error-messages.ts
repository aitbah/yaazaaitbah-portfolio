'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { toFieldCode, toResponseCode } from './error-codes';

/**
 * A failure in the reader's language.
 *
 * The mapping is the same everywhere - a code, then its message - so it is
 * written once rather than in every component that can fail.
 */
export function useErrorMessages() {
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  return useMemo(
    () => ({
      /** A per-field code from a `VALIDATION_ERROR`. */
      field: (code: string) => tField(toFieldCode(code)),
      /** Any failure at all: a backend code, a network error, a bad status. */
      response: (error: unknown) => tResponse(toResponseCode(error)),
    }),
    [tField, tResponse],
  );
}
