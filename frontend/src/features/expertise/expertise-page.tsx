'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ExpertiseKind } from '@portfolio/shared';

import { AsyncSection } from '@/components/admin/async-section';
import { useOptions } from '@/features/option/use-options';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';

import { ExpertiseForm } from './expertise-form';
import { ExpertiseList, nameOf } from './expertise-list';
import { useExpertise } from './use-expertise';

/**
 * The whole page for one kind.
 *
 * Three routes render this with a different `kind`, rather than one page with
 * a filter: skills, technologies and tools are three sections of the site, so
 * they are three sections of the admin, with their own URL, their own heading
 * and their own empty state.
 */
export function ExpertisePage({ kind }: { kind: ExpertiseKind }) {
  const t = useTranslations('admin.expertise');
  const locale = useLocale();
  const tKind = useTranslations(`admin.expertise.kinds.${kind}`);
  const { rows, isPending, error } = useExpertise(kind);
  const options = useOptions();

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

      {/* The option lists are folded into this page's own read, so by the time
          the list or the form renders, the labels behind every dropdown are in
          the cache and can be read without a loading state of their own. */}
      <AsyncSection
        isPending={isPending || options.isPending}
        error={error ?? options.error}
        loadingLabel={t('loading')}
      >
        {editing === null ? (
          <ExpertiseList
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
            <ExpertiseForm
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
