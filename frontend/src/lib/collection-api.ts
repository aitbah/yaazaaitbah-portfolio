import { apiFetch } from '@/lib/api-client';

/** The keys a resource's envelope uses: the list's, and one row's. */
type Envelope = { list: string; one: string };

/**
 * The four calls every collection endpoint answers the same way. A feature
 * re-exports them under its own names; anything specific to it (an upload, a
 * field stripped before saving) stays in the feature.
 */
export function collectionApi<Row, CreateInput, UpdateInput = CreateInput>(
  path: string,
  envelope: Envelope,
) {
  return {
    list: async (): Promise<Row[]> => {
      const details = await apiFetch<Record<string, Row[]>>(path);

      return details[envelope.list] ?? [];
    },

    create: async (input: CreateInput): Promise<Row> => {
      const details = await apiFetch<Record<string, Row>>(path, {
        method: 'POST',
        body: JSON.stringify(input),
      });

      return details[envelope.one]!;
    },

    update: async (id: string, input: UpdateInput): Promise<Row> => {
      const details = await apiFetch<Record<string, Row>>(`${path}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });

      return details[envelope.one]!;
    },

    remove: async (id: string): Promise<void> => {
      await apiFetch(`${path}/${id}`, { method: 'DELETE' });
    },
  };
}
