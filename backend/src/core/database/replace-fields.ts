import type { z } from 'zod';

/**
 * `PUT` replaces, so omitted fields are unset rather than kept. Done with
 * `$set`/`$unset` rather than a replacement, which reset `createdAt`; the field
 * list comes from the Zod schema so it cannot go stale.
 */
export function replacementUpdate<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  input: Record<string, unknown>,
): { $set: Record<string, unknown>; $unset?: Record<string, ''> } {
  const fields = Object.keys(schema.shape);

  const $set = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );

  const $unset = Object.fromEntries(
    fields
      .filter((field) => input[field] === undefined)
      .map((field) => [field, '' as const]),
  );

  // An empty `$unset` is an error in MongoDB, not a no-op.
  return Object.keys($unset).length > 0 ? { $set, $unset } : { $set };
}
