'use client';

import { GraduationCapIcon, MapPinIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';

import { ListEmpty } from '@/components/admin/list-empty';
import { RowActions } from '@/components/admin/row-actions';
import { ShowMoreList } from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePendingRow } from '@/lib/mutations';
import { MONTH_FORMAT, monthAsDate } from '@/i18n/month';
import { useOptionLabel } from '@/features/option/use-options';
import { localizedValue } from '@/i18n/localized-value';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';

import type { Education } from './education-api';
import { useDeleteEducation } from './use-education';

/** The launch locale is the one every required field is guaranteed to have. */
export function qualificationOf(entry: Education, locale: string): string {
  return localizedValue(entry.qualification, locale);
}

function institutionOf(entry: Education, locale: string): string {
  return localizedValue(entry.institution, locale);
}

type EducationListProps = {
  entries: Education[];
  onEdit: (entry: Education) => void;
  /** Offered from the empty state, so a first entry is one click away. */
  onAdd: () => void;
};

/**
 * What someone studied, most recent first.
 *
 * No reorder controls: the dates are the order, exactly as they are for a
 * career. A stored position that disagreed with them would be a state the admin
 * could not see.
 */
export function EducationList({ entries, onEdit, onAdd }: EducationListProps) {
  const t = useTranslations('admin.education');
  const levelLabel = useOptionLabel('education-level');
  const errorMessage = useErrorMessages();
  const locale = useLocale();
  const format = useFormatter();

  const remove = useDeleteEducation();
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  if (entries.length === 0) {
    return (
      <ListEmpty
        icon={GraduationCapIcon}
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

  /** "Sep 2015 – Jun 2018", or "Sep 2015 – Present" while it is under way. */
  function period(entry: Education): string {
    const from = format.dateTime(monthAsDate(entry.startDate), MONTH_FORMAT);
    const to = entry.endDate
      ? format.dateTime(monthAsDate(entry.endDate), MONTH_FORMAT)
      : t('present');

    return `${from} – ${to}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <ErrorToast>
        {remove.error ? errorMessage.response(remove.error) : null}
      </ErrorToast>

      {/* The same grid as the career: full width, two balanced columns once
          there is room for two without either being cramped. */}
      <ShowMoreList
        id={'admin.education'}
        step={LIST_STEPS.admin.education}
        noun={'education'}
        as="ol"
        className="grid w-full gap-3 @5xl/admin-content:grid-cols-2"
        items={entries.map((entry) => (
          <li
            key={entry.id}
            className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium" dir="auto">
                    {qualificationOf(entry, locale)}
                  </span>
                  {entry.current ? <Badge>{t('currentBadge')}</Badge> : null}
                </span>

                <span className="text-sm text-muted-foreground" dir="auto">
                  {institutionOf(entry, locale)}
                </span>

                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {/* A real `time` element per end, so the range is machine
                      readable as well as legible. */}
                  <span className="tabular-nums">
                    <time dateTime={entry.startDate}>
                      {format.dateTime(
                        monthAsDate(entry.startDate),
                        MONTH_FORMAT,
                      )}
                    </time>
                    {' – '}
                    {entry.endDate ? (
                      <time dateTime={entry.endDate}>
                        {format.dateTime(
                          monthAsDate(entry.endDate),
                          MONTH_FORMAT,
                        )}
                      </time>
                    ) : (
                      t('present')
                    )}
                  </span>

                  <Badge variant="secondary">{levelLabel(entry.level)}</Badge>

                  {localizedValue(entry.fieldOfStudy, locale) ? (
                    <span dir="auto">
                      {localizedValue(entry.fieldOfStudy, locale)}
                    </span>
                  ) : null}

                  {localizedValue(entry.location, locale) ? (
                    <span className="flex items-center gap-1" dir="auto">
                      <MapPinIcon className="size-3.5" aria-hidden />
                      {localizedValue(entry.location, locale)}
                    </span>
                  ) : null}
                </span>
              </div>

              <RowActions
                labels={{
                  menu: t('actions', { name: qualificationOf(entry, locale) }),
                  edit: t('edit'),
                  delete: t('delete'),
                  deleting: t('deleting'),
                  confirmTitle: t('confirmTitle', {
                    name: qualificationOf(entry, locale),
                    institution: institutionOf(entry, locale),
                  }),
                  confirmDescription: t('confirmDescription', {
                    period: period(entry),
                  }),
                  cancel: t('cancel'),
                }}
                onEdit={() => onEdit(entry)}
                onDelete={() => deleteRow(entry.id)}
                isDeleting={pendingId === entry.id}
              />
            </div>

            {localizedValue(entry.description, locale) ? (
              // The admin's own line breaks are the only structure it has.
              <p
                className="whitespace-pre-wrap text-sm text-muted-foreground"
                dir="auto"
              >
                {localizedValue(entry.description, locale)}
              </p>
            ) : null}
          </li>
        ))}
      />
    </div>
  );
}
