import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';

const { ExperienceModel } =
  await import('../../../src/features/experience/experience.model.js');
const { createExperience, listExperience, removeExperience, updateExperience } =
  await import('../../../src/features/experience/experience.service.js');

/**
 * These run against a real MongoDB, in a database of their own that is dropped
 * afterwards. That the compound index actually refuses a duplicate, and that
 * the sort really puts the most recent first, are only real here.
 */
const URI =
  process.env.EXPERIENCE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_experience_test';

const connected = await connectOrSkip('experience', URI);

const PAST = {
  role: { en: 'Backend Engineer' },
  organisation: { en: 'Acme' },
  employmentType: 'full-time' as const,
  startDate: '2021-03',
  endDate: '2023-06',
  current: false,
};

describe.skipIf(!connected)('experience persistence', () => {
  beforeAll(async () => {
    // The unique index is the subject of these tests, so it must be built.
    await ExperienceModel.syncIndexes();
    // Six services refuse a code no option list offers, so the lists the
    // content under test references have to exist.
    await seedOptionLists('employment-type');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ExperienceModel.deleteMany({});
  });

  describe('the compound unique key', () => {
    it('is declared on the role, the organisation and the start', async () => {
      const indexes = await ExperienceModel.collection.indexes();
      const unique = indexes.find((index) => index.unique);

      expect(unique?.key).toEqual({
        'role.en': 1,
        'organisation.en': 1,
        startDate: 1,
      });
    });

    it('refuses the same position entered twice', async () => {
      await createExperience(PAST);

      await expect(createExperience(PAST)).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { 'role.en': 'ALREADY_EXISTS' },
      });
      expect(await ExperienceModel.countDocuments()).toBe(1);
    });

    /**
     * None of the three fields is unique on its own, and treating any of them
     * as if it were would refuse a true career.
     */
    it('allows the same role at another employer', async () => {
      await createExperience(PAST);
      await createExperience({ ...PAST, organisation: { en: 'Globex' } });

      expect(await ExperienceModel.countDocuments()).toBe(2);
    });

    it('allows another role at the same employer', async () => {
      await createExperience(PAST);
      await createExperience({ ...PAST, role: { en: 'Lead Engineer' } });

      expect(await ExperienceModel.countDocuments()).toBe(2);
    });

    it('allows a second stint at the same employer', async () => {
      await createExperience(PAST);
      await createExperience({
        ...PAST,
        startDate: '2024-01',
        endDate: '2024-09',
      });

      expect(await ExperienceModel.countDocuments()).toBe(2);
    });

    // The guard is the index, not a prior read, so concurrent writes cannot
    // both slip through the way a check-then-insert would allow.
    it('lets exactly one of several concurrent creates win', async () => {
      await Promise.all(
        Array.from({ length: 6 }, () =>
          createExperience(PAST).catch(() => null),
        ),
      );

      expect(await ExperienceModel.countDocuments()).toBe(1);
    });
  });

  /**
   * A career is ordered by when things happened. There is no `order` field to
   * disagree with the dates, which is the point.
   */
  describe('the order', () => {
    it('puts the most recent first', async () => {
      await createExperience({ ...PAST, role: { en: 'Middle' } });
      await createExperience({
        ...PAST,
        role: { en: 'Oldest' },
        startDate: '2018-01',
        endDate: '2021-02',
      });
      await createExperience({
        ...PAST,
        role: { en: 'Newest' },
        startDate: '2023-07',
        endDate: undefined,
        current: true,
      });

      const roles = (await listExperience()).map((row) => row.role.get('en'));

      expect(roles).toEqual(['Newest', 'Middle', 'Oldest']);
    });

    /**
     * A current position has no `endDate`, and a missing value sorts as null.
     * Tie-breaking on a second date field would therefore put the role someone
     * still holds *below* the one they left in the same month.
     */
    it('keeps a current position above a past one that started with it', async () => {
      await createExperience({
        ...PAST,
        role: { en: 'The one that ended' },
        startDate: '2023-07',
        endDate: '2024-01',
      });
      await createExperience({
        ...PAST,
        role: { en: 'The current one' },
        startDate: '2023-07',
        endDate: undefined,
        current: true,
      });

      const roles = (await listExperience()).map((row) => row.role.get('en'));

      expect(roles[0]).toBe('The current one');
    });

    it('sorts across a year boundary, since the strings are chronological', async () => {
      await createExperience({
        ...PAST,
        role: { en: 'December' },
        startDate: '2021-12',
        endDate: '2022-03',
      });
      await createExperience({
        ...PAST,
        role: { en: 'January' },
        startDate: '2022-01',
        endDate: '2022-06',
      });

      const roles = (await listExperience()).map((row) => row.role.get('en'));

      expect(roles).toEqual(['January', 'December']);
    });
  });

  describe('replacing a position', () => {
    /**
     * `PUT` replaces, and the end date is the field that must actually go: a
     * position that becomes current cannot keep the date it used to end on.
     */
    it('clears the end date when a position becomes current', async () => {
      const created = await createExperience(PAST);

      const updated = await updateExperience(created.id, {
        ...PAST,
        endDate: undefined,
        current: true,
      });

      expect(updated.current).toBe(true);
      expect(updated.endDate ?? undefined).toBeUndefined();
    });

    it('clears an optional field that is omitted', async () => {
      const created = await createExperience({
        ...PAST,
        location: { en: 'Casablanca' },
      });

      const updated = await updateExperience(created.id, {
        ...PAST,
        location: undefined,
      });

      expect(updated.location?.size ?? 0).toBe(0);
    });

    /**
     * Nothing reads `createdAt` but the sort's tie-break, which is exactly why
     * a reset would have gone unnoticed.
     */
    it('keeps the original creation date', async () => {
      const created = await createExperience(PAST);
      const before = created.createdAt;

      const updated = await updateExperience(created.id, {
        ...PAST,
        role: { en: 'Senior Backend Engineer' },
      });

      expect(updated.createdAt.getTime()).toBe(before.getTime());
    });

    it('answers NOT_FOUND for an id nothing has', async () => {
      await expect(
        updateExperience('507f1f77bcf86cd799439099', PAST),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('answers NOT_FOUND for an id that is not an identifier', async () => {
      await expect(updateExperience('nope', PAST)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('deleting a position', () => {
    it('removes it', async () => {
      const created = await createExperience(PAST);

      await removeExperience(created.id);

      expect(await ExperienceModel.countDocuments()).toBe(0);
    });

    it('answers NOT_FOUND for an id nothing has', async () => {
      await expect(
        removeExperience('507f1f77bcf86cd799439099'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
