import type { Expertise } from '@/features/expertise/expertise-api';

/**
 * Every row a project's stack can point at, by id.
 *
 * A project stores references, not names, and they may be skills, technologies
 * or tools - the admin lets it pick from all three. Built once per page rather
 * than searched three lists deep per chip.
 */
export function expertiseIndex(lists: Expertise[][]): Map<string, Expertise> {
  return new Map(lists.flat().map((row) => [row.id, row]));
}

/**
 * A project's stack, in the order it was saved.
 *
 * A reference with no row is dropped. The API refuses to save one, so this is
 * the case where the row was deleted afterwards - and a chip with no name is
 * worse than one fewer chip.
 */
export function projectStack(
  ids: string[],
  index: Map<string, Expertise>,
): Expertise[] {
  return ids
    .map((id) => index.get(id))
    .filter((row): row is Expertise => row !== undefined);
}
