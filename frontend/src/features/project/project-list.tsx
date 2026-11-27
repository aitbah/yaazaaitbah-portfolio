'use client';

import { FolderGitIcon, ImagesIcon, LinkIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ListEmpty } from '@/components/admin/list-empty';
import { ReorderControls } from '@/components/admin/reorder-controls';
import { ReorderStatus } from '@/components/admin/reorder-status';
import { RowActions } from '@/components/admin/row-actions';
import { Thumbnail } from '@/components/admin/thumbnail';
import { useReorder } from '@/components/admin/use-reorder';
import { ShowMoreList, useShowMore } from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { localizedValue } from '@/i18n/localized-value';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';
import { usePendingRow } from '@/lib/mutations';

import type { Project } from './project-api';
import { useDeleteProject, PROJECTS_QUERY_KEY } from './use-projects';

/** The launch locale is the one every project is required to have. */
export function titleOf(project: Project, locale: string): string {
  return localizedValue(project.title, locale);
}

type ProjectListProps = {
  projects: Project[];
  onEdit: (project: Project) => void;
  /** Offered from the empty state, so a first project is one click away. */
  onAdd: () => void;
};

export function ProjectList({ projects, onEdit, onAdd }: ProjectListProps) {
  const t = useTranslations('admin.projects');
  const errorMessage = useErrorMessages();
  const locale = useLocale();

  const remove = useDeleteProject();
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  const {
    ordered,
    move,
    isReordering,
    error: orderError,
  } = useReorder({
    resource: 'projects',
    items: projects,
    queryKey: PROJECTS_QUERY_KEY,
  });

  const shown = useShowMore(
    'admin.projects',
    ordered.length,
    LIST_STEPS.admin.projects,
  );

  /**
   * A card moved past the last visible one would silently vanish, so the next
   * step opens and focus lands on it - where a keyboard user is working.
   */
  function moveCard(from: number, to: number) {
    move(from, to);
    shown.reveal(to);
  }

  if (projects.length === 0) {
    return (
      <ListEmpty
        icon={FolderGitIcon}
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

  return (
    <div className="flex flex-col gap-2">
      <ReorderStatus error={orderError} isReordering={isReordering} />

      <ErrorToast>
        {remove.error ? errorMessage.response(remove.error) : null}
      </ErrorToast>

      {/*
        Cards with their covers, not a list of titles. A project is a visual
        thing, and the cover is the field most likely to be wrong or missing -
        a row of titles is exactly where nobody notices that.
      */}
      <ShowMoreList
        className="grid gap-4 @2xl/admin-content:grid-cols-2 @5xl/admin-content:grid-cols-3 @7xl/admin-content:grid-cols-4"
        id="admin.projects"
        step={LIST_STEPS.admin.projects}
        noun="projects"
        // Built over the whole order, so each card's index - what the reorder
        // controls move - is its place in the list, not on the screen.
        items={ordered.map((project, index) => (
          <li
            key={project.id}
            className="flex flex-col overflow-hidden rounded-lg border bg-card"
          >
            <Thumbnail
              url={project.imageUrl ?? ''}
              // The stored description if there is one, and the title if not:
              // this is a thumbnail of a named thing, never a decorative image.
              alt={
                localizedValue(project.imageAlt, locale) ||
                titleOf(project, locale)
              }
              emptyLabel={t('noCover')}
              unavailableLabel={t('cover.unavailable')}
              // A card in a grid that is one, two or three columns wide.
              // The grid is one to four columns; the widths approximate that,
              // erring wide, because the container query it really follows is
              // not something `sizes` can express.
              sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 928px) 50vw, 100vw"
              // The first row - up to four covers - is above the fold, and any of
              // them can be the page's largest paint.
              priority={index < 4}
              className="aspect-video w-full rounded-t-lg border-0 border-b"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
              <div className="flex min-w-0 items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium" dir="auto">
                    {titleOf(project, locale)}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {project.featured ? (
                      <Badge>{t('featuredBadge')}</Badge>
                    ) : null}
                    <Badge variant="outline">
                      {t('stackCount', { count: project.stack.length })}
                    </Badge>
                    {/* Tolerant of a document written before the gallery
                        existed: a missing field must not blank the whole
                        list. */}
                    {(project.gallery ?? []).length > 0 ? (
                      <Badge variant="outline">
                        <ImagesIcon aria-hidden />
                        {(project.gallery ?? []).length}
                      </Badge>
                    ) : null}
                    {project.liveUrl || project.repoUrl ? (
                      <Badge variant="outline">
                        <LinkIcon aria-hidden />
                        {t('linkCount', {
                          count:
                            (project.liveUrl ? 1 : 0) +
                            (project.repoUrl ? 1 : 0),
                        })}
                      </Badge>
                    ) : null}
                  </span>
                </div>

                {/* One group, so the menu centres against the chevron pair
                    rather than lining up with only the top one. */}
                <div className="flex shrink-0 items-center gap-1">
                  <ReorderControls
                    index={index}
                    total={ordered.length}
                    label={titleOf(project, locale)}
                    onMove={moveCard}
                    disabled={isReordering}
                  />

                  <RowActions
                    labels={{
                      menu: t('actions', { name: titleOf(project, locale) }),
                      edit: t('edit'),
                      delete: t('delete'),
                      deleting: t('deleting'),
                      confirmTitle: t('confirmTitle', {
                        name: titleOf(project, locale),
                      }),
                      confirmDescription: t('confirmDescription'),
                      cancel: t('cancel'),
                    }}
                    onEdit={() => onEdit(project)}
                    onDelete={() => deleteRow(project.id)}
                    isDeleting={pendingId === project.id}
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
      />
    </div>
  );
}
