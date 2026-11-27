'use client';

import { ArrowLeftIcon, MailOpenIcon, ReplyIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

import type { Message } from './message-api';

type MessageDetailProps = {
  message: Message;
  /** Back to the list, which is the only way out on a narrow screen. */
  onBack: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
  isTogglingRead: boolean;
  isDeleting: boolean;
};

/** The selected message, whole. */
export function MessageDetail({
  message,
  onBack,
  onToggleRead,
  onDelete,
  isTogglingRead,
  isDeleting,
}: MessageDetailProps) {
  const t = useTranslations('admin.messages');
  const format = useFormatter();

  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden p-0">
      <CardHeader className="flex shrink-0 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          {/* Only where the pane has replaced the list; beside it, the list is
              still on screen and a back button would point at nothing. */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="@3xl/admin-content:hidden"
            aria-label={t('back')}
            onClick={onBack}
          >
            <ArrowLeftIcon className="rtl:rotate-180" aria-hidden />
          </Button>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-medium" dir="auto">
                {message.subject}
              </h2>
              {message.read ? null : <Badge>{t('unreadBadge')}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground" dir="auto">
              {t('from', { name: message.name, email: message.email })}
            </p>
            <time
              dateTime={message.receivedAt}
              className="text-sm text-muted-foreground"
            >
              {format.dateTime(new Date(message.receivedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </time>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            // Without this, clicking twice before the first answer sends a
            // second request that undoes the first.
            disabled={isTogglingRead}
            onClick={onToggleRead}
          >
            {isTogglingRead ? (
              <Spinner aria-hidden />
            ) : (
              <MailOpenIcon aria-hidden />
            )}
            {message.read ? t('markUnread') : t('markRead')}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
            >
              <ReplyIcon aria-hidden />
              {t('reply')}
            </a>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={() => setConfirming(true)}
          >
            {isDeleting ? <Spinner aria-hidden /> : null}
            {isDeleting ? t('deleting') : t('delete')}
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="min-h-0 flex-1 p-0">
        {/* The pane is as tall as the list beside it, so a long message
            scrolls inside it rather than stretching the page past it. */}
        <ScrollArea className="h-full">
          {/* The sender's own line breaks are the only structure it has. */}
          <p className="whitespace-pre-wrap p-4 text-sm" dir="auto">
            {message.body}
          </p>
        </ScrollArea>
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('confirmTitle', { name: message.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
