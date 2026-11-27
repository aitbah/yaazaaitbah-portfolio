import { OPTION_LISTS } from '@portfolio/shared';

import { SEED_OPTIONS } from '@portfolio/shared/option-seed';
import { OptionModel } from './option.model.js';

/**
 * Fills in the option lists without overwriting any: they are a starting point
 * the owner edits, so `$setOnInsert` adds new options and leaves existing ones
 * alone. Driven by the registry, so a forgotten list is a type error. Returns
 * how many it added.
 */
export async function seedOptions(): Promise<number> {
  let added = 0;

  for (const list of OPTION_LISTS) {
    for (const [index, option] of SEED_OPTIONS[list].entries()) {
      const result = await OptionModel.updateOne(
        { list, code: option.code },
        {
          $setOnInsert: {
            name: option.name,
            group: option.group,
            icon: option.icon,
            order: index,
          },
        },
        { upsert: true },
      );

      added += result.upsertedCount;
    }
  }

  return added;
}
