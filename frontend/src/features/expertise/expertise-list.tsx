'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  KIND_HAS_ICON,
  OPTION_LIST_BY_KIND,
  type ExpertiseKind,
} from '@portfolio/shared';

import { ListEmpty } from '@/components/admin/list-empty';
import { ReorderControls } from '@/components/admin/reorder-controls';
import { ReorderStatus } from '@/components/admin/reorder-status';
import { RowActions } from '@/components/admin/row-actions';
import { useReorder } from '@/components/admin/use-reorder';
import {
  ShowMoreList,
  useShowMore,
  type ShowMoreNoun,
} from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOptionLabel } from '@/features/option/use-options';
import { localizedValue } from '@/i18n/localized-value';
import { ApiRequestError } from '@/lib/api-client';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';
import { usePendingRow } from '@/lib/mutations';

import type { Expertise } from './expertise-api';
import { ExpertiseIcon } from './expertise-icon';
import { KIND_ICONS, kindResource } from './expertise-kinds';
import { expertiseQueryKey, useDeleteExpertise } from './use-expertise';

/** The launch locale is the one every row is required to have. */
export function nameOf(row: Expertise, locale: string): string {
  return localizedValue(row.name, locale);
}

/** What "more" is, in the control's words, for each kind. */
const KIND_NOUNS = {
  skill: 'skills',
  technology: 'technologies',
  tool: 'tools',
} as const satisfies Record<ExpertiseKind, ShowMoreNoun>;

type ExpertiseListProps = {
  kind: ExpertiseKind;
  rows: Expertise[];
  onEdit: (row: Expertise) => void;
  /** Offered from the empty state, so a first row is one click away. */
  onAdd: () => void;
};

export function ExpertiseList({
  kind,
  rows,
  onEdit,
  onAdd,
}: ExpertiseListProps) {
  const t = useTranslations('admin.expertise');
  const tKind = useTranslations(`admin.expertise.kinds.${kind}`);
  const categoryLabel = useOptionLabel(OPTION_LIST_BY_KIND[kind]);
  const errorMessage = useErrorMessages();
  const locale = useLocale();

  const remove = useDeleteExpertise(kind);
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  const {
    ordered,
    move,
    isReordering,
    error: orderError,
  } = useReorder({
    resource: kindResource(kind),
    items: rows,
    queryKey: expertiseQueryKey(kind),
  });

  const shown = useShowMore(
    `admin.${kind}`,
    ordered.length,
    LIST_STEPS.admin.expertise,
  );

  /** A row moved past the last visible one opens the next step rather than vanishing. */
  function moveRow(from: number, to: number) {
    move(from, to);
    shown.reveal(to);
  }

  /**
   * The API refuses to delete a row a project still uses, and says how many.
   * "That conflicts with something that already exists" is true but useless -
   * the admin needs to know where to go and unlink it.
   */
  function explain(error: unknown): string {
    if (error instanceof ApiRequestError && error.details[kind] === 'IN_USE') {
      const count = error.details.projects;

      return t('inUse', { count: typeof count === 'number' ? count : 0 });
    }

    return errorMessage.response(error);
  }

  if (rows.length === 0) {
    return (
      <ListEmpty
        icon={KIND_ICONS[kind]}
        title={tKind('emptyTitle')}
        description={tKind('emptyDescription')}
        action={
          <Button type="button" onClick={onAdd}>
            {tKind('add')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ReorderStatus error={orderError} isReordering={isReordering} />

      <ErrorToast>{remove.error ? explain(remove.error) : null}</ErrorToast>

      {/*
        A grid, not a stack. Nineteen rows across a 1600 px column put the name
        at the far left and the buttons at the far right with a hand's width of
        nothing between them, and made a short list four screens tall. Columns
        are added by the container's own width, so the sidebar being open
        counts.
      */}
      <ShowMoreList
        id={`admin.${kind}`}
        step={LIST_STEPS.admin.expertise}
        noun={KIND_NOUNS[kind]}
        className="grid gap-3 @2xl/admin-content:grid-cols-2 @5xl/admin-content:grid-cols-3 @7xl/admin-content:grid-cols-4"
        items={ordered.map((row, index) => (
          <li
            key={row.id}
            className="flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40"
          >
            <div className="flex min-w-0 items-start gap-3">
              {/* Only where the kind has a logo at all. A skill has none, so
                  its cards give the space to the name rather than to a column
                  of empty boxes. */}
              {KIND_HAS_ICON[kind] ? (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40 p-1.5">
                  {row.icon ? (
                    <ExpertiseIcon
                      icon={row.icon}
                      name={nameOf(row, locale)}
                      className="size-full"
                      brandColor
                    />
                  ) : (
                    <span
                      className="text-[10px] text-muted-foreground"
                      aria-hidden
                    >
                      —
                    </span>
                  )}
                </div>
              ) : null}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium" dir="auto">
                  {nameOf(row, locale)}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {categoryLabel(row.category)}
                  </Badge>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t('levelValue', { level: row.level })}
                  </span>
                </span>
              </div>

              {/* One group, so the menu centres against the chevron pair
                  rather than lining up with only the top one. */}
              <div className="flex shrink-0 items-center gap-1">
                <ReorderControls
                  index={index}
                  total={ordered.length}
                  label={nameOf(row, locale)}
                  onMove={moveRow}
                  disabled={isReordering}
                />

                <RowActions
                  labels={{
                    menu: t('actions', { name: nameOf(row, locale) }),
                    edit: t('edit'),
                    delete: t('delete'),
                    deleting: t('deleting'),
                    confirmTitle: t('confirmTitle', {
                      name: nameOf(row, locale),
                    }),
                    confirmDescription: t('confirmDescription'),
                    cancel: t('cancel'),
                  }}
                  onEdit={() => onEdit(row)}
                  onDelete={() => deleteRow(row.id)}
                  isDeleting={pendingId === row.id}
                />
              </div>
            </div>

            {/* The level as a bar as well as a number: twenty percentages read
                as a column of digits, where twenty bars read as a comparison. */}
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${row.level}%` }}
              />
            </div>
          </li>
        ))}
      />
    </div>
  );
}
