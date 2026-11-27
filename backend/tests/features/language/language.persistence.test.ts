import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LANGUAGE_CODES } from '@portfolio/shared';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';

const { LanguageModel } =
  await import('../../../src/features/language/language.model.js');
const { createLanguage, listLanguages, removeLanguage, reorderLanguages } =
  await import('../../../src/features/language/language.service.js');

/** Its own database, named after this suite, dropped afterwards. */
const URI =
  process.env.LANGUAGE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_language_test';

const connected = await connectOrSkip('language', URI);

describe.skipIf(!connected)('language persistence', () => {
  beforeAll(async () => {
    // The unique index is the subject of these tests, so it must be built.
    await LanguageModel.syncIndexes();
    // Six services refuse a code no option list offers, so the lists the
    // content under test references have to exist.
    await seedOptionLists('language-level');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await LanguageModel.deleteMany({});
  });

  describe('the unique code', () => {
    it('is declared on the code alone', async () => {
      const indexes = await LanguageModel.collection.indexes();
      const unique = indexes.find((index) => index.unique);

      expect(unique?.key).toEqual({ code: 1 });
    });

    /** Two rows for French is a mistake in every case. */
    it('refuses the same language twice, whatever the level', async () => {
      await createLanguage({ code: 'fr', level: 'c1' });

      await expect(
        createLanguage({ code: 'fr', level: 'b2' }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { code: 'CODE_TAKEN' },
      });
      expect(await LanguageModel.countDocuments()).toBe(1);
    });

    it('allows a different language at the same level', async () => {
      await createLanguage({ code: 'fr', level: 'c1' });
      await createLanguage({ code: 'es', level: 'c1' });

      expect(await LanguageModel.countDocuments()).toBe(2);
    });

    // The guard is the index, not a prior read.
    it('lets exactly one of several concurrent creates win', async () => {
      await Promise.all(
        Array.from({ length: 6 }, () =>
          createLanguage({ code: 'de', level: 'b1' }).catch(() => null),
        ),
      );

      expect(await LanguageModel.countDocuments()).toBe(1);
    });
  });

  /**
   * The first entity since the expertise split to carry an `order`, so this is
   * where the shared reorder helper is proved against a fourth caller.
   */
  describe('the order', () => {
    async function threeLanguages() {
      const ar = await createLanguage({ code: 'ar', level: 'native' });
      const en = await createLanguage({ code: 'en', level: 'c1' });
      const fr = await createLanguage({ code: 'fr', level: 'c2' });

      return { ar, en, fr };
    }

    it('returns them in the stored order, not alphabetically', async () => {
      const { ar, en, fr } = await threeLanguages();

      await reorderLanguages([en.id, fr.id, ar.id]);

      const codes = (await listLanguages()).map((row) => row.code);

      expect(codes).toEqual(['en', 'fr', 'ar']);
    });

    it('refuses an ordering that omits a row', async () => {
      const { ar, en } = await threeLanguages();

      await expect(reorderLanguages([en.id, ar.id])).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { order: 'STALE' },
      });
    });

    it('refuses an ordering naming the same row twice', async () => {
      const { en } = await threeLanguages();

      await expect(
        reorderLanguages([en.id, en.id, en.id]),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { order: 'DUPLICATE' },
      });
    });

    /** A reorder must move rows and change nothing else about them. */
    it('touches nothing but the position', async () => {
      const { ar, en, fr } = await threeLanguages();
      const before = await LanguageModel.findById(en.id);

      await reorderLanguages([fr.id, en.id, ar.id]);

      const after = await LanguageModel.findById(en.id);

      expect(after?.level).toBe(before?.level);
      expect(after?.code).toBe(before?.code);
      expect(after?.createdAt.getTime()).toBe(before?.createdAt.getTime());
      expect(after?.order).toBe(1);
    });
  });

  describe('deleting a language', () => {
    it('removes it', async () => {
      const created = await createLanguage({ code: 'it', level: 'a2' });

      await removeLanguage(created.id);

      expect(await LanguageModel.countDocuments()).toBe(0);
    });

    it('answers NOT_FOUND for an id nothing has', async () => {
      await expect(
        removeLanguage('507f1f77bcf86cd799439099'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  /** The database is the last guard against a subtag the picker never offered. */
  describe('the code enum', () => {
    it('refuses a subtag the contract does not list', async () => {
      const row = new LanguageModel({ code: 'fr', level: 'c1' });

      row.set('code', 'xx');

      await expect(row.validate()).rejects.toThrow();
    });

    it('accepts every code the contract declares', async () => {
      for (const code of LANGUAGE_CODES) {
        const row = new LanguageModel({ code, level: 'b1' });

        await expect(row.validate()).resolves.toBeUndefined();
      }
    });

    /**
     * There is no matching test for the *level*: the levels are rows in the
     * `language-level` option list now, and the service checks them against it.
     * The code is different - a BCP-47 subtag is a fact about the world rather
     * than a list the owner curates, so it stays an enum here.
     */
  });
});
