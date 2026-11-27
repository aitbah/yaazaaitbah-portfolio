import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';

const { EducationModel } =
  await import('../../../src/features/education/education.model.js');
const { createEducation, listEducation, removeEducation, updateEducation } =
  await import('../../../src/features/education/education.service.js');

/**
 * These run against a real MongoDB, in a database of their own that is dropped
 * afterwards - its own, and named after this suite: two suites sharing one
 * database each drop it in `afterAll`, which is a flake that fails differently
 * every time.
 *
 * That the compound index actually refuses a duplicate, and that the sort really
 * puts the most recent first, are only real here.
 */
const URI =
  process.env.EDUCATION_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_education_test';

const connected = await connectOrSkip('education', URI);

const DEGREE = {
  institution: { en: 'University of Casablanca' },
  qualification: { en: 'BSc Computer Science' },
  level: 'bachelor' as const,
  startDate: '2015-09',
  endDate: '2018-06',
  current: false,
};

describe.skipIf(!connected)('education persistence', () => {
  beforeAll(async () => {
    // The unique index is the subject of these tests, so it must be built.
    await EducationModel.syncIndexes();
    // Six services refuse a code no option list offers, so the lists the
    // content under test references have to exist.
    await seedOptionLists('education-level');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await EducationModel.deleteMany({});
  });

  describe('the compound unique key', () => {
    it('is declared on the institution, the qualification and the start', async () => {
      const indexes = await EducationModel.collection.indexes();
      const unique = indexes.find((index) => index.unique);

      expect(unique?.key).toEqual({
        'institution.en': 1,
        'qualification.en': 1,
        startDate: 1,
      });
    });

    it('refuses the same entry twice', async () => {
      await createEducation(DEGREE);

      await expect(createEducation(DEGREE)).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { 'institution.en': 'ALREADY_EXISTS' },
      });
      expect(await EducationModel.countDocuments()).toBe(1);
    });

    /**
     * None of the three fields is unique on its own, and treating any of them
     * as if it were would refuse a true history.
     */
    it('allows the same qualification from another institution', async () => {
      await createEducation(DEGREE);
      await createEducation({
        ...DEGREE,
        institution: { en: 'University of Rabat' },
      });

      expect(await EducationModel.countDocuments()).toBe(2);
    });

    it('allows another qualification from the same institution', async () => {
      await createEducation(DEGREE);
      await createEducation({
        ...DEGREE,
        qualification: { en: 'MSc Computer Science' },
      });

      expect(await EducationModel.countDocuments()).toBe(2);
    });

    it('allows returning to the same course later', async () => {
      await createEducation(DEGREE);
      await createEducation({
        ...DEGREE,
        startDate: '2022-09',
        endDate: '2023-06',
      });

      expect(await EducationModel.countDocuments()).toBe(2);
    });

    // The guard is the index, not a prior read, so concurrent writes cannot
    // both slip through the way a check-then-insert would allow.
    it('lets exactly one of several concurrent creates win', async () => {
      await Promise.all(
        Array.from({ length: 6 }, () =>
          createEducation(DEGREE).catch(() => null),
        ),
      );

      expect(await EducationModel.countDocuments()).toBe(1);
    });
  });

  describe('the order', () => {
    it('puts the most recent first', async () => {
      await createEducation({ ...DEGREE, qualification: { en: 'Middle' } });
      await createEducation({
        ...DEGREE,
        qualification: { en: 'Oldest' },
        startDate: '2012-09',
        endDate: '2015-06',
      });
      await createEducation({
        ...DEGREE,
        qualification: { en: 'Newest' },
        startDate: '2019-09',
        endDate: undefined,
        current: true,
      });

      const names = (await listEducation()).map((row) =>
        row.qualification.get('en'),
      );

      expect(names).toEqual(['Newest', 'Middle', 'Oldest']);
    });

    /**
     * A course under way has no `endDate`, and a missing value sorts as null.
     * Tie-breaking on a second date field would put what someone is studying
     * *below* what they finished in the same month.
     */
    it('keeps a current course above one that ended, given the same start', async () => {
      await createEducation({
        ...DEGREE,
        qualification: { en: 'The one that ended' },
        startDate: '2019-09',
        endDate: '2021-06',
      });
      await createEducation({
        ...DEGREE,
        qualification: { en: 'The current one' },
        startDate: '2019-09',
        endDate: undefined,
        current: true,
      });

      const names = (await listEducation()).map((row) =>
        row.qualification.get('en'),
      );

      expect(names[0]).toBe('The current one');
    });
  });

  describe('replacing an entry', () => {
    /**
     * `PUT` replaces, and the end date is the field that must actually go: an
     * entry that becomes current cannot keep the date it used to end on.
     */
    it('clears the end date when a course becomes current', async () => {
      const created = await createEducation(DEGREE);

      const updated = await updateEducation(created.id, {
        ...DEGREE,
        endDate: undefined,
        current: true,
      });

      expect(updated.current).toBe(true);
      expect(updated.endDate ?? undefined).toBeUndefined();
    });

    it('clears an optional field that is omitted', async () => {
      const created = await createEducation({
        ...DEGREE,
        fieldOfStudy: { en: 'Computer Science' },
      });

      const updated = await updateEducation(created.id, {
        ...DEGREE,
        fieldOfStudy: undefined,
      });

      expect(updated.fieldOfStudy?.size ?? 0).toBe(0);
    });

    /**
     * Nothing reads `createdAt` but the sort's tie-break, which is exactly why
     * a reset would have gone unnoticed.
     */
    it('keeps the original creation date', async () => {
      const created = await createEducation(DEGREE);
      const before = created.createdAt;

      const updated = await updateEducation(created.id, {
        ...DEGREE,
        qualification: { en: 'BSc Software Engineering' },
      });

      expect(updated.createdAt.getTime()).toBe(before.getTime());
    });

    it('answers NOT_FOUND for an id nothing has', async () => {
      await expect(
        updateEducation('507f1f77bcf86cd799439099', DEGREE),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('deleting an entry', () => {
    it('removes it', async () => {
      const created = await createEducation(DEGREE);

      await removeEducation(created.id);

      expect(await EducationModel.countDocuments()).toBe(0);
    });

    it('answers NOT_FOUND for an id nothing has', async () => {
      await expect(
        removeEducation('507f1f77bcf86cd799439099'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  /**
   * The level no longer has a path enum: the levels are rows in the
   * `education-level` option list, so what the schema would have to enumerate
   * is not known when the schema is compiled. The guard that replaced it lives
   * in the service, where the lists can actually be read - see
   * `option.reference.test.ts`.
   */
});
