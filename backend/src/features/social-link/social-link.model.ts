import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

const socialLinkSchema = new Schema(
  {
    // A code, never a label: the frontend owns the wording and the icon.
    platform: { type: String, required: true },
    url: { type: String, required: true, trim: true },
    // Display position, lowest first. Nothing sets it but the API yet.
    order: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

/**
 * The same link twice is a mistake. Keyed on the URL rather than the platform,
 * because two accounts on one platform is a choice someone might legitimately
 * make, while two rows pointing at the same address never is.
 */
socialLinkSchema.index({ url: 1 }, { unique: true });

/** Lowest position first, then by platform - the order the API returns. */
export const SOCIAL_LINK_SORT = { order: 1, platform: 1 } as const;

type SocialLink = InferSchemaType<typeof socialLinkSchema>;
export type SocialLinkDocument = HydratedDocument<SocialLink>;

export const SocialLinkModel = model('SocialLink', socialLinkSchema);
