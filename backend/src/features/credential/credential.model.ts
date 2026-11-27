import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import { CREDENTIAL_KINDS } from '@portfolio/shared';

import {
  localizedPath,
  localizedText,
} from '../../core/database/localized-text.js';

const credentialSchema = new Schema(
  {
    /**
     * Which of the two this is.
     *
     * Required with no default, and set by the **route** rather than the body:
     * `/api/courses` can only ever create a course. A row without a kind is not
     * a valid anything.
     */
    kind: { type: String, enum: CREDENTIAL_KINDS, required: true },
    name: { ...localizedText, required: true },
    /** Who issued it - an awarding body, a platform, a university. */
    issuer: { ...localizedText, required: true },
    /**
     * Months, as `YYYY-MM`, for the reason `experience.model.ts` sets out.
     *
     * A credential is a point in time rather than a period, so there is no
     * `current`: an absent `expiresAt` means "does not expire", not "still
     * under way".
     */
    issuedAt: { type: String, required: true },
    expiresAt: { type: String },
    /** What the issuer printed on it, and what a reader checks against. */
    credentialId: { type: String, trim: true },
    /** Where it can be verified - the issuer's own page, never an upload. */
    credentialUrl: { type: String, trim: true },
    description: localizedText,
  },
  { timestamps: true },
);

/**
 * The same credential entered twice is a double submit.
 *
 * Per kind, and compound: a certification and a course can share a name, one
 * issuer awards many credentials, and the same credential can legitimately be
 * earned again on a later date.
 */
credentialSchema.index(
  {
    kind: 1,
    [localizedPath('name')]: 1,
    [localizedPath('issuer')]: 1,
    issuedAt: 1,
  },
  { unique: true },
);

/** Every read filters by kind and sorts by date, so that is the query pattern. */
credentialSchema.index({ kind: 1, issuedAt: -1 });

/**
 * Most recent first, tie-broken on `createdAt` so the order is deterministic
 * for two credentials issued in the same month.
 */
export const CREDENTIAL_SORT = { issuedAt: -1, createdAt: -1 } as const;

type Credential = InferSchemaType<typeof credentialSchema>;
export type CredentialDocument = HydratedDocument<Credential>;

export const CredentialModel = model('Credential', credentialSchema);
