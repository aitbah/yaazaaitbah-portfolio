'use client';

import { useLocale, useTranslations } from 'next-intl';

import { AsyncSection } from '@/components/admin/async-section';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { ProjectForm } from '@/features/project/project-form';
import { ProjectList, titleOf } from '@/features/project/project-list';
import { useProjects } from '@/features/project/use-projects';
import { nameOf } from '@/features/expertise/expertise-list';
import { useExpertise } from '@/features/expertise/use-expertise';

export default function ProjectsPage() {
  const t = useTranslations('admin.projects');
  const locale = useLocale();
  const { projects, isPending, error } = useProjects();
  /**
   * A project's stack is technologies and tools - never skills, which is why
   * two lists are read rather than one. Both have to have loaded before the
   * form can offer anything.
   */
  const technologies = useExpertise('technology');
  const tools = useExpertise('tool');

  const { editing, edit, close } = useRowEditor(projects);

  const loading = isPending || technologies.isPending || tools.isPending;
  const failure = error ?? technologies.error ?? tools.error;
  const options = [...technologies.rows, ...tools.rows];

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          // Never over an unfinished or failed read: the list is how the admin
          // sees what exists, and the stack is what the form offers to link.
          editing === null && !loading && !failure ? (
            <Button type="button" onClick={() => edit(null)}>
              {t('add')}
            </Button>
          ) : null
        }
      />

      <AsyncSection
        isPending={loading}
        error={failure}
        loadingLabel={t('loading')}
      >
        {editing === null ? (
          <ProjectList
            projects={projects}
            onEdit={edit}
            onAdd={() => edit(null)}
          />
        ) : (
          <EditorPanel
            title={
              editing.row
                ? t('editTitle', { name: titleOf(editing.row, locale) })
                : t('newTitle')
            }
          >
            <ProjectForm
              // A fresh form per project, so switching rows resets the inputs.
              key={editing.row?.id ?? 'new'}
              project={editing.row}
              options={options}
              // Bound to the reader's locale here, because the picker takes
              // a name and the page is what knows which language to ask for.
              nameOf={(row) => nameOf(row, locale)}
              onDone={close}
            />
          </EditorPanel>
        )}
      </AsyncSection>
    </div>
  );
}
