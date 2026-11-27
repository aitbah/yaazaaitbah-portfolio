import { collectionApi } from '@/lib/collection-api';

import type { LanguageInput } from './language-schema';

/** A language as the API returns it - see docs/api-endpoints/languages-api.md. */
export type Language = {
  id: string;
  /** A BCP-47 subtag. The name is rendered from it, never stored. */
  code: string;
  level: string;
  order: number;
  updatedAt: string;
};

const languages = collectionApi<Language, LanguageInput>('/api/languages', {
  list: 'languages',
  one: 'language',
});

export const fetchLanguages = languages.list;
export const createLanguage = languages.create;
export const updateLanguage = languages.update;
export const deleteLanguage = languages.remove;
