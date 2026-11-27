'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { saveOrder, type OrderableResource } from '@/lib/reorder-api';

import { moved } from './reorder-controls';

type Identified = { id: string };

type UseReorderOptions<T extends Identified> = {
  resource: OrderableResource;
  /** The server's order, which is the truth between edits. */
  items: T[];
  /** The query to refetch once the server has the new order. */
  queryKey: readonly unknown[];
  /** Which of a resource's several lists this ordering is of, where it has any. */
  scope?: Record<string, string>;
};

/**
 * A move shows the new order at once and saves in the background. The pending
 * order is held here, not in the cache, so a failed save simply snaps back. The
 * whole list is sent, and the server refuses a stale one.
 */
export function useReorder<T extends Identified>({
  resource,
  items,
  queryKey,
  scope,
}: UseReorderOptions<T>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<T[] | null>(null);

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: (ids: string[]) => saveOrder(resource, ids, scope),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
    // Whatever the server holds is what should now be on screen, whether the
    // save worked or not.
    onSuccess: () => setPending(null),
    onError: () => setPending(null),
  });

  function move(from: number, to: number) {
    const next = moved(pending ?? items, from, to);

    reset();
    setPending(next);
    mutate(next.map((item) => item.id));
  }

  return {
    /** What to render: the pending order while saving, the server's otherwise. */
    ordered: pending ?? items,
    move,
    isReordering: isPending,
    error,
  };
}
