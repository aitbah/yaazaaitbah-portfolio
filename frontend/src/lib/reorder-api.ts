import { apiFetch } from '@/lib/api-client';

/**
 * The resources that carry an order.
 *
 * Declared once and imported by `useReorder` rather than written out in both,
 * because two copies of one union drift.
 */
export type OrderableResource =
  | 'skills'
  | 'technologies'
  | 'tools'
  | 'projects'
  | 'social-links'
  | 'languages'
  | 'options';

/**
 * Sends a whole ordering. Every orderable entity uses the same endpoint shape,
 * so this is written once rather than once per resource.
 *
 * The complete list goes rather than the pair that moved: two tabs each moving
 * a different row would otherwise interleave into an order neither asked for.
 */
export async function saveOrder(
  resource: OrderableResource,
  ids: string[],
  /**
   * What the ids are an ordering *of*, for a collection holding several
   * independent lists. Options are the only one so far: every option list
   * shares one collection, and the server refuses an ordering that does not
   * name every row of the list it is scoped to - the check that would fail
   * across all of them at once without this.
   */
  scope: Record<string, string> = {},
): Promise<void> {
  await apiFetch(`/api/${resource}/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ ...scope, ids }),
  });
}
