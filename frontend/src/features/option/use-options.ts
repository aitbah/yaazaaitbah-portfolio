'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  OPTION_LIST_SHAPES,
  type OptionListKey,
  type OptionListShape,
} from '@portfolio/shared';

import { localizedValue } from '@/i18n/localized-value';
import { useInvalidatingMutation } from '@/lib/mutations';

import {
  createOption,
  deleteOption,
  fetchOptions,
  updateOption,
  type Option,
} from './option-api';
import type { OptionInput } from './option-schema';

/** Exported so the reorder hook invalidates the same list it reordered. */
export const OPTIONS_QUERY_KEY = ['options'] as const;

/**
 * Every option list, as one query.
 *
 * A page that renders any dropdown reads this and folds it into the loading
 * state it already has, so by the time a form or a list renders the labels are
 * in the cache and the children can read them synchronously.
 */
export function useOptions() {
  const { data, isPending, error } = useQuery({
    queryKey: OPTIONS_QUERY_KEY,
    queryFn: fetchOptions,
  });

  return { options: data ?? [], isPending, error };
}

/** One list, in the order the owner chose. */
export function useOptionList(list: OptionListKey): Option[] {
  const { options } = useOptions();

  return useMemo(
    () => options.filter((option) => option.list === list),
    [options, list],
  );
}

/**
 * What to call a stored code, in the reader's locale.
 *
 * The replacement for `useTranslations('admin.experience.types')` and the seven
 * other namespaces like it. The fallback is the code itself rather than a blank:
 * a row holding a code whose option has gone should read as *something*, and the
 * code is the only true thing left to say about it.
 */
export function useOptionLabel(
  list: OptionListKey,
): (code: string | undefined) => string {
  const options = useOptionList(list);
  const locale = useLocale();

  return useMemo(() => {
    const names = new Map(
      options.map((option) => [
        option.code,
        localizedValue(option.name, locale),
      ]),
    );

    return (code) => (code ? (names.get(code) ?? code) : '');
  }, [options, locale]);
}

/** One list as `SelectField` options, labelled in the reader's locale. */
export function useOptionChoices(
  list: OptionListKey,
): { value: string; label: string }[] {
  const options = useOptionList(list);
  const locale = useLocale();

  return useMemo(
    () =>
      options.map((option) => ({
        value: option.code,
        label: localizedValue(option.name, locale),
      })),
    [options, locale],
  );
}

/**
 * One list as named runs of options, for a list too long to scan flat.
 *
 * The headings are options too, in their own list and in their own order, so
 * the runs come out in the order the owner put them in. An option with no
 * heading is not dropped - that would make it unpickable, which is a worse
 * answer than a run at the end saying it has not been filed.
 */
export function useGroupedOptionChoices(
  list: OptionListKey,
): { label: string; options: { value: string; label: string }[] }[] {
  const t = useTranslations('admin.options');
  const locale = useLocale();
  const options = useOptionList(list);
  // Widened from the literal, whose members do not all carry the key.
  const shape: OptionListShape = OPTION_LIST_SHAPES[list];
  const groupedBy = shape.groupedBy;
  const headings = useOptionList(groupedBy ?? list);
  const ungroupedLabel = t('ungrouped');

  return useMemo(() => {
    if (!groupedBy) {
      return [];
    }

    const runs = headings.map((heading) => ({
      label: localizedValue(heading.name, locale),
      options: options
        .filter((option) => option.group === heading.code)
        .map((option) => ({
          value: option.code,
          label: localizedValue(option.name, locale),
        })),
    }));

    const loose = options
      .filter((option) => !headings.some((h) => h.code === option.group))
      .map((option) => ({
        value: option.code,
        label: localizedValue(option.name, locale),
      }));

    return [
      ...runs.filter((run) => run.options.length > 0),
      ...(loose.length > 0 ? [{ label: ungroupedLabel, options: loose }] : []),
    ];
  }, [groupedBy, headings, options, locale, ungroupedLabel]);
}

/**
 * The brand mark a stored code carries, for the one list that has them.
 *
 * The map from platform to logo used to be written out in the frontend, which
 * meant a platform the owner added could never have one. It is a field on the
 * option now.
 */
export function useOptionIcon(
  list: OptionListKey,
): (code: string | undefined) => string | undefined {
  const options = useOptionList(list);

  return useMemo(() => {
    const icons = new Map(options.map((option) => [option.code, option.icon]));

    return (code) => (code ? icons.get(code) : undefined);
  }, [options]);
}

export function useCreateOption() {
  return useInvalidatingMutation(
    OPTIONS_QUERY_KEY,
    (input: OptionInput) => createOption(input),
    'created',
  );
}

export function useUpdateOption() {
  return useInvalidatingMutation(
    OPTIONS_QUERY_KEY,
    ({ id, input }: { id: string; input: OptionInput }) =>
      updateOption(id, input),
    'saved',
  );
}

export function useDeleteOption() {
  return useInvalidatingMutation(
    OPTIONS_QUERY_KEY,
    (id: string) => deleteOption(id),
    'deleted',
  );
}
