import {
  set,
  type FieldErrors,
  type FieldPath,
  type FieldPathByValue,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import type { ZodType } from 'zod';
import { toValidationDetails } from '@portfolio/shared';

import { toFieldCode, type FieldCode } from './error-codes';

/**
 * A Zod schema as a React Hook Form resolver, in the project's code vocabulary:
 * errors are field codes, translated here, so no raw Zod English reaches the
 * screen. The parsed payload type is separate from the field values.
 */
export function createFormResolver<
  TValues extends FieldValues,
  TPayload = TValues,
>(
  schema: ZodType<TPayload>,
  translate: (code: FieldCode) => string,
): Resolver<TValues, unknown, TPayload> {
  return (values) => {
    const parsed = schema.safeParse(values);

    if (parsed.success) {
      return { values: parsed.data, errors: {} };
    }

    // Those dotted paths are RHF's own syntax, so its `set` nests them for us.
    const errors: FieldValues = {};

    for (const [path, code] of Object.entries(
      toValidationDetails(parsed.error),
    )) {
      set(errors, path, { type: code, message: translate(toFieldCode(code)) });
    }

    return { values: {}, errors: errors as FieldErrors<TValues> };
  };
}

/**
 * A validation key from the API as an RHF field path. They already share the
 * dotted syntax, so nothing is converted - this is only where TypeScript is told
 * so, once, instead of at every call site.
 */
export function toFieldPath<T extends FieldValues>(path: string): FieldPath<T> {
  return path as FieldPath<T>;
}

/**
 * The same, for a path built at runtime that is known to hold text - a single
 * locale of a localized field, whose name is only known once the configured
 * locales are read. Narrower than `toFieldPath` because the text inputs accept
 * only paths that hold a string.
 */
export function toTextFieldPath<T extends FieldValues>(
  path: string,
): FieldPathByValue<T, string> {
  return path as FieldPathByValue<T, string>;
}
