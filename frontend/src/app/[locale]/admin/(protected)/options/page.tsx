'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { OPTION_LISTS, type OptionListKey } from '@portfolio/shared';

import { AsyncSection } from '@/components/admin/async-section';
import { EditorPanel } from '@/components/admin/editor-panel';
import { useRowEditor } from '@/components/admin/use-editor';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OptionForm } from '@/features/option/option-form';
import { OptionList } from '@/features/option/option-list';
import { useOptions } from '@/features/option/use-options';
import { localizedValue } from '@/i18n/localized-value';

/**
 * Nine lists behind one entry, with a chooser, rather than nine sidebar entries
 * for something rarely opened. The chosen list is a filter, so it is state; the
 * open editor is a location, so it is in the URL.
 */
export default function OptionsPage() {
  const t = useTranslations('admin.options');
  const tList = useTranslations('admin.options.lists');
  const locale = useLocale();

  const { options, isPending, error } = useOptions();
  const [chosen, setChosen] = useState<OptionListKey>(OPTION_LISTS[0]);
  const { editing, edit, close, closeWithoutHistory } = useRowEditor(options);

  /**
   * An open editor brings its own list: a link or a reload can land on an
   * option from a list the chooser is not showing, and saving must not move it
   * into that one.
   */
  const list = editing?.row?.list ?? chosen;

  const shown = options.filter((option) => option.list === list);

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

      <div className="flex flex-col gap-2 @lg/admin-content:max-w-xs">
        <Label htmlFor="option-list">{t('fields.list')}</Label>
        <Select
          value={list}
          onValueChange={(next) => {
            // Closed on the way out: an editor left open would be showing a
            // form for a list that is no longer on screen. Without a history
            // entry, because this is the page correcting itself rather than the
            // reader closing something - Back would otherwise reopen an editor
            // for a row the chooser no longer shows.
            closeWithoutHistory();
            setChosen(next as OptionListKey);
          }}
        >
          <SelectTrigger id="option-list" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTION_LISTS.map((key) => (
              <SelectItem key={key} value={key}>
                {tList(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AsyncSection
        isPending={isPending}
        error={error}
        loadingLabel={t('loading')}
      >
        {editing === null ? (
          <OptionList
            list={list}
            options={shown}
            onEdit={edit}
            onAdd={() => edit(null)}
          />
        ) : (
          <EditorPanel
            title={
              editing.row
                ? t('editTitle', {
                    name: localizedValue(editing.row.name, locale),
                  })
                : t('newTitle', { list: tList(list) })
            }
          >
            <OptionForm
              // A fresh form per row, so switching rows resets the inputs.
              key={editing.row?.id ?? `new-${list}`}
              list={list}
              option={editing.row}
              onDone={close}
            />
          </EditorPanel>
        )}
      </AsyncSection>
    </div>
  );
}
