'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { useToast } from '@/components/ui/toast';

/**
 * Turns a successful admin write into a toast, for every write that names its
 * outcome (`MutationNotice`). One listener on the mutation cache rather than a
 * call in each form, so a new editor gets the notification by declaring it.
 */
export function MutationNotices() {
  const client = useQueryClient();
  const toast = useToast();
  const t = useTranslations('admin.notifications');

  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        const notice = event.mutation?.meta?.notice;

        if (
          event.type === 'updated' &&
          event.action.type === 'success' &&
          notice
        ) {
          toast({ title: t(notice), tone: 'success' });
        }
      }),
    [client, toast, t],
  );

  return null;
}
