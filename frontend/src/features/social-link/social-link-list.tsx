'use client';

import { Share2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

import { ListEmpty } from '@/components/admin/list-empty';
import { ReorderControls } from '@/components/admin/reorder-controls';
import { ReorderStatus } from '@/components/admin/reorder-status';
import { RowActions } from '@/components/admin/row-actions';
import { useReorder } from '@/components/admin/use-reorder';
import {
  ShowMoreControl,
  useRevealFocus,
  useShowMore,
} from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Button } from '@/components/ui/button';
import { usePendingRow } from '@/lib/mutations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOptionIcon, useOptionLabel } from '@/features/option/use-options';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';

import { PlatformMark } from './platform-mark';
import type { SocialLink } from './social-link-api';
import {
  useDeleteSocialLink,
  SOCIAL_LINKS_QUERY_KEY,
} from './use-social-links';

type SocialLinkListProps = {
  socialLinks: SocialLink[];
  onEdit: (link: SocialLink) => void;
  /** Offered from the empty state, so a first link is one click away. */
  onAdd: () => void;
};

export function SocialLinkList({
  socialLinks,
  onEdit,
  onAdd,
}: SocialLinkListProps) {
  const t = useTranslations('admin.socialLinks');
  const platformLabel = useOptionLabel('social-platform');
  const platformIcon = useOptionIcon('social-platform');
  const errorMessage = useErrorMessages();

  const remove = useDeleteSocialLink();
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  const {
    ordered,
    move,
    isReordering,
    error: orderError,
  } = useReorder({
    resource: 'social-links',
    items: socialLinks,
    queryKey: SOCIAL_LINKS_QUERY_KEY,
  });

  // A table rather than a list, so the pieces are composed here: the rows are
  // the body's children, which is what focus is moved among.
  const shown = useShowMore(
    'admin.socialLinks',
    ordered.length,
    LIST_STEPS.admin.socialLinks,
  );
  const body = useRef<HTMLTableSectionElement>(null);

  useRevealFocus(body, shown.reveals, shown.revealedFrom);

  /** A row moved past the last visible one opens the next step rather than vanishing. */
  function moveRow(from: number, to: number) {
    move(from, to);
    shown.reveal(to);
  }

  if (socialLinks.length === 0) {
    return (
      <ListEmpty
        icon={Share2Icon}
        title={t('emptyTitle')}
        description={t('emptyDescription')}
        action={
          <Button type="button" onClick={onAdd}>
            {t('add')}
          </Button>
        }
      />
    );
  }

  const nameOf = (link: SocialLink) => platformLabel(link.platform);

  return (
    <div className="flex flex-col gap-2">
      <ReorderStatus error={orderError} isReordering={isReordering} />

      <ErrorToast>
        {remove.error ? errorMessage.response(remove.error) : null}
      </ErrorToast>

      {/*
        The vendored table already scrolls itself; this only frames it.
        A table, which is what platform-and-URL has been all along: two facts
        per row, the same two every time, worth comparing down the column. The
        logo is what makes the platform column readable at a glance instead of
        a word to parse.
      */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.platform')}</TableHead>
              <TableHead>{t('fields.url')}</TableHead>
              <TableHead className="w-24 text-end">
                <span className="sr-only">{t('columnActions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={body}>
            {ordered.slice(0, shown.visible).map((link, index) => (
              <TableRow key={link.id}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <PlatformMark
                      slug={platformIcon(link.platform)}
                      title={nameOf(link)}
                      className="size-4"
                    />
                    {nameOf(link)}
                  </span>
                </TableCell>
                <TableCell className="max-w-0">
                  {/* The URL is the row's only unbounded value, so it is the
                      one that has to be allowed to truncate. */}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    dir="ltr"
                  >
                    {link.url}
                  </a>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <ReorderControls
                      index={index}
                      total={ordered.length}
                      label={nameOf(link)}
                      onMove={moveRow}
                      disabled={isReordering}
                    />
                    <RowActions
                      labels={{
                        menu: t('actions', { name: nameOf(link) }),
                        edit: t('edit'),
                        delete: t('delete'),
                        deleting: t('deleting'),
                        confirmTitle: t('confirmTitle', { name: nameOf(link) }),
                        confirmDescription: t('confirmDescription'),
                        cancel: t('cancel'),
                      }}
                      onEdit={() => onEdit(link)}
                      onDelete={() => deleteRow(link.id)}
                      isDeleting={pendingId === link.id}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ShowMoreControl state={shown} noun="socialLinks" />
    </div>
  );
}
