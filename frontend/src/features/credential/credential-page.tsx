'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { CredentialKind } from '@portfolio/shared';

import { AsyncSection } from '@/components/admin/async-section';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';

import { CredentialForm } from './credential-form';
import { CredentialList, nameOf } from './credential-list';
import { useCredentials } from './use-credentials';

/**
 * The whole page for one kind.
 *
 * Two routes render this with a different `kind`, rather than one page with a
 * filter - the same arrangement the three expertise pages use, and for the same
 * reason: certifications and courses are two sections of the site, so they are
 * two sections of the admin.
 */
export function CredentialPage({ kind }: { kind: CredentialKind }) {
  const t = useTranslations('admin.credentials');
  const locale = useLocale();
  const tKind = useTranslations(`admin.credentials.kinds.${kind}`);
  const { rows, isPending, error } = useCredentials(kind);

  const { editing, edit, close } = useRowEditor(rows);

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        title={tKind('title')}
        description={tKind('description')}
        action={
          // Never over an unfinished or failed read: the list is how the admin
          // sees what already exists, and saving without it risks a duplicate.
          editing === null && !isPending && !error ? (
            <Button type="button" onClick={() => edit(null)}>
              {tKind('add')}
            </Button>
          ) : null
        }
      />

      <AsyncSection
        isPending={isPending}
        error={error}
        loadingLabel={t('loading')}
      >
        {editing === null ? (
          <CredentialList
            kind={kind}
            rows={rows}
            onEdit={edit}
            onAdd={() => edit(null)}
          />
        ) : (
          <EditorPanel
            title={
              editing.row
                ? t('editTitle', { name: nameOf(editing.row, locale) })
                : tKind('newTitle')
            }
          >
            <CredentialForm
              // A fresh form per row, so switching rows resets the inputs.
              key={editing.row?.id ?? 'new'}
              kind={kind}
              row={editing.row}
              onDone={close}
            />
          </EditorPanel>
        )}
      </AsyncSection>
    </div>
  );
}
