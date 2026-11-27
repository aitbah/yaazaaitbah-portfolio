'use client';

import { BriefcaseIcon, MapPinIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';

import { ListEmpty } from '@/components/admin/list-empty';
import { RowActions } from '@/components/admin/row-actions';
import { ShowMoreList } from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOptionLabel } from '@/features/option/use-options';
import { localizedValue } from '@/i18n/localized-value';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';
import { usePendingRow } from '@/lib/mutations';

import type { Experience } from './experience-api';
import { MONTH_FORMAT, monthAsDate } from '@/i18n/month';
import { useDeleteExperience } from './use-experience';

/** The launch locale is the one every required field is guaranteed to have. */
export function roleOf(position: Experience, locale: string): string {
  return localizedValue(position.role, locale);
}

function organisationOf(position: Experience, locale: string): string {
  return localizedValue(position.organisation, locale);
}

type ExperienceListProps = {
  positions: Experience[];
  onEdit: (position: Experience) => void;
  /** Offered from the empty state, so a first position is one click away. */
  onAdd: () => void;
};

/**
 * The career, most recent first.
 *
 * No reorder controls: the dates are the order. Every other admin list carries
 * arrows because its order is a choice; here a stored position that disagreed
 * with the dates would be a state the admin could not see.
 */
export function ExperienceList({
  positions,
  onEdit,
  onAdd,
}: ExperienceListProps) {
  const t = useTranslations('admin.experience');
  const typeLabel = useOptionLabel('employment-type');
  const errorMessage = useErrorMessages();
  const locale = useLocale();
  const format = useFormatter();

  const remove = useDeleteExperience();
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  if (positions.length === 0) {
    return (
      <ListEmpty
        icon={BriefcaseIcon}
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

  /** "Mar 2021 – Jun 2023", or "Mar 2021 – Present" for a current position. */
  function period(position: Experience): string {
    const from = format.dateTime(monthAsDate(position.startDate), MONTH_FORMAT);
    const to = position.endDate
      ? format.dateTime(monthAsDate(position.endDate), MONTH_FORMAT)
      : t('present');

    return `${from} – ${to}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <ErrorToast>
        {remove.error ? errorMessage.response(remove.error) : null}
      </ErrorToast>

      {/* Full width, and two columns when there is room. Ordered by date, so
          reading across first costs nothing. */}
      <ShowMoreList
        id={'admin.experience'}
        step={LIST_STEPS.admin.experience}
        noun={'experience'}
        as="ol"
        className="grid w-full gap-3 @5xl/admin-content:grid-cols-2"
        items={positions.map((position) => (
          <li
            key={position.id}
            className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium" dir="auto">
                    {roleOf(position, locale)}
                  </span>
                  {position.current ? <Badge>{t('currentBadge')}</Badge> : null}
                </span>

                <span className="text-sm text-muted-foreground" dir="auto">
                  {organisationOf(position, locale)}
                </span>

                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {/* A real `time` element per end, so the range is machine
                      readable as well as legible. */}
                  <span className="tabular-nums">
                    <time dateTime={position.startDate}>
                      {format.dateTime(
                        monthAsDate(position.startDate),
                        MONTH_FORMAT,
                      )}
                    </time>
                    {' – '}
                    {position.endDate ? (
                      <time dateTime={position.endDate}>
                        {format.dateTime(
                          monthAsDate(position.endDate),
                          MONTH_FORMAT,
                        )}
                      </time>
                    ) : (
                      t('present')
                    )}
                  </span>

                  <Badge variant="secondary">
                    {typeLabel(position.employmentType)}
                  </Badge>

                  {localizedValue(position.location, locale) ? (
                    <span className="flex items-center gap-1" dir="auto">
                      <MapPinIcon className="size-3.5" aria-hidden />
                      {localizedValue(position.location, locale)}
                    </span>
                  ) : null}
                </span>
              </div>

              <RowActions
                labels={{
                  menu: t('actions', { name: roleOf(position, locale) }),
                  edit: t('edit'),
                  delete: t('delete'),
                  deleting: t('deleting'),
                  confirmTitle: t('confirmTitle', {
                    name: roleOf(position, locale),
                    organisation: organisationOf(position, locale),
                  }),
                  confirmDescription: t('confirmDescription', {
                    period: period(position),
                  }),
                  cancel: t('cancel'),
                }}
                onEdit={() => onEdit(position)}
                onDelete={() => deleteRow(position.id)}
                isDeleting={pendingId === position.id}
              />
            </div>

            {localizedValue(position.description, locale) ? (
              // The admin's own line breaks are the only structure it has.
              <p
                className="whitespace-pre-wrap text-sm text-muted-foreground"
                dir="auto"
              >
                {localizedValue(position.description, locale)}
              </p>
            ) : null}
          </li>
        ))}
      />
    </div>
  );
}
