'use client';

import { useQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';

import {
  createLanguage,
  deleteLanguage,
  fetchLanguages,
  updateLanguage,
} from './language-api';
import type { LanguageInput } from './language-schema';

/** Exported so the reorder hook invalidates the same list it reordered. */
export const LANGUAGES_QUERY_KEY = ['languages'] as const;

export function useLanguages() {
  const { data, isPending, error } = useQuery({
    queryKey: LANGUAGES_QUERY_KEY,
    queryFn: fetchLanguages,
  });

  return { languages: data ?? [], isPending, error };
}

export function useCreateLanguage() {
  return useInvalidatingMutation(
    LANGUAGES_QUERY_KEY,
    (input: LanguageInput) => createLanguage(input),
    'created',
  );
}

export function useUpdateLanguage() {
  return useInvalidatingMutation(
    LANGUAGES_QUERY_KEY,
    ({ id, input }: { id: string; input: LanguageInput }) =>
      updateLanguage(id, input),
    'saved',
  );
}

export function useDeleteLanguage() {
  return useInvalidatingMutation(
    LANGUAGES_QUERY_KEY,
    (id: string) => deleteLanguage(id),
    'deleted',
  );
}
