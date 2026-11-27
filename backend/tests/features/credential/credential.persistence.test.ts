import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CREDENTIAL_KINDS } from '@portfolio/shared';

import { connectOrSkip } from '../../support/mongo.js';

const { CredentialModel } =
  await import('../../../src/features/credential/credential.model.js');
const {
  createCredential,
  listCredentials,
  removeCredential,
  updateCredential,
} = await import('../../../src/features/credential/credential.service.js');

/**
 * Its own database, named after this suite: two suites sharing one each drop it
 * in `afterAll`, which is a flake that fails differently every time.
 *
 * That the per-kind compound index actually refuses a duplicate, and that one
 * kind's resource cannot reach the other's rows, are only real here.
 */
const URI =
  process.env.CREDENTIAL_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_credential_test';

const connected = await connectOrSkip('credential', URI);

const CERT = {
  name: { en: 'AWS Certified Developer' },
  issuer: { en: 'Amazon Web Services' },
  issuedAt: '2023-04',
  expiresAt: '2026-04',
};

describe.skipIf(!connected)('credential persistence', () => {
  beforeAll(async () => {
    // The unique index is the subject of these tests, so it must be built.
    await CredentialModel.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await CredentialModel.deleteMany({});
  });

  describe('the compound unique key', () => {
    it('is declared per kind, on the name, the issuer and the issue date', async () => {
      const indexes = await CredentialModel.collection.indexes();
      const unique = indexes.find((index) => index.unique);

      expect(unique?.key).toEqual({
        kind: 1,
        'name.en': 1,
        'issuer.en': 1,
        issuedAt: 1,
      });
    });

    it('refuses the same credential twice within one kind', async () => {
      await createCredential('certification', CERT);

      await expect(
        createCredential('certification', CERT),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { 'name.en': 'ALREADY_EXISTS' },
      });
      expect(await CredentialModel.countDocuments()).toBe(1);
    });

    /**
     * The key is per kind, so the two lists are really separate: a course and
     * a certification of the same name are two different claims.
     */
    it('allows the same name as the other kind', async () => {
      await createCredential('certification', CERT);
      await createCredential('course', CERT);

      expect(await CredentialModel.countDocuments()).toBe(2);
    });

    it('allows the same credential earned again later', async () => {
      await createCredential('certification', CERT);
      await createCredential('certification', {
        ...CERT,
        issuedAt: '2026-04',
        expiresAt: '2029-04',
      });

      expect(await CredentialModel.countDocuments()).toBe(2);
    });

    // The guard is the index, not a prior read, so concurrent writes cannot
    // both slip through the way a check-then-insert would allow.
    it('lets exactly one of several concurrent creates win', async () => {
      await Promise.all(
        Array.from({ length: 6 }, () =>
          createCredential('certification', CERT).catch(() => null),
        ),
      );

      expect(await CredentialModel.countDocuments()).toBe(1);
    });
  });

  describe('the two lists stay apart', () => {
    it('lists only its own kind', async () => {
      await createCredential('certification', CERT);
      await createCredential('course', { ...CERT, name: { en: 'A course' } });

      const certifications = await listCredentials('certification');
      const courses = await listCredentials('course');

      expect(certifications).toHaveLength(1);
      expect(certifications[0]?.name.get('en')).toBe('AWS Certified Developer');
      expect(courses).toHaveLength(1);
      expect(courses[0]?.name.get('en')).toBe('A course');
    });

    it('refuses to update a row belonging to the other kind', async () => {
      const created = await createCredential('certification', CERT);

      await expect(
        updateCredential('course', created.id, CERT),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      // And it is still there, unchanged.
      expect(
        await CredentialModel.countDocuments({ kind: 'certification' }),
      ).toBe(1);
    });

    it('refuses to delete a row belonging to the other kind', async () => {
      const created = await createCredential('certification', CERT);

      await expect(
        removeCredential('course', created.id),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(await CredentialModel.countDocuments()).toBe(1);
    });
  });

  describe('the order', () => {
    it('puts the most recently issued first', async () => {
      await createCredential('certification', {
        ...CERT,
        name: { en: 'Middle' },
      });
      await createCredential('certification', {
        ...CERT,
        name: { en: 'Oldest' },
        issuedAt: '2019-01',
        expiresAt: undefined,
      });
      await createCredential('certification', {
        ...CERT,
        name: { en: 'Newest' },
        issuedAt: '2025-06',
        expiresAt: undefined,
      });

      const names = (await listCredentials('certification')).map((row) =>
        row.name.get('en'),
      );

      expect(names).toEqual(['Newest', 'Middle', 'Oldest']);
    });
  });

  /**
   * An expired credential is a true fact about someone's history. Refusing it
   * would be refusing the truth, and the whole reason `checkPeriod` is not
   * reused here.
   */
  describe('an expiry', () => {
    it('stores one that is already in the past', async () => {
      const created = await createCredential('certification', {
        ...CERT,
        issuedAt: '2016-01',
        expiresAt: '2019-01',
      });

      expect(created.expiresAt).toBe('2019-01');
    });

    it('stores a credential with none at all', async () => {
      const created = await createCredential('certification', {
        ...CERT,
        expiresAt: undefined,
      });

      expect(created.expiresAt ?? undefined).toBeUndefined();
    });

    /** `PUT` replaces, so a credential that stops expiring must lose the date. */
    it('is cleared when the replacement omits it', async () => {
      const created = await createCredential('certification', CERT);

      const updated = await updateCredential('certification', created.id, {
        ...CERT,
        expiresAt: undefined,
      });

      expect(updated.expiresAt ?? undefined).toBeUndefined();
    });
  });

  describe('replacing a credential', () => {
    it('clears an optional field that is omitted', async () => {
      const created = await createCredential('certification', {
        ...CERT,
        credentialId: 'ABC-123',
      });

      const updated = await updateCredential('certification', created.id, {
        ...CERT,
        credentialId: undefined,
      });

      expect(updated.credentialId ?? '').toBe('');
    });

    /**
     * Nothing reads `createdAt` but the sort's tie-break, which is exactly why
     * a reset would have gone unnoticed.
     */
    it('keeps the original creation date', async () => {
      const created = await createCredential('certification', CERT);
      const before = created.createdAt;

      const updated = await updateCredential('certification', created.id, {
        ...CERT,
        issuer: { en: 'AWS' },
      });

      expect(updated.createdAt.getTime()).toBe(before.getTime());
    });
  });

  /** The database is the last guard against a row that is neither kind. */
  describe('the kind enum', () => {
    it('refuses a value the schema does not know', async () => {
      const row = new CredentialModel({ ...CERT, kind: 'certification' });

      row.set('kind', 'diploma');

      await expect(row.validate()).rejects.toThrow();
    });

    it('accepts every kind the contract declares', async () => {
      for (const kind of CREDENTIAL_KINDS) {
        const row = new CredentialModel({ ...CERT, kind });

        await expect(row.validate()).resolves.toBeUndefined();
      }
    });
  });
});
