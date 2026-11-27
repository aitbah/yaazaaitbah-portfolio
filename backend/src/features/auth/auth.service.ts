import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import type { AuthenticatedUser } from './auth.types.js';
import type {
  AdminCredentials,
  EmailChangeInput,
  LoginInput,
  PasswordChangeInput,
} from './auth.validation.js';
import { UserModel, type UserDocument } from './user.model.js';

/** MongoDB's duplicate-key error, raised by the unique index on `email`. */
const DUPLICATE_KEY = 11000;

/** Argon2id with the library's OWASP-aligned defaults. */
export function hashPassword(password: string) {
  return hash(password);
}

export function toAuthenticatedUser(user: UserDocument): AuthenticatedUser {
  return { id: user._id.toString(), email: user.email, role: user.role };
}

/**
 * A throwaway hash to verify against when the account does not exist, computed
 * once. Argon2 is deliberately slow, so returning early for an unknown email
 * would make it measurably faster than a wrong password and let an attacker
 * enumerate valid addresses despite the identical response.
 */
let absentAccountHash: Promise<string> | undefined;

function hashForAbsentAccount() {
  absentAccountHash ??= hashPassword(randomBytes(32).toString('hex'));

  return absentAccountHash;
}

export type Authenticated = {
  user: AuthenticatedUser;
  tokenVersion: number;
};

export async function authenticate({
  email,
  password,
}: LoginInput): Promise<Authenticated> {
  const user = await UserModel.findOne({ email }).select('+passwordHash');

  // Always verify, so unknown email and wrong password cost the same and answer
  // identically - no account enumeration by content or by timing.
  const stored = user?.passwordHash ?? (await hashForAbsentAccount());
  const correct = await verify(stored, password);

  if (!user || !correct) {
    throw new ApiError(ResponseCode.INVALID_CREDENTIALS);
  }

  return { user: toAuthenticatedUser(user), tokenVersion: user.tokenVersion };
}

/**
 * Invalidates every token issued to this user and answers the new version, or
 * `null` for an account that no longer exists - signing out must still clear
 * the cookie.
 */
export async function revokeSessions(userId: string): Promise<number | null> {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' },
  );

  return user?.tokenVersion ?? null;
}

/**
 * Replaces the password after verifying the current one - a stolen cookie must
 * not suffice - and revokes every session in the same update. A wrong one
 * answers `INVALID_CREDENTIALS`, as login does.
 */
export async function changePassword(
  userId: string,
  { currentPassword, newPassword }: PasswordChangeInput,
): Promise<number> {
  const user = await UserModel.findById(userId).select('+passwordHash');

  if (!user || !(await verify(user.passwordHash, currentPassword))) {
    throw new ApiError(ResponseCode.INVALID_CREDENTIALS);
  }

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: { passwordHash: await hashPassword(newPassword) },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: 'after' },
  );

  // Deleted between the two reads. Nothing to sign back in as.
  if (!updated) {
    throw new ApiError(ResponseCode.UNAUTHENTICATED);
  }

  return updated.tokenVersion;
}

/**
 * Replaces the sign-in address after verifying the current password, and
 * revokes every session in the same update, which ends a thief's session too.
 * The caller re-issues the asking one.
 */
export async function changeEmail(
  userId: string,
  { currentPassword, newEmail }: EmailChangeInput,
): Promise<number> {
  const user = await UserModel.findById(userId).select('+passwordHash');

  if (!user || !(await verify(user.passwordHash, currentPassword))) {
    throw new ApiError(ResponseCode.INVALID_CREDENTIALS);
  }

  // The unique index cannot catch this one: the row it would collide with is
  // the owner's own. Writing it anyway would report a save that changed nothing
  // and revoke every session for it.
  if (user.email === newEmail) {
    throw new ApiError(ResponseCode.VALIDATION_ERROR, {
      newEmail: 'UNCHANGED',
    });
  }

  try {
    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { email: newEmail }, $inc: { tokenVersion: 1 } },
      { returnDocument: 'after' },
    );

    // Deleted between the two reads. Nothing to sign back in as.
    if (!updated) {
      throw new ApiError(ResponseCode.UNAUTHENTICATED);
    }

    return updated.tokenVersion;
  } catch (error) {
    // A second account already holds it. The index is the guard, for the reason
    // `createAdmin` gives: checking first leaves a race.
    if ((error as { code?: number }).code === DUPLICATE_KEY) {
      throw new ApiError(ResponseCode.CONFLICT, { newEmail: 'ALREADY_EXISTS' });
    }

    throw error;
  }
}

/** Used by the one-off creation script; there is no registration endpoint. */
export async function createAdmin({
  email,
  password,
}: AdminCredentials): Promise<AuthenticatedUser> {
  try {
    const user = await UserModel.create({
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
    });

    return toAuthenticatedUser(user);
  } catch (error) {
    // The unique index is the real guard; checking first would leave a race
    // between the check and the insert that surfaced as a server error.
    if ((error as { code?: number }).code === DUPLICATE_KEY) {
      throw new ApiError(ResponseCode.CONFLICT, { email: 'ALREADY_EXISTS' });
    }

    throw error;
  }
}
