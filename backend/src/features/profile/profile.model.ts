import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import { localizedText } from '../../core/database/localized-text.js';

/**
 * The portfolio has exactly one profile. A constant key with a unique index makes
 * that structural rather than conventional: two concurrent upserts can no longer
 * both insert, because the second is refused by the database.
 */
export const SINGLETON_KEY = 'profile';

const profileSchema = new Schema(
  {
    key: {
      type: String,
      default: SINGLETON_KEY,
      enum: [SINGLETON_KEY],
      unique: true,
      immutable: true,
    },
    // Names are localized too: they are transliterated, not just translated.
    firstName: { ...localizedText, required: true },
    lastName: { ...localizedText, required: true },
    headline: { ...localizedText, required: true },
    bio: localizedText,
    /**
     * The one photograph: a portrait, shown at whatever size the page needs.
     *
     * It lives in object storage; only the reference is persisted (see
     * TECHNICAL-ARCHITECTURE.md).
     */
    photoUrl: { type: String, trim: true },
    photoAlt: localizedText,
    /**
     * The CV, one stored path per locale, in the same Map shape as localized
     * text. No default-locale requirement: a profile without a CV is normal.
     */
    resume: { type: Map, of: String },
    /**
     * The contact block, stored whole so each flag sits beside the value it
     * gates. The flags default to false here as in the contract, so nothing
     * becomes public without being chosen.
     */
    contact: {
      type: new Schema(
        {
          email: { type: String, trim: true },
          emailPublic: { type: Boolean, default: false },
          location: localizedText,
          locationPublic: { type: Boolean, default: false },
          availability: { type: String },
          // A status exists in order to be seen: a private "open to work" is
          // the same thing as not saying it.
          availabilityPublic: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true },
);

type Profile = InferSchemaType<typeof profileSchema>;
export type ProfileDocument = HydratedDocument<Profile>;

export const ProfileModel = model('Profile', profileSchema);
