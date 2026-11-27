import { OPTION_LISTS, type OptionListKey } from '@portfolio/shared';

import { OptionModel } from '../../src/features/option/option.model.js';
import { SEED_OPTIONS } from '@portfolio/shared/option-seed';

/**
 * Fills a test database with the option lists the code under test references.
 *
 * Six services now refuse a category, a level, a type or a platform that no
 * option list offers - which is the whole point of the feature, and which means
 * a suite creating content against an empty database is creating content
 * against lists with nothing in them.
 *
 * Seeded from the real `SEED_OPTIONS` rather than from a handful of codes
 * written out here, so a suite cannot pass against a list the application does
 * not actually ship.
 */
export async function seedOptionLists(
  ...lists: readonly OptionListKey[]
): Promise<void> {
  const wanted = lists.length > 0 ? lists : OPTION_LISTS;

  for (const list of wanted) {
    await OptionModel.deleteMany({ list });
    await OptionModel.insertMany(
      SEED_OPTIONS[list].map((option, index) => ({
        list,
        code: option.code,
        name: option.name,
        group: option.group,
        icon: option.icon,
        order: index,
      })),
    );
  }
}
