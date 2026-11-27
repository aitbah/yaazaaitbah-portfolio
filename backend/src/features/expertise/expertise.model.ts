import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import {
  EXPERTISE_KINDS,
  MAX_EXPERTISE_LEVEL,
  MIN_EXPERTISE_LEVEL,
} from '@portfolio/shared';

import {
  localizedPath,
  localizedText,
} from '../../core/database/localized-text.js';

const expertiseSchema = new Schema(
  {
    /**
     * Which of the three this row is. They share one shape, so one collection;
     * required with no default, so a bug cannot write the wrong kind.
     */
    kind: { type: String, enum: EXPERTISE_KINDS, required: true },
    name: { ...localizedText, required: true },
    /**
     * A code from this kind's category list. Checked in the service, which
     * knows the kind and the current lists; a schema enum could do neither.
     */
    category: { type: String, required: true },
    // A percentage. `required` rather than defaulted, because 0 is a real
    // answer and a default would hide the field never being filled in.
    level: {
      type: Number,
      required: true,
      min: MIN_EXPERTISE_LEVEL,
      max: MAX_EXPERTISE_LEVEL,
      validate: { validator: Number.isInteger },
    },
    /**
     * The logo: a preset slug or one of our own image paths, never user SVG.
     * One nested object, so both cannot be set; absent means none, always for a
     * skill.
     */
    icon: {
      type: {
        kind: { type: String, enum: ['preset', 'upload'], required: true },
        value: { type: String, required: true, trim: true },
      },
      required: false,
      // Without this Mongoose treats the nested object as always-present and
      // stores `{}`, which reads back as a logo that cannot be drawn.
      default: undefined,
      _id: false,
    },
    // Display position within its own kind, lowest first.
    order: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'expertise' },
);

/**
 * Two rows of the same kind called the same thing are a mistake, not a choice.
 *
 * Scoped to the kind, because the three are separate lists to the reader: a
 * tool called `Testing` and a skill called `Testing` are two different claims,
 * and refusing the second would be refusing a true one. Keyed on the launch
 * locale, which is the one every row is required to have.
 */
expertiseSchema.index(
  { kind: 1, [localizedPath('name')]: 1 },
  { unique: true },
);

/** Every list is read by kind, and every read is sorted. */
expertiseSchema.index({ kind: 1, order: 1 });

/** Lowest position first, then alphabetically - the order the API returns. */
export const EXPERTISE_SORT = {
  order: 1,
  [localizedPath('name')]: 1,
} as const;

type Expertise = InferSchemaType<typeof expertiseSchema>;
export type ExpertiseDocument = HydratedDocument<Expertise>;

export const ExpertiseModel = model('Expertise', expertiseSchema);
