'use client';

import { MailIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { ListEmpty } from '@/components/admin/list-empty';
import { ErrorToast } from '@/components/error-toast';
import { ShowMoreControl, useRevealFocus } from '@/components/show-more';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { usePendingRow } from '@/lib/mutations';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useErrorMessages } from '@/lib/error-messages';
import { cn } from '@/lib/utils';

import type { Message } from './message-api';
import { MessageDetail } from './message-detail';
import { useDeleteMessage, useSetMessageRead } from './use-messages';

type MessageInboxProps = {
  messages: Message[];
  /** The API's paging, read through the same control as every other list. */
  more: {
    total: number;
    pageSize: number;
    hasMore: boolean;
    loadMore: () => void;
    isLoadingMore: boolean;
  };
};

/**
 * The inbox: the list to scan on one side, the selected message to read on the
 * other. Below the breakpoint the message replaces the list and carries its own
 * way back.
 */
export function MessageInbox({ messages, more }: MessageInboxProps) {
  const t = useTranslations('admin.messages');
  const errorMessage = useErrorMessages();
  const format = useFormatter();

  const setRead = useSetMessageRead();
  const remove = useDeleteMessage();
  const { pendingId, run: deleteMessage } = usePendingRow(remove.mutate);
  // Separate from the delete guard: they are different buttons on the same
  // message, and marking it read should not disable deleting it.
  const [readingId, setReadingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Derived rather than stored: a message deleted from under the selection
  // leaves an id pointing at nothing, and a stale copy of a message just
  // marked read would show the old state beside the button that changed it.
  const selected =
    messages.find((message) => message.id === selectedId) ?? null;

  // The next page is fetched, not sliced, so the reveal is counted here and
  // focus waits for the first new row to arrive.
  const list = useRef<HTMLUListElement>(null);
  const [reveal, setReveal] = useState({ reveals: 0, from: 0 });

  useRevealFocus(list, reveal.reveals, reveal.from);

  if (messages.length === 0) {
    return (
      <ListEmpty
        icon={MailIcon}
        title={t('emptyTitle')}
        description={t('emptyDescription')}
      />
    );
  }

  const failure = remove.error ?? setRead.error;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ErrorToast>{failure ? errorMessage.response(failure) : null}</ErrorToast>

      {/*
        Both panes are as tall as the space the page has left, and scroll
        inside it. They were capped at 32 rem, which on a tall screen stopped
        the list mid-page with nothing under it and read a long message through
        a short window.
      */}
      <div className="grid min-h-0 flex-1 gap-4 @3xl/admin-content:grid-cols-[minmax(18rem,24rem)_1fr]">
        <Card
          className={cn(
            'min-h-0 gap-0 overflow-hidden p-0',
            selected && '@max-3xl/admin-content:hidden',
          )}
        >
          <ScrollArea className="h-full">
            <ul
              ref={list}
              aria-label={t('listLabel')}
              className="flex flex-col"
            >
              {messages.map((message) => (
                <li key={message.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    // The whole row is the target: a link-sized hit area inside
                    // a list you navigate by mouse is needless precision work.
                    onClick={() => setSelectedId(message.id)}
                    aria-current={message.id === selectedId}
                    className={cn(
                      'flex w-full flex-col gap-1 p-3 text-start transition-colors',
                      'hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      message.id === selectedId && 'bg-accent',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          message.read ? 'font-normal' : 'font-semibold',
                        )}
                        dir="auto"
                      >
                        {message.subject}
                      </span>
                      {message.read ? null : (
                        <Badge className="shrink-0">{t('unreadBadge')}</Badge>
                      )}
                    </span>
                    <span
                      className="truncate text-sm text-muted-foreground"
                      dir="auto"
                    >
                      {message.name}
                    </span>
                    <time
                      dateTime={message.receivedAt}
                      className="text-xs text-muted-foreground"
                    >
                      {format.dateTime(new Date(message.receivedAt), {
                        dateStyle: 'medium',
                      })}
                    </time>
                  </button>
                </li>
              ))}
            </ul>

            <ShowMoreControl
              className="mb-4"
              noun="messages"
              state={{
                visible: messages.length,
                total: more.total,
                step: more.pageSize,
                hasMore: more.hasMore,
                isLoading: more.isLoadingMore,
                showMore() {
                  setReveal((current) => ({
                    reveals: current.reveals + 1,
                    from: messages.length,
                  }));
                  more.loadMore();
                },
              }}
            />
          </ScrollArea>
        </Card>

        <div
          className={cn(
            'min-h-0',
            !selected && '@max-3xl/admin-content:hidden',
          )}
        >
          {selected ? (
            <MessageDetail
              message={selected}
              onBack={() => setSelectedId(null)}
              isTogglingRead={readingId === selected.id}
              isDeleting={pendingId === selected.id}
              onToggleRead={() => {
                setReadingId(selected.id);
                setRead.mutate(
                  { id: selected.id, read: !selected.read },
                  { onSettled: () => setReadingId(null) },
                );
              }}
              onDelete={() => deleteMessage(selected.id)}
            />
          ) : (
            <Empty className="h-full min-h-48 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t('selectPrompt')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
