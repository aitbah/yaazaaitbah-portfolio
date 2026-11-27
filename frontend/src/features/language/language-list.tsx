'use client';

import { LanguagesIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ListEmpty } from '@/components/admin/list-empty';
import { ReorderControls } from '@/components/admin/reorder-controls';
import { ReorderStatus } from '@/components/admin/reorder-status';
import { RowActions } from '@/components/admin/row-actions';
import { useReorder } from '@/components/admin/use-reorder';
import { ShowMoreList, useShowMore } from '@/components/show-more';
import { ErrorToast } from '@/components/error-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOptionLabel } from '@/features/option/use-options';
import { useErrorMessages } from '@/lib/error-messages';
import { LIST_STEPS } from '@/lib/list-steps';
import { usePendingRow } from '@/lib/mutations';

import type { Language } from './language-api';
import { languageName } from '@/i18n/language-name';
import { LANGUAGES_QUERY_KEY, useDeleteLanguage } from './use-languages';

type LanguageListProps = {
  languages: Language[];
  onEdit: (language: Language) => void;
  /** Offered from the empty state, so a first row is one click away. */
  onAdd: () => void;
};

export function LanguageList({ languages, onEdit, onAdd }: LanguageListProps) {
  const t = useTranslations('admin.languages');
  const levelLabel = useOptionLabel('language-level');
  const errorMessage = useErrorMessages();
  // The reader's locale, which is what names the languages.
  const locale = useLocale();

  const remove = useDeleteLanguage();
  const { pendingId, run: deleteRow } = usePendingRow(remove.mutate);

  const {
    ordered,
    move,
    isReordering,
    error: orderError,
  } = useReorder({
    resource: 'languages',
    items: languages,
    queryKey: LANGUAGES_QUERY_KEY,
  });

  const shown = useShowMore(
    'admin.languages',
    ordered.length,
    LIST_STEPS.admin.languages,
  );

  /** A row moved past the last visible one opens the next step rather than vanishing. */
  function moveRow(from: number, to: number) {
    move(from, to);
    shown.reveal(to);
  }

  if (languages.length === 0) {
    return (
      <ListEmpty
        icon={LanguagesIcon}
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

      {/* Short rows and few of them, so a grid rather than one long column -
          the same shape the expertise lists use. */}
      <ShowMoreList
        id={'admin.languages'}
        step={LIST_STEPS.admin.languages}
        noun={'languages'}
        className="grid gap-3 @2xl/admin-content:grid-cols-2 @5xl/admin-content:grid-cols-3"
        items={ordered.map((language, index) => {
          // Rendered, never stored: the reader's own locale names it.
          const name = languageName(language.code, locale);

          return (
            <li
              key={language.id}
              className="flex items-center gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40"
            >
              <ReorderControls
                index={index}
                total={ordered.length}
                label={name}
                onMove={moveRow}
                disabled={isReordering}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium">{name}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {levelLabel(language.level)}
                  </Badge>
                  {/* The stored value, beside the name it renders as: the code
                      is what a public page will put in a `lang` attribute. */}
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    {language.code}
                  </span>
                </span>
              </div>

              <RowActions
                labels={{
                  menu: t('actions', { name }),
                  edit: t('edit'),
                  delete: t('delete'),
                  deleting: t('deleting'),
                  confirmTitle: t('confirmTitle', { name }),
                  confirmDescription: t('confirmDescription'),
                  cancel: t('cancel'),
                }}
                onEdit={() => onEdit(language)}
                onDelete={() => deleteRow(language.id)}
                isDeleting={pendingId === language.id}
              />
            </li>
          );
        })}
      />
    </div>
  );
}
