import type { Mock } from 'vitest';

import { hashPassword } from '../../../src/features/auth/auth.service.js';
import { UserModel } from '../../../src/features/auth/user.model.js';

export const ADMIN_ID = '507f1f77bcf86cd799439011';
export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'correct-horse-battery';

export type FakeAdmin = {
  _id: string;
  email: string;
  role: 'admin';
  passwordHash: string;
  /** The session guard compares it with the token's, so it must be present. */
  tokenVersion: number;
};

let cached: FakeAdmin | undefined;

/** Hashing is deliberately slow, so the fixture is built once per test file. */
export async function buildAdmin(): Promise<FakeAdmin> {
  cached ??= {
    _id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: 'admin',
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    tokenVersion: 0,
  };

  return cached;
}

/** A stand-in for a Mongoose query: awaitable, and `.select()`-able. */
function query(admin: FakeAdmin | null) {
  return {
    select: () => Promise.resolve(admin),
    then: (
      resolve: (value: FakeAdmin | null) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(admin).then(resolve, reject),
  };
}

/**
 * Points the mocked model at a single admin (or at nobody). Cast once here so
 * the tests themselves stay free of Mongoose query typing.
 */
export function stubUserLookup(admin: FakeAdmin | null) {
  const model = UserModel as unknown as {
    findOne: Mock;
    findById: Mock;
    findByIdAndUpdate: Mock;
  };

  model.findOne.mockReturnValue(query(admin));
  // A Mongoose query is awaitable *and* chainable, and both are used: the
  // session guard awaits it directly, while changing a password asks for the
  // hash the schema hides by default.
  model.findById.mockReturnValue(query(admin));
  // Signing out and changing a password both bump the stored version.
  model.findByIdAndUpdate?.mockResolvedValue(admin);
}
