'use client';

import { useTranslations } from 'next-intl';

import { AsyncSection } from '@/components/admin/async-section';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { SocialLinkForm } from '@/features/social-link/social-link-form';
import { SocialLinkList } from '@/features/social-link/social-link-list';
import { useSocialLinks } from '@/features/social-link/use-social-links';
import { useOptionLabel, useOptions } from '@/features/option/use-options';

export default function SocialLinksPage() {
  const t = useTranslations('admin.socialLinks');
  const platformLabel = useOptionLabel('social-platform');
  const { socialLinks, isPending, error } = useSocialLinks();
  const options = useOptions();

  const { editing, edit, close } = useRowEditor(socialLinks);

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
          the list or the form renders, the platform labels are in the cache and
          can be read without a loading state of their own. */}
      <AsyncSection
        isPending={isPending || options.isPending}
        error={error ?? options.error}
        loadingLabel={t('loading')}
      >
        {editing === null ? (
          <SocialLinkList
            socialLinks={socialLinks}
            onEdit={edit}
            onAdd={() => edit(null)}
          />
        ) : (
          <EditorPanel
            title={
              editing.row
                ? t('editTitle', {
                    name: platformLabel(editing.row.platform),
                  })
                : t('newTitle')
            }
          >
            <SocialLinkForm
              // A fresh form per link, so switching rows resets the inputs.
              key={editing.row?.id ?? 'new'}
              link={editing.row}
              onDone={close}
            />
          </EditorPanel>
        )}
      </AsyncSection>
    </div>
  );
}
