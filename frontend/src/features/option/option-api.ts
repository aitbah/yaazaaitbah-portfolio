import type { OptionListKey } from '@portfolio/shared';

import { collectionApi } from '@/lib/collection-api';

import type { OptionInput } from './option-schema';

/** An option as the API returns it - see docs/api-endpoints/options-api.md. */
export type Option = {
  id: string;
  list: OptionListKey;
  /** What rows store. Fixed at creation: see `option-schema.ts`. */
  code: string;
  name: Record<string, string>;
  /** A code from this list's heading list, on the one list that has them. */
  group?: string;
  /** A vendored brand slug, on the one list that has them. */
  icon?: string;
  order: number;
  updatedAt: string;
};

const options = collectionApi<Option, OptionInput, OptionEdit>('/api/options', {
  list: 'options',
  one: 'option',
});

/**
 * Every list in one request.
 *
 * Nine dropdowns are spread over six screens, and a query per dropdown would be
 * a request per screen for a payload smaller than a single photograph. One
 * cached answer serves all of them, and one invalidation refreshes all of them.
 */
export const fetchOptions = options.list;
export const createOption = options.create;
export const deleteOption = options.remove;

/**
 * Everything an edit may touch, which is everything but the code.
 *
 * Stripped here rather than by each caller: the API answers `NOT_ALLOWED` for a
 * code in an edit, deliberately, and a form that holds one - every edit form
 * does, because the code is shown - would otherwise send it.
 */
type OptionEdit = Omit<OptionInput, 'code'>;

function withoutCode(input: OptionInput): OptionEdit {
  const { code, ...editable } = input;
  void code;

  return editable;
}

/** Replaces everything an edit may touch, as PUT implies. */
export function updateOption(id: string, input: OptionInput): Promise<Option> {
  return options.update(id, withoutCode(input));
}
