import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

/**
 * Only `admin` exists today, but the role stays a real field so extra roles are
 * a data change, not an architecture change (see DATABASE.md).
 */
const USER_ROLES = ['admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      // Unique doubles as the login lookup index - the only query pattern so far.
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Never selected by default, so no generic query can leak it.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: 'admin' },
    /**
     * Bumped to invalidate every session this user holds. Tokens are stateless,
     * so without this a signed one stays usable until it expires - signing out
     * would clear the cookie and revoke nothing.
     */
    tokenVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
