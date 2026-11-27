'use client';

import { useLocale, useTranslations } from 'next-intl';

import { AsyncSection } from '@/components/admin/async-section';
import { useOptions } from '@/features/option/use-options';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { ExperienceForm } from '@/features/experience/experience-form';
import { ExperienceList, roleOf } from '@/features/experience/experience-list';
import { useExperience } from '@/features/experience/use-experience';

export default function ExperiencePage() {
  const t = useTranslations('admin.experience');
  const locale = useLocale();
  const { positions, isPending, error } = useExperience();
  const options = useOptions();

  const { editing, edit, close } = useRowEditor(positions);

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
          <ExperienceList
            positions={positions}
            onEdit={edit}
            onAdd={() => edit(null)}
          />
        ) : (
          <EditorPanel
            title={
              editing.row
                ? t('editTitle', { name: roleOf(editing.row, locale) })
                : t('newTitle')
            }
          >
            <ExperienceForm
              // A fresh form per position, so switching rows resets the inputs.
              key={editing.row?.id ?? 'new'}
              position={editing.row}
              onDone={close}
            />
          </EditorPanel>
        )}
      </AsyncSection>
    </div>
  );
}
