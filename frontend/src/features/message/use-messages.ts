'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';

import { deleteMessage, fetchMessages, setMessageRead } from './message-api';

/**
 * One key for every loaded page, so invalidating it refetches all of them -
 * deleting a message shifts the ones after it, and the unread count moves with
 * any change at all.
 */
const MESSAGES_QUERY_KEY = ['messages'] as const;

/**
 * The inbox, a page at a time and appended.
 *
 * The only list that pages at the API - strangers add its rows - and the admin
 * reads it with the same "show more" as every other list, so each further page
 * extends the one on screen rather than replacing it.
 */
export function useMessages() {
  const {
    data,
    isPending,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: MESSAGES_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchMessages(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last.page + 1) * last.pageSize < last.total ? last.page + 1 : undefined,
  });

  const pages = data?.pages ?? [];
  const latest = pages.at(-1);
  const seen = new Set<string>();

  return {
    // A message that arrives between two page loads shifts the offsets by one,
    // and the next page would repeat the last row of this one.
    messages: pages
      // Tolerant of a page without the field, as the single-page read was.
      .flatMap((page) => page.messages ?? [])
      .filter((message) => !seen.has(message.id) && seen.add(message.id)),
    unread: latest?.unread ?? 0,
    total: latest?.total ?? 0,
    pageSize: pages[0]?.pageSize ?? 0,
    hasMore: hasNextPage,
    loadMore: () => void fetchNextPage(),
    isLoadingMore: isFetchingNextPage,
    isPending,
    error,
  };
}

export function useSetMessageRead() {
  return useInvalidatingMutation(
    MESSAGES_QUERY_KEY,
    ({ id, read }: { id: string; read: boolean }) => setMessageRead(id, read),
  );
}

export function useDeleteMessage() {
  return useInvalidatingMutation(
    MESSAGES_QUERY_KEY,
    (id: string) => deleteMessage(id),
    'deleted',
  );
}
