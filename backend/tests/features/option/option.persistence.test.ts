import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';

const { OptionModel } =
  await import('../../../src/features/option/option.model.js');
const {
  createOption,
  listOptions,
  removeOption,
  reorderOptions,
  toOptionResponse,
  updateOption,
} = await import('../../../src/features/option/option.service.js');
const { ExperienceModel } =
  await import('../../../src/features/experience/experience.model.js');
const { seedOptions } =
  await import('../../../src/features/option/option.seed.js');
const { SEED_OPTIONS } = await import('@portfolio/shared/option-seed');

/**
 * An option list is a set of unique codes with an order and a delete that can
 * be refused. None of that is provable against a mock: the uniqueness is an
 * index, the order is written by a bulk write, and the refusal is a count of
 * rows in another collection.
 */
const URI =
  process.env.OPTION_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_option_test';

const connected = await connectOrSkip('option', URI);

const LEVEL = { code: 'bachelor', name: { en: "Bachelor's degree" } };

describe.skipIf(!connected)('option persistence', () => {
  beforeAll(async () => {
    await OptionModel.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await OptionModel.deleteMany({});
    await ExperienceModel.deleteMany({});
  });

  describe('creating an option', () => {
    it('stores it in the list it was created for', async () => {
      const row = await createOption('education-level', LEVEL);

      expect(toOptionResponse(row)).toMatchObject({
        list: 'education-level',
        code: 'bachelor',
        name: { en: "Bachelor's degree" },
        order: 0,
      });
    });

    it('refuses a second option with the same code in that list', async () => {
      await createOption('education-level', LEVEL);

      await expect(
        createOption('education-level', { ...LEVEL, name: { en: 'Licence' } }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { code: 'CODE_TAKEN' },
      });
    });

    /**
     * Two options spelled alike in one dropdown are indistinguishable to the
     * reader, whatever their codes are.
     */
    it('refuses a second option with the same name in that list', async () => {
      await createOption('education-level', LEVEL);

      await expect(
        createOption('education-level', { ...LEVEL, code: 'licence' }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { 'name.en': 'ALREADY_EXISTS' },
      });
    });

    /**
     * The lists are independent: `other` is a category, an education level and
     * a platform, and those are three different options that happen to be
     * spelled alike.
     */
    it('allows the same code in another list', async () => {
      await createOption('education-level', {
        code: 'other',
        name: { en: 'Other' },
      });

      await expect(
        createOption('skill-category', {
          code: 'other',
          name: { en: 'Other' },
        }),
      ).resolves.toMatchObject({ code: 'other' });
    });

    it('refuses a heading that is not an option in the heading list', async () => {
      await expect(
        createOption('social-platform', {
          code: 'bluesky',
          name: { en: 'Bluesky' },
          group: 'nowhere',
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { group: 'INVALID_VALUE' },
      });
    });

    it('accepts a heading that exists', async () => {
      await createOption('social-platform-group', {
        code: 'social',
        name: { en: 'Social' },
      });

      await expect(
        createOption('social-platform', {
          code: 'bluesky',
          name: { en: 'Bluesky' },
          group: 'social',
          icon: 'bluesky',
        }),
      ).resolves.toMatchObject({ group: 'social', icon: 'bluesky' });
    });
  });

  describe('editing an option', () => {
    it('renames it without touching the code rows point at', async () => {
      const created = await createOption('education-level', LEVEL);

      const updated = await updateOption('education-level', created.id, {
        name: { en: 'Bachelor', fr: 'Licence' },
      });

      expect(updated.code).toBe('bachelor');
      expect(Object.fromEntries(updated.name)).toEqual({
        en: 'Bachelor',
        fr: 'Licence',
      });
    });

    /** `PUT` replaces: a heading the edit omits is cleared, not kept. */
    it('clears a heading the edit omits', async () => {
      await createOption('social-platform-group', {
        code: 'social',
        name: { en: 'Social' },
      });
      const created = await createOption('social-platform', {
        code: 'bluesky',
        name: { en: 'Bluesky' },
        group: 'social',
      });

      const updated = await updateOption('social-platform', created.id, {
        name: { en: 'Bluesky' },
      });

      expect(updated.group).toBeUndefined();
    });

    it('keeps the original creation date', async () => {
      const created = await createOption('education-level', LEVEL);

      const updated = await updateOption('education-level', created.id, {
        name: { en: 'Bachelor' },
      });

      expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
    });

    /**
     * The list is part of the filter, not of the update. Moving an option to
     * another list would strand the rows holding its code exactly as renaming
     * the code would, so an id from elsewhere reads as "no such option".
     */
    it('answers NOT_FOUND for an id belonging to another list', async () => {
      const created = await createOption('education-level', LEVEL);

      await expect(
        updateOption('skill-category', created.id, {
          name: { en: 'Anything' },
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('answers NOT_FOUND for an id that is not an identifier', async () => {
      await expect(
        updateOption('education-level', 'not-an-id', { name: { en: 'X' } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('deleting an option', () => {
    it('removes one nothing points at', async () => {
      const created = await createOption('employment-type', {
        code: 'freelance',
        name: { en: 'Freelance' },
      });

      await removeOption(created.id);

      expect(await OptionModel.countDocuments()).toBe(0);
    });

    /**
     * The rule `expertise` already applies to a skill a project uses: cascading
     * would change what those rows display without anyone seeing it happen, and
     * clearing the field would blank a value the owner chose.
     */
    it('refuses one a stored row still holds, and says how many', async () => {
      const created = await createOption('employment-type', {
        code: 'freelance',
        name: { en: 'Freelance' },
      });

      await ExperienceModel.create({
        role: { en: 'Developer' },
        organisation: { en: 'Somewhere' },
        employmentType: 'freelance',
        startDate: '2020-01',
        current: true,
      });

      await expect(removeOption(created.id)).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { option: 'IN_USE', rows: 1 },
      });
      expect(await OptionModel.countDocuments()).toBe(1);
    });

    /** A heading is in use by the options filed under it, not by content. */
    it('refuses a heading an option still sits under', async () => {
      const group = await createOption('social-platform-group', {
        code: 'social',
        name: { en: 'Social' },
      });
      await createOption('social-platform', {
        code: 'bluesky',
        name: { en: 'Bluesky' },
        group: 'social',
      });

      await expect(removeOption(group.id)).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { option: 'IN_USE', rows: 1 },
      });
    });

    it('answers NOT_FOUND for an id nothing has', async () => {
      await expect(
        removeOption('507f1f77bcf86cd799439099'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('the order', () => {
    async function codesInOrder(list: 'education-level') {
      return (await listOptions(list)).map((row) => row.code);
    }

    it('returns the lowest position first, then alphabetically by name', async () => {
      await createOption('education-level', {
        code: 'master',
        name: { en: 'Master' },
        order: 0,
      });
      await createOption('education-level', {
        code: 'bachelor',
        name: { en: 'Bachelor' },
        order: 0,
      });
      await createOption('education-level', {
        code: 'doctorate',
        name: { en: 'Doctorate' },
        order: 5,
      });

      expect(await codesInOrder('education-level')).toEqual([
        'bachelor',
        'master',
        'doctorate',
      ]);
    });

    it('writes a whole ordering within one list', async () => {
      const a = await createOption('education-level', {
        code: 'bachelor',
        name: { en: 'Bachelor' },
      });
      const b = await createOption('education-level', {
        code: 'master',
        name: { en: 'Master' },
      });

      await reorderOptions('education-level', [b.id, a.id]);

      expect(await codesInOrder('education-level')).toEqual([
        'master',
        'bachelor',
      ]);
    });

    /**
     * Scoping the reorder to the list is what makes the shared helper's
     * completeness rule mean the right thing: without it, an ordering of one
     * list looks like an incomplete ordering of all nine.
     */
    it('accepts a complete ordering of one list while others exist', async () => {
      const a = await createOption('education-level', {
        code: 'bachelor',
        name: { en: 'Bachelor' },
      });
      await createOption('skill-category', {
        code: 'engineering',
        name: { en: 'Engineering' },
      });

      await expect(
        reorderOptions('education-level', [a.id]),
      ).resolves.toBeUndefined();
    });

    it('refuses an ordering that names an option from another list', async () => {
      const a = await createOption('education-level', {
        code: 'bachelor',
        name: { en: 'Bachelor' },
      });
      const other = await createOption('skill-category', {
        code: 'engineering',
        name: { en: 'Engineering' },
      });

      await expect(
        reorderOptions('education-level', [a.id, other.id]),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { order: 'STALE' },
      });
    });
  });

  describe('reading the lists', () => {
    it('returns every list when none is named', async () => {
      await createOption('education-level', LEVEL);
      await createOption('skill-category', {
        code: 'engineering',
        name: { en: 'Engineering' },
      });

      expect(await listOptions()).toHaveLength(2);
    });

    it('returns one list when one is named', async () => {
      await createOption('education-level', LEVEL);
      await createOption('skill-category', {
        code: 'engineering',
        name: { en: 'Engineering' },
      });

      const rows = await listOptions('skill-category');

      expect(rows.map((row) => row.code)).toEqual(['engineering']);
    });
  });
  /**
   * Filling the lists in is not the same operation as seeding content, and the
   * difference is the whole reason it has its own script: this one runs on a
   * database that already has the owner's work in it.
   */
  describe('filling the lists in', () => {
    it('adds every shipped option to an empty database', async () => {
      const added = await seedOptions();

      const expected = Object.values(SEED_OPTIONS).reduce(
        (total, options) => total + options.length,
        0,
      );

      expect(added).toBe(expected);
      expect(await OptionModel.countDocuments()).toBe(expected);
    });

    it('adds nothing on a second run', async () => {
      await seedOptions();

      expect(await seedOptions()).toBe(0);
    });

    /**
     * The property that makes it safe to run at any time. `$set` here would
     * undo every label the owner had rewritten and every list they had
     * reordered - silently, and only visible the next time they opened a form.
     */
    it('never overwrites a label the owner has edited', async () => {
      await seedOptions();

      const edited = await OptionModel.findOneAndUpdate(
        { list: 'employment-type', code: 'freelance' },
        { $set: { name: { en: 'Freelancing', fr: 'Freelancing' }, order: 99 } },
        { returnDocument: 'after' },
      );

      await seedOptions();

      const after = await OptionModel.findById(edited?._id);

      expect(after?.name.get('en')).toBe('Freelancing');
      expect(after?.order).toBe(99);
    });

    /** A list added after the first install still arrives. */
    it('adds an option that is missing while leaving the rest alone', async () => {
      await seedOptions();
      await OptionModel.deleteOne({ list: 'language-level', code: 'native' });

      expect(await seedOptions()).toBe(1);
      expect(
        await OptionModel.exists({ list: 'language-level', code: 'native' }),
      ).toBeTruthy();
    });
  });
});
