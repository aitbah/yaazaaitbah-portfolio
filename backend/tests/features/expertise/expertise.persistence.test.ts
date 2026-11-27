import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';

const { ExpertiseModel } =
  await import('../../../src/features/expertise/expertise.model.js');
const { createExpertise, listExpertise, removeExpertise, updateExpertise } =
  await import('../../../src/features/expertise/expertise.service.js');

/** Every call names its kind; these read as the technology list unless said. */
const create = (input: Parameters<typeof createExpertise>[1]) =>
  createExpertise('technology', input);
const update = (id: string, input: Parameters<typeof updateExpertise>[2]) =>
  updateExpertise('technology', id, input);
const remove = (id: string) => removeExpertise('technology', id);
const list = () => listExpertise('technology');

/**
 * These run against a real MongoDB, in a database of their own that is dropped
 * afterwards. The mocked suite can only prove the service calls Mongoose as
 * intended; that the unique index actually refuses a duplicate, and that the
 * sort is the one the index and the API agree on, are only real here.
 */
const URI =
  process.env.EXPERTISE_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_expertise_test';

const connected = await connectOrSkip('expertise', URI);

const VALID = {
  name: { en: 'TypeScript' },
  category: 'frontend' as const,
  level: 80,
  order: 0,
};

describe.skipIf(!connected)('expertise persistence', () => {
  beforeAll(async () => {
    // The unique index is the subject of these tests, so it must be built.
    await ExpertiseModel.syncIndexes();
    // Six services refuse a code no option list offers, so the lists the
    // content under test references have to exist.
    await seedOptionLists(
      'skill-category',
      'technology-category',
      'tool-category',
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ExpertiseModel.deleteMany({});
  });

  describe('the unique name', () => {
    /**
     * Scoped to the kind: a tool called `Testing` and a skill called `Testing`
     * are two different claims, and refusing the second would refuse a true
     * one.
     */
    it('declares a unique index on the kind and the launch locale', async () => {
      const indexes = await ExpertiseModel.collection.indexes();
      const unique = indexes.find((index) => index.unique);

      expect(unique?.key).toEqual({ kind: 1, 'name.en': 1 });
    });

    it('refuses a second row of the same kind with the same English name', async () => {
      await create(VALID);

      await expect(create({ ...VALID, level: 10 })).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { 'name.en': 'ALREADY_EXISTS' },
      });
      expect(await ExpertiseModel.countDocuments()).toBe(1);
    });

    // The guard is the index, not a prior read, so concurrent writes cannot
    // both slip through the way a check-then-insert would allow.
    it('lets exactly one of several concurrent creates win', async () => {
      const writes = Array.from({ length: 6 }, () =>
        create(VALID).catch(() => null),
      );

      await Promise.all(writes);

      expect(await ExpertiseModel.countDocuments()).toBe(1);
    });

    // Translations of one skill are not a second skill, and two different
    // skills may well share a translation.
    it('does not collide on a locale other than the launch one', async () => {
      await create({ ...VALID, name: { en: 'TypeScript', ar: 'برمجة' } });
      await create({ ...VALID, name: { en: 'Docker', ar: 'برمجة' } });

      expect(await ExpertiseModel.countDocuments()).toBe(2);
    });

    it('refuses to rename a skill onto another skill’s name', async () => {
      const first = await create(VALID);
      await create({ ...VALID, name: { en: 'Docker' } });

      await expect(
        update(first.id, { ...VALID, name: { en: 'Docker' } }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('what the database enforces', () => {
    it('stores the localized name as a map, so a locale is data', async () => {
      const skill = await create({
        ...VALID,
        name: { en: 'TypeScript', ar: 'تايب سكريبت' },
      });

      const stored = await ExpertiseModel.findById(skill._id);

      expect(stored?.name.get('ar')).toBe('تايب سكريبت');
    });

    it('rejects a level outside the percentage range', async () => {
      await expect(create({ ...VALID, level: 101 })).rejects.toThrow();
    });

    /**
     * The database cannot check the category *against the kind* - a path enum
     * has no view of its own document under `findOneAndUpdate` - but it still
     * refuses a value no kind knows at all. The kind-specific rule is proved in
     * the validation suite.
     */
    it('rejects a category no kind knows', async () => {
      await expect(
        // Bypasses the request schema on purpose: the database is the last
        // guard, and it must hold on its own.
        create({ ...VALID, category: 'nonsense' }),
      ).rejects.toThrow();
    });

    it('rejects a name without the launch locale', async () => {
      await expect(
        // Bypasses the request schema on purpose, like the category above: the
        // schema would refuse this at compile time, and the point is that the
        // database refuses it too.
        create({
          ...VALID,
          name: { ar: 'برمجة' } as unknown as { en: string },
        }),
      ).rejects.toThrow();
    });
  });

  describe('updating', () => {
    it('changes the fields it is given', async () => {
      const skill = await create(VALID);

      const updated = await update(skill.id, {
        ...VALID,
        level: 95,
        order: 3,
      });

      expect(updated.level).toBe(95);
      expect(updated.order).toBe(3);
    });

    /**
     * A replacement document carries no `createdAt`, and Mongoose fills the
     * missing one in with the current time - so editing a skill a month after
     * making it silently reset its creation date to today, unrecoverably.
     */
    it('keeps the original creation date', async () => {
      const skill = await create(VALID);
      const madeAMonthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

      await ExpertiseModel.collection.updateOne(
        { _id: skill._id },
        { $set: { createdAt: madeAMonthAgo } },
      );

      const updated = await update(skill.id, { ...VALID, level: 95 });

      expect(updated.createdAt.getTime()).toBe(madeAMonthAgo.getTime());
    });

    it('still moves the modification date forward', async () => {
      const skill = await create(VALID);
      const before = skill.updatedAt.getTime();

      await ExpertiseModel.collection.updateOne(
        { _id: skill._id },
        { $set: { updatedAt: new Date(before - 60_000) } },
      );

      const updated = await update(skill.id, { ...VALID, level: 95 });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(before - 60_000);
    });

    // The database is the last guard and must hold on its own, whatever the
    // request schema already refused.
    it('refuses a level outside the range on update too', async () => {
      const skill = await create(VALID);

      await expect(
        update(skill.id, { ...VALID, level: 101 }),
      ).rejects.toThrow();
    });
  });

  describe('display order', () => {
    it('returns the lowest position first, then alphabetically', async () => {
      await create({ ...VALID, name: { en: 'Zod' }, order: 0 });
      await create({ ...VALID, name: { en: 'Docker' }, order: 0 });
      await create({ ...VALID, name: { en: 'Express' }, order: 5 });
      await create({ ...VALID, name: { en: 'Ansible' }, order: 9 });

      const names = (await list()).map((skill) => skill.name.get('en'));

      expect(names).toEqual(['Docker', 'Zod', 'Express', 'Ansible']);
    });

    // "Row" rather than "skill": `create` here makes a technology, and has
    // since the expertise split. The category has to be one of that kind's own
    // now, because the service checks it against `technology-category`.
    it('defaults a new row to the front position', async () => {
      const row = await create({
        name: { en: 'Docker' },
        category: 'infrastructure',
        level: 60,
        order: 0,
      });

      expect(row.order).toBe(0);
    });
  });

  describe('removal', () => {
    it('deletes the skill and leaves the others alone', async () => {
      const doomed = await create(VALID);
      await create({ ...VALID, name: { en: 'Docker' } });

      await remove(doomed.id);

      const names = (await list()).map((skill) => skill.name.get('en'));

      expect(names).toEqual(['Docker']);
    });

    it('answers NOT_FOUND when the skill is already gone', async () => {
      const skill = await create(VALID);
      await remove(skill.id);

      await expect(remove(skill.id)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
