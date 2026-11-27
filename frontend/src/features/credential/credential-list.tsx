'use client';

import { ExternalLinkIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { CredentialKind } from '@portfolio/shared';

import { ListEmpty } from '@/components/admin/list-empty';
import { RowActions } from '@/components/admin/row-actions';
import { ShowMoreList, type ShowMoreNoun } from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePendingRow } from '@/lib/mutations';
import { MONTH_FORMAT, monthAsDate } from '@/i18n/month';
import { localizedValue } from '@/i18n/localized-value';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';

import type { Credential } from './credential-api';
import { CREDENTIAL_ICONS } from './credential-kinds';
import { hasExpired } from './credential-validity';
import { useDeleteCredential } from './use-credentials';

/** The launch locale is the one every required field is guaranteed to have. */
export function nameOf(row: Credential, locale: string): string {
  return localizedValue(row.name, locale);
}

function issuerOf(row: Credential, locale: string): string {
  return localizedValue(row.issuer, locale);
}

/** What "more" is, in the control's words, for each kind. */
const KIND_NOUNS = {
  certification: 'certifications',
  course: 'courses',
} as const satisfies Record<CredentialKind, ShowMoreNoun>;

type CredentialListProps = {
  kind: CredentialKind;
  rows: Credential[];
  onEdit: (row: Credential) => void;
  /** Offered from the empty state, so a first row is one click away. */
  onAdd: () => void;
};

export function CredentialList({
  kind,
  rows,
  onEdit,
  onAdd,
}: CredentialListProps) {
  const t = useTranslations('admin.credentials');
  const tKind = useTranslations(`admin.credentials.kinds.${kind}`);
  const errorMessage = useErrorMessages();
  const locale = useLocale();
  const format = useFormatter();

  const remove = useDeleteCredential(kind);
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  if (rows.length === 0) {
    return (
      <ListEmpty
        icon={CREDENTIAL_ICONS[kind]}
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

  function month(value: string) {
    return format.dateTime(monthAsDate(value), MONTH_FORMAT);
  }

  return (
    <div className="flex flex-col gap-2">
      <ErrorToast>
        {remove.error ? errorMessage.response(remove.error) : null}
      </ErrorToast>

      {/* The same grid as the career and the education: full width, two
          balanced columns once there is room for two. */}
      <ShowMoreList
        id={`admin.${kind}`}
        step={LIST_STEPS.admin.credentials}
        noun={KIND_NOUNS[kind]}
        as="ol"
        className="grid w-full gap-3 @5xl/admin-content:grid-cols-2"
        items={rows.map((row) => {
          const expired = hasExpired(row.expiresAt);

          return (
            <li
              key={row.id}
              className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" dir="auto">
                      {nameOf(row, locale)}
                    </span>
                    {/*
                      The one thing this section does that the others do not.
                      An expired credential is stored and shown rather than
                      refused - it is a true fact about someone's history - so
                      saying which is the admin's job, not the schema's.
                    */}
                    {expired ? (
                      <Badge variant="outline">{t('expiredBadge')}</Badge>
                    ) : null}
                  </span>

                  <span className="text-sm text-muted-foreground" dir="auto">
                    {issuerOf(row, locale)}
                  </span>

                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      <time dateTime={row.issuedAt}>
                        {t('issued', { month: month(row.issuedAt) })}
                      </time>
                      {row.expiresAt ? (
                        <>
                          {' · '}
                          <time dateTime={row.expiresAt}>
                            {expired
                              ? t('expiredOn', { month: month(row.expiresAt) })
                              : t('expires', { month: month(row.expiresAt) })}
                          </time>
                        </>
                      ) : (
                        <>
                          {' · '}
                          {t('neverExpires')}
                        </>
                      )}
                    </span>

                    {row.credentialId ? (
                      <span className="truncate">
                        {t('idIs', { id: row.credentialId })}
                      </span>
                    ) : null}
                  </span>

                  {row.credentialUrl ? (
                    <a
                      href={row.credentialUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      <ExternalLinkIcon className="size-3.5" aria-hidden />
                      {t('verify')}
                    </a>
                  ) : null}
                </div>

                <RowActions
                  labels={{
                    menu: t('actions', { name: nameOf(row, locale) }),
                    edit: t('edit'),
                    delete: t('delete'),
                    deleting: t('deleting'),
                    confirmTitle: t('confirmTitle', {
                      name: nameOf(row, locale),
                      issuer: issuerOf(row, locale),
                    }),
                    confirmDescription: t('confirmDescription'),
                    cancel: t('cancel'),
                  }}
                  onEdit={() => onEdit(row)}
                  onDelete={() => deleteRow(row.id)}
                  isDeleting={pendingId === row.id}
                />
              </div>

              {localizedValue(row.description, locale) ? (
                // The admin's own line breaks are the only structure it has.
                <p
                  className="whitespace-pre-wrap text-sm text-muted-foreground"
                  dir="auto"
                >
                  {localizedValue(row.description, locale)}
                </p>
              ) : null}
            </li>
          );
        })}
      />
    </div>
  );
}
