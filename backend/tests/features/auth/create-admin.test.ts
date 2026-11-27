import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { createAdmin } from '../../../src/features/auth/auth.service.js';
import { UserModel } from '../../../src/features/auth/user.model.js';
import { ADMIN_EMAIL, ADMIN_ID } from './admin.fixture.js';

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: { create: vi.fn() },
}));

const model = UserModel as unknown as { create: Mock };

const CREDENTIALS = {
  email: ADMIN_EMAIL,
  password: 'a-sufficiently-long-password',
};

/** What MongoDB raises when a unique index rejects an insert. */
function duplicateKeyError() {
  return Object.assign(new Error('E11000 duplicate key error'), {
    code: 11000,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createAdmin', () => {
  it('stores a hashed password, never the password itself', async () => {
    model.create.mockResolvedValue({
      _id: ADMIN_ID,
      email: ADMIN_EMAIL,
      role: 'admin',
    });

    await createAdmin(CREDENTIALS);

    const written = model.create.mock.calls[0]?.[0] as {
      passwordHash: string;
    };
    expect(written.passwordHash).not.toContain(CREDENTIALS.password);
    expect(written.passwordHash.startsWith('$argon2')).toBe(true);
  });

  /**
   * The unique index is the real guard. Checking first and inserting after left
   * a race between the two, and the loser surfaced as a SERVER_ERROR - a
   * confusing answer to an ordinary "that email is taken".
   */
  it('reports an email that already exists as a conflict', async () => {
    model.create.mockRejectedValue(duplicateKeyError());

    await expect(createAdmin(CREDENTIALS)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { email: 'ALREADY_EXISTS' },
    });
  });

  it('does not disguise an unrelated failure as a conflict', async () => {
    model.create.mockRejectedValue(new Error('the database went away'));

    await expect(createAdmin(CREDENTIALS)).rejects.toThrow(
      'the database went away',
    );
  });
});
