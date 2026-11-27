import { verify } from '@node-rs/argon2';
import { describe, expect, it } from 'vitest';

import { hashPassword } from '../../../src/features/auth/auth.service.js';

const PASSWORD = 'correct-horse-battery';

describe('hashPassword', () => {
  it('produces an Argon2id hash, never the plaintext', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(hash).not.toContain(PASSWORD);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('salts each hash, so the same password hashes differently', async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword(PASSWORD);

    expect(await verify(hash, PASSWORD)).toBe(true);
    expect(await verify(hash, 'not-the-password')).toBe(false);
  });
});
