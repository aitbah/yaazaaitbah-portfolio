'use client';

import { useLocale, useTranslations } from 'next-intl';

import { AsyncSection } from '@/components/admin/async-section';
import { useOptions } from '@/features/option/use-options';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { EducationForm } from '@/features/education/education-form';
import {
  EducationList,
  qualificationOf,
} from '@/features/education/education-list';
import { useEducation } from '@/features/education/use-education';

export default function EducationPage() {
  const t = useTranslations('admin.education');
  const locale = useLocale();
  const { entries, isPending, error } = useEducation();
  const options = useOptions();

  const { editing, edit, close } = useRowEditor(entries);

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          // Never over an unfinished or failed read: the list is how the admin
          // sees what already exists, and saving without it risks a duplicate.
          editing === null && !isPending && !error ? (
            <Button type="button" onClick={() => edit(null)}>
              {t('add')}
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
          <EducationList
            entries={entries}
            onEdit={edit}
            onAdd={() => edit(null)}
          />
        ) : (
          <EditorPanel
            title={
              editing.row
                ? t('editTitle', {
                    name: qualificationOf(editing.row, locale),
                  })
                : t('newTitle')
            }
          >
            <EducationForm
              // A fresh form per entry, so switching rows resets the inputs.
              key={editing.row?.id ?? 'new'}
              entry={editing.row}
              onDone={close}
            />
          </EditorPanel>
        )}
      </AsyncSection>
    </div>
  );
}
