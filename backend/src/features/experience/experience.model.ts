import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import {
  localizedPath,
  localizedText,
} from '../../core/database/localized-text.js';

const experienceSchema = new Schema(
  {
    role: { ...localizedText, required: true },
    organisation: { ...localizedText, required: true },
    location: localizedText,
    // A code, never a label: the frontend owns the wording.
    employmentType: { type: String, required: true },
    /**
     * Months, `YYYY-MM`: a CV's precision, sortable as text, and free of the
     * timezone shift a `Date` would bring.
     */
    startDate: { type: String, required: true },
    /** Absent for a current position; the validation ties the two together. */
    endDate: { type: String },
    current: { type: Boolean, default: false },
    description: localizedText,
  },
  { timestamps: true },
);

/**
 * The same position entered twice is a double submit, not a career.
 *
 * Compound, because none of the three fields is unique on its own: one role at
 * two employers, two roles at one employer and two stints at the same employer
 * are all legitimate. Only all three together being equal is a mistake.
 */
experienceSchema.index(
  {
    [localizedPath('role')]: 1,
    [localizedPath('organisation')]: 1,
    startDate: 1,
  },
  { unique: true },
);

/** Every read sorts by this, so it is the query pattern rather than a guess. */
experienceSchema.index({ startDate: -1 });

/**
 * Most recent first. `createdAt` breaks a tie rather than a second date field:
 * a current position has no `endDate`, and a missing value sorts as null, which
 * would put the role someone still holds *below* the one they left.
 */
export const EXPERIENCE_SORT = { startDate: -1, createdAt: -1 } as const;

type Experience = InferSchemaType<typeof experienceSchema>;
export type ExperienceDocument = HydratedDocument<Experience>;

export const ExperienceModel = model('Experience', experienceSchema);
