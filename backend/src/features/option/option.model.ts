import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import { OPTION_LISTS } from '@portfolio/shared';

import {
  localizedPath,
  localizedText,
} from '../../core/database/localized-text.js';

const optionSchema = new Schema(
  {
    /**
     * Which dropdown this option belongs to. Every list shares one shape, so
     * one collection; the enum stays in code because the application reads each
     * list by name.
     */
    list: { type: String, enum: OPTION_LISTS, required: true },
    /**
     * The value rows actually store, and never rewritten - `optionCode` in
     * `shared/src/option-lists.ts` records why.
     */
    code: { type: String, required: true },
    name: { ...localizedText, required: true },
    /**
     * The heading this option sits under, as a code from another list.
     *
     * Only the platform list uses it. A heading is an option like any other, so
     * it is translated and reordered by the same screen rather than by a
     * developer.
     */
    group: { type: String },
    /**
     * A vendored brand mark, by slug. Presets only - nothing here owns a file,
     * so nothing here has to be swept up when a row goes.
     */
    icon: { type: String },
    // Display position within its own list, lowest first.
    order: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

/**
 * A code is what a row points at, so two options in one list cannot share one.
 *
 * Scoped to the list, because the lists are independent: `other` is a category,
 * an education level and a platform, and those are three different options that
 * happen to be spelled alike.
 */
optionSchema.index({ list: 1, code: 1 }, { unique: true });

/**
 * Two options with the same label are indistinguishable in the dropdown they
 * appear in, which is a mistake even when their codes differ. Keyed on the
 * default locale, the one every row is required to carry.
 */
optionSchema.index({ list: 1, [localizedPath('name')]: 1 }, { unique: true });

/** Every list is read by list, and every read is sorted. */
optionSchema.index({ list: 1, order: 1 });

/** Lowest position first, then alphabetically - the order the API returns. */
export const OPTION_SORT = {
  order: 1,
  [localizedPath('name')]: 1,
} as const;

type Option = InferSchemaType<typeof optionSchema>;
export type OptionDocument = HydratedDocument<Option>;

export const OptionModel = model('Option', optionSchema);
