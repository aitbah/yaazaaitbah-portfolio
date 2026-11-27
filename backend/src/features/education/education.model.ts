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

const educationSchema = new Schema(
  {
    institution: { ...localizedText, required: true },
    /** What the certificate says - "BSc Computer Science". */
    qualification: { ...localizedText, required: true },
    /** The subject, when the qualification's own wording does not name it. */
    fieldOfStudy: localizedText,
    // A code, never a label: the frontend owns the wording.
    level: { type: String, required: true },
    location: localizedText,
    /**
     * Months, as `YYYY-MM`, exactly as a position's are - see
     * `experience.model.ts` for why a `Date` is the wrong type for "March
     * 2021", and `checkPeriod` in `shared` for the rule tying the three
     * together.
     */
    startDate: { type: String, required: true },
    /** Absent while the course is still under way. */
    endDate: { type: String },
    current: { type: Boolean, default: false },
    description: localizedText,
  },
  { timestamps: true },
);

/**
 * The same course of study entered twice is a double submit.
 *
 * Compound, because none of the three is unique alone: one institution awards
 * many qualifications, one qualification is awarded by many institutions, and a
 * person can legitimately return to the same place for a second degree. Only
 * all three together being equal is a mistake.
 */
educationSchema.index(
  {
    [localizedPath('institution')]: 1,
    [localizedPath('qualification')]: 1,
    startDate: 1,
  },
  { unique: true },
);

/** Every read sorts by this, so it is the query pattern rather than a guess. */
educationSchema.index({ startDate: -1 });

/**
 * Most recent first, tie-broken on `createdAt` rather than on a second date
 * field: a course still under way has no `endDate`, and a missing value sorts
 * as null - which would put what someone is studying *below* what they finished
 * in the same month.
 */
export const EDUCATION_SORT = { startDate: -1, createdAt: -1 } as const;

type Education = InferSchemaType<typeof educationSchema>;
export type EducationDocument = HydratedDocument<Education>;

export const EducationModel = model('Education', educationSchema);
