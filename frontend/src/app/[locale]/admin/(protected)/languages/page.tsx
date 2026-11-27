'use client';

import { useLocale, useTranslations } from 'next-intl';

import { AsyncSection } from '@/components/admin/async-section';
import { useOptions } from '@/features/option/use-options';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { LanguageForm } from '@/features/language/language-form';
import { LanguageList } from '@/features/language/language-list';
import { languageName } from '@/i18n/language-name';
import { useLanguages } from '@/features/language/use-languages';

export default function LanguagesPage() {
  const t = useTranslations('admin.languages');
  const locale = useLocale();
  const { languages, isPending, error } = useLanguages();
  const options = useOptions();

  const { editing, edit, close } = useRowEditor(languages);

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
          <LanguageList
            languages={languages}
            onEdit={edit}
            onAdd={() => edit(null)}
          />
        ) : (
          <EditorPanel
            title={
              editing.row
                ? t('editTitle', {
                    name: languageName(editing.row.code, locale),
                  })
                : t('newTitle')
            }
          >
            <LanguageForm
              // A fresh form per row, so switching rows resets the inputs.
              key={editing.row?.id ?? 'new'}
              language={editing.row}
              onDone={close}
            />
          </EditorPanel>
        )}
      </AsyncSection>
    </div>
  );
}
