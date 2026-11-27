'use client';

import { ListIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  OPTION_LIST_SHAPES,
  type OptionListKey,
  type OptionListShape,
} from '@portfolio/shared';

import { BrandMark } from '@/components/brand-mark';
import { ListEmpty } from '@/components/admin/list-empty';
import { ReorderControls } from '@/components/admin/reorder-controls';
import { ReorderStatus } from '@/components/admin/reorder-status';
import { RowActions } from '@/components/admin/row-actions';
import { useReorder } from '@/components/admin/use-reorder';
import { ShowMoreList, useShowMore } from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { localizedValue } from '@/i18n/localized-value';
import { ApiRequestError } from '@/lib/api-client';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';
import { usePendingRow } from '@/lib/mutations';

import type { Option } from './option-api';
import {
  OPTIONS_QUERY_KEY,
  useDeleteOption,
  useOptionLabel,
} from './use-options';

/**
 * How many rows refused the delete, or `null` for any other failure.
 *
 * The count comes back in the conflict's details, beside the `IN_USE` code -
 * the same shape `expertise` answers with when a project still uses a skill.
 */
function inUseCount(error: unknown): number | null {
  if (!(error instanceof ApiRequestError) || error.code !== 'CONFLICT') {
    return null;
  }

  const { option, rows } = error.details as {
    option?: unknown;
    rows?: unknown;
  };

  return option === 'IN_USE' && typeof rows === 'number' ? rows : null;
}

type OptionListProps = {
  list: OptionListKey;
  options: Option[];
  onEdit: (option: Option) => void;
  /** Offered from the empty state, so a first row is one click away. */
  onAdd: () => void;
};

export function OptionList({ list, options, onEdit, onAdd }: OptionListProps) {
  const t = useTranslations('admin.options');
  const errorMessage = useErrorMessages();
  const locale = useLocale();

  // Widened from the literal, whose members do not all carry the key.
  const shape: OptionListShape = OPTION_LIST_SHAPES[list];
  const groupedBy = shape.groupedBy;
  const groupLabel = useOptionLabel(groupedBy ?? list);

  const remove = useDeleteOption();
  const rowsInUse = inUseCount(remove.error);
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  const {
    ordered,
    move,
    isReordering,
    error: orderError,
  } = useReorder({
    resource: 'options',
    items: options,
    queryKey: OPTIONS_QUERY_KEY,
    scope: { list },
  });

  const shown = useShowMore(
    `admin.options.${list}`,
    ordered.length,
    LIST_STEPS.admin.options,
  );

  /** A row moved past the last visible one opens the next step rather than vanishing. */
  function moveRow(from: number, to: number) {
    move(from, to);
    shown.reveal(to);
  }

  if (options.length === 0) {
    return (
      <ListEmpty
        icon={ListIcon}
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

  return (
    <div className="flex flex-col gap-2">
      <ReorderStatus error={orderError} isReordering={isReordering} />

      {/**
       * An option in use cannot be deleted, and that is the answer the admin
       * will meet most often here - so it is reported where they are looking,
       * and it says *why*. The generic conflict message ("that conflicts with
       * something that already exists") is true of a duplicate name and no help
       * at all about a row that still holds this code.
       */}
      <ErrorToast>
        {remove.error
          ? rowsInUse === null
            ? errorMessage.response(remove.error)
            : t('inUse', { rows: rowsInUse })
          : null}
      </ErrorToast>

      <ShowMoreList
        id={`admin.options.${list}`}
        step={LIST_STEPS.admin.options}
        noun={'options'}
        className="grid gap-3 @2xl/admin-content:grid-cols-2 @5xl/admin-content:grid-cols-3"
        items={ordered.map((option, index) => {
          const name = localizedValue(option.name, locale);

          return (
            <li
              key={option.id}
              className="flex items-center gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40"
            >
              <ReorderControls
                index={index}
                total={ordered.length}
                label={name}
                onMove={moveRow}
                disabled={isReordering}
              />

              {option.icon ? (
                <BrandMark
                  slug={option.icon}
                  title={name}
                  className="size-5 text-muted-foreground"
                />
              ) : null}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium" dir="auto">
                  {name}
                </span>
                <span className="flex items-center gap-2">
                  {option.group ? (
                    <Badge variant="secondary">
                      {groupLabel(option.group)}
                    </Badge>
                  ) : null}
                  {/* The stored value, beside the label it renders as: this is
                      what every row holding this option actually contains. */}
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {option.code}
                  </span>
                </span>
              </div>

              <RowActions
                labels={{
                  menu: t('actions', { name }),
                  edit: t('edit'),
                  delete: t('delete'),
                  deleting: t('deleting'),
                  confirmTitle: t('confirmTitle', { name }),
                  confirmDescription: t('confirmDescription'),
                  cancel: t('cancel'),
                }}
                onEdit={() => onEdit(option)}
                onDelete={() => deleteRow(option.id)}
                isDeleting={pendingId === option.id}
              />
            </li>
          );
        })}
      />
    </div>
  );
}
