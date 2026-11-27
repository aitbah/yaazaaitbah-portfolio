import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import { LANGUAGE_CODES } from '@portfolio/shared';

const languageSchema = new Schema(
  {
    /**
     * A BCP-47 primary subtag, and the only thing stored about the name.
     *
     * `Intl.DisplayNames` renders it in the reader's own locale, so there is no
     * localized name field to fill in per language per locale - and no stored
     * English "German" to be wrong on a French page.
     */
    code: { type: String, enum: LANGUAGE_CODES, required: true },
    // A code, never a label: the frontend owns the wording.
    level: { type: String, required: true },
    /**
     * Display position, lowest first.
     *
     * The first entity since the expertise split to carry one: a language list
     * has no date to sort by, and alphabetical order would put Arabic before
     * English for reasons nobody intends. The owner decides what to lead with.
     */
    order: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

/**
 * A language is listed once or not at all.
 *
 * Unlike a credential, there is no second instance to record: two rows for
 * French is a mistake in every case, so the key is the code alone.
 */
languageSchema.index({ code: 1 }, { unique: true });

/** Lowest position first, then by code - the order the API returns. */
export const LANGUAGE_SORT = { order: 1, code: 1 } as const;

type Language = InferSchemaType<typeof languageSchema>;
export type LanguageDocument = HydratedDocument<Language>;

export const LanguageModel = model('Language', languageSchema);
