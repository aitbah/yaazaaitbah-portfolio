import type { Request } from 'express';

/**
 * The `:id` a route matched, as a string.
 *
 * Express types a route parameter as `string | string[]`. An array is not an
 * identifier, so it becomes the empty string and the service answers NOT_FOUND.
 *
 * Nine controllers had a byte-identical private copy of this.
 */
export function idOf(req: Request): string {
  const { id } = req.params;

  return typeof id === 'string' ? id : '';
}
