import { OPTION_LISTS } from '@portfolio/shared';
import { SEED_OPTIONS } from '@portfolio/shared/option-seed';

import type { Option } from '../../src/features/option/option-api';

/**
 * The option lists as the API would return them.
 *
 * Built from the data a fresh install is actually seeded with, rather than from
 * a handful of rows written out here - so a test asserting that a row reads
 * "Bachelor's degree" is asserting what the application really ships, and would
 * notice if that label changed.
 *
 * Every screen with a dropdown now reads these, so every page test needs them.
 */
export const OPTION_ROWS: Option[] = OPTION_LISTS.flatMap((list) =>
  SEED_OPTIONS[list].map((option, index) => ({
    id: `${list}-${option.code}`,
    list,
    code: option.code,
    name: option.name,
    group: option.group,
    icon: option.icon,
    order: index,
    updatedAt: '2026-09-07T10:00:00.000Z',
  })),
);

/**
 * The reply to `/api/options`, or `null` for any other request.
 *
 * Each page test stubs `fetch` with its own single-resource answer; this is the
 * one branch they all have to grow, so it lives here rather than being written
 * out ten times.
 */
export function optionsReply(url: string) {
  if (!url.includes('/api/options')) {
    return null;
  }

  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ code: 'SUCCESS', details: { options: OPTION_ROWS } }),
  };
}
