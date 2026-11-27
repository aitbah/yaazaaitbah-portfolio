'use client';

import { PencilIcon, UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AsyncSection } from '@/components/admin/async-section';
import { useOptions } from '@/features/option/use-options';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useEditorKey } from '@/components/admin/use-editor';
import { ListEmpty } from '@/components/admin/list-empty';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { ProfileForm } from '@/features/profile/profile-form';
import { ProfileView } from '@/features/profile/profile-view';
import { useProfile } from '@/features/profile/use-profile';

export default function ProfilePage() {
  const t = useTranslations('admin.profile');
  const { profile, isPending, error } = useProfile();
  const options = useOptions();

  /**
   * One profile, so the key names the page rather than a row - but it is the
   * same parameter and the same Back button as every list's editor.
   */
  const { key, open, close } = useEditorKey();
  const editing = key !== null;

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          // Never an editor over an unfinished or failed read: `PUT` replaces
          // the whole document, so a form filled from nothing would overwrite a
          // profile that merely failed to load.
          !editing && !isPending && !error && profile !== null ? (
            <Button type="button" onClick={() => open('profile')}>
              <PencilIcon aria-hidden />
              {t('edit')}
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
        {editing ? (
          <EditorPanel
            title={profile === null ? t('newTitle') : t('editTitle')}
          >
            <ProfileForm
              profile={profile}
              // Back to the view, which is where the save is visible.
              onDone={close}
            />
          </EditorPanel>
        ) : profile === null ? (
          <ListEmpty
            icon={UserIcon}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={
              <Button type="button" onClick={() => open('profile')}>
                {t('create')}
              </Button>
            }
          />
        ) : (
          <ProfileView profile={profile} />
        )}
      </AsyncSection>
    </div>
  );
}
