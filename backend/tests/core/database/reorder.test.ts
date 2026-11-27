import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';

const { ExpertiseModel } =
  await import('../../../src/features/expertise/expertise.model.js');
const { applyOrder } = await import('../../../src/core/database/reorder.js');
const { createExpertise, listExpertise } =
  await import('../../../src/features/expertise/expertise.service.js');

/**
 * Reordering writes positions, so it can only be proved against a real
 * database: a mock cannot show that the stored order changed, nor that nothing
 * else did.
 */
const URI =
  process.env.REORDER_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_reorder_test';

const connected = await connectOrSkip('reorder', URI);

const BASE = { category: 'frontend' as const, level: 50, order: 0 };

describe.skipIf(!connected)('applying an order', () => {
  beforeAll(async () => {
    await ExpertiseModel.syncIndexes();
    // Six services refuse a code no option list offers, so the lists the
    // content under test references have to exist.
    await seedOptionLists('technology-category', 'tool-category');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ExpertiseModel.deleteMany({});
  });

  async function seed(names: string[]) {
    const created = [];

    for (const name of names) {
      created.push(
        await createExpertise('technology', { ...BASE, name: { en: name } }),
      );
    }

    return created;
  }

  async function namesInOrder() {
    return (await listExpertise('technology')).map((row) => row.name.get('en'));
  }

  it('stores the positions the list gives', async () => {
    const [a, b, c] = await seed(['Alpha', 'Beta', 'Gamma']);

    await applyOrder(ExpertiseModel, [c!.id, a!.id, b!.id]);

    expect(await namesInOrder()).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('numbers them from zero, with no gaps', async () => {
    const [a, b, c] = await seed(['Alpha', 'Beta', 'Gamma']);

    await applyOrder(ExpertiseModel, [c!.id, a!.id, b!.id]);

    expect((await listExpertise('technology')).map((row) => row.order)).toEqual(
      [0, 1, 2],
    );
  });

  // A reorder must not be a way to change anything else about a row.
  it('changes nothing but the position', async () => {
    const [a, b] = await seed(['Alpha', 'Beta']);
    const before = await ExpertiseModel.findById(a!._id);

    await applyOrder(ExpertiseModel, [b!.id, a!.id]);

    const after = await ExpertiseModel.findById(a!._id);

    expect(after?.name.get('en')).toBe(before?.name.get('en'));
    expect(after?.level).toBe(before?.level);
    expect(after?.category).toBe(before?.category);
    expect(after?.createdAt.getTime()).toBe(before?.createdAt.getTime());
  });

  it('moves the modification date forward', async () => {
    const [a, b] = await seed(['Alpha', 'Beta']);
    const before = (await ExpertiseModel.findById(a!._id))!.updatedAt.getTime();

    await ExpertiseModel.collection.updateOne(
      { _id: a!._id },
      { $set: { updatedAt: new Date(before - 60_000) } },
    );

    await applyOrder(ExpertiseModel, [b!.id, a!.id]);

    expect(
      (await ExpertiseModel.findById(a!._id))?.updatedAt.getTime(),
    ).toBeGreaterThan(before - 60_000);
  });

  describe('a list that does not match what is stored', () => {
    /**
     * A row missing from the list would keep its old position and be silently
     * wrong; a row that is not there at all means the client is working from a
     * page that has since changed.
     */
    it('refuses a list that omits a row', async () => {
      const [a] = await seed(['Alpha', 'Beta']);

      await expect(applyOrder(ExpertiseModel, [a!.id])).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { order: 'STALE' },
      });

      expect(await namesInOrder()).toEqual(['Alpha', 'Beta']);
    });

    it('refuses a list naming a row that does not exist', async () => {
      const [a] = await seed(['Alpha']);
      const absent = new mongoose.Types.ObjectId().toString();

      await expect(
        applyOrder(ExpertiseModel, [a!.id, absent]),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('refuses a list with the same row twice', async () => {
      const [a, b] = await seed(['Alpha', 'Beta']);

      await expect(
        applyOrder(ExpertiseModel, [a!.id, a!.id, b!.id]),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { order: 'DUPLICATE' },
      });
    });

    // Nothing is written unless the whole list is acceptable.
    it('writes nothing at all when it refuses', async () => {
      const [a, b, c] = await seed(['Alpha', 'Beta', 'Gamma']);
      await applyOrder(ExpertiseModel, [c!.id, b!.id, a!.id]);

      await expect(applyOrder(ExpertiseModel, [a!.id])).rejects.toThrow();

      expect(await namesInOrder()).toEqual(['Gamma', 'Beta', 'Alpha']);
    });
  });

  /**
   * One collection holds three independent lists. Without a scope, an ordering
   * of every technology looks like an incomplete ordering of all three and is
   * refused as stale - and a list mixing kinds looks complete.
   */
  describe('within one list of several', () => {
    async function seedTool(name: string) {
      return createExpertise('tool', {
        ...BASE,
        category: 'devops',
        name: { en: name },
      });
    }

    it('accepts a complete ordering of one kind while others exist', async () => {
      const [a, b] = await seed(['Alpha', 'Beta']);
      await seedTool('Docker');

      await applyOrder(ExpertiseModel, [b!.id, a!.id], { kind: 'technology' });

      expect(await namesInOrder()).toEqual(['Beta', 'Alpha']);
    });

    it('refuses an ordering that names a row of another kind', async () => {
      const [a] = await seed(['Alpha']);
      const tool = await seedTool('Docker');

      await expect(
        applyOrder(ExpertiseModel, [a!.id, tool.id], { kind: 'technology' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('leaves the other kinds alone', async () => {
      const [a, b] = await seed(['Alpha', 'Beta']);
      const tool = await seedTool('Docker');

      await applyOrder(ExpertiseModel, [b!.id, a!.id], { kind: 'technology' });

      const stored = await ExpertiseModel.findById(tool.id);
      expect(stored?.order).toBe(0);
    });
  });
});
