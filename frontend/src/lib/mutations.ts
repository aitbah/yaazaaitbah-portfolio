'use client';

import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';

/**
 * What a successful write tells the admin, as a toast (`MutationNotices`).
 * Only for writes whose success is otherwise silent - the form closes, the row
 * goes - and never on failure, which each form and list already reports where
 * it happened.
 */
export type MutationNotice = 'created' | 'saved' | 'deleted';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { notice?: MutationNotice };
  }
}

/**
 * A write that refetches its list rather than patching the cache by hand.
 *
 * Every list here is ordered by the server, so a create, a rename or a date
 * change can move a row anywhere in it - there is no local edit that stays
 * true.
 */
export function useInvalidatingMutation<TVariables, TResult>(
  queryKey: QueryKey,
  mutationFn: (variables: TVariables) => Promise<TResult>,
  notice?: MutationNotice,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    meta: notice ? { notice } : undefined,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}

/** Narrower than react-query's own signature, which is what makes it readable. */
type RowMutate = (id: string, options: { onSettled: () => void }) => void;

/**
 * Which row an action is running on, so the spinner lands on that row and not
 * on the whole list.
 */
export function usePendingRow(mutate: RowMutate) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const run = useCallback(
    (id: string) => {
      setPendingId(id);
      mutate(id, { onSettled: () => setPendingId(null) });
    },
    [mutate],
  );

  return { pendingId, run };
}
