import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';

const { syncModelIndexes } =
  await import('../../../src/core/database/sync-indexes.js');

/** Its own database, named after this suite, dropped afterwards. */
const URI =
  process.env.SYNC_INDEXES_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_sync_indexes_test';

const connected = await connectOrSkip('sync-indexes', URI);

/**
 * A model of this file's own, rather than a real one: the subject is what
 * happens to an index the schema has stopped declaring, and provoking that on a
 * real model would mean editing its schema from a test.
 */
const schema = new mongoose.Schema({
  code: { type: String, required: true },
  order: { type: Number, default: 0 },
});

schema.index({ code: 1 }, { unique: true });

const Widget = mongoose.model('SyncIndexesWidget', schema);

/**
 * A second one, so "every registered model" is a claim with something to
 * distinguish it from "the first registered model". With one model the
 * assertion held even when the function returned a single entry.
 */
const Gadget = mongoose.model(
  'SyncIndexesGadget',
  new mongoose.Schema({ label: String }),
);

/**
 * The entry for this file's own model. A throw rather than a `!`: a run that
 * reconciled nothing would otherwise fail three assertions down with a message
 * about `undefined` instead of about the model it never saw.
 */
async function reconcileWidget() {
  const result = (await syncModelIndexes()).find(
    (entry) => entry.model === 'SyncIndexesWidget',
  );

  if (!result) {
    throw new Error('the widget model was not reconciled');
  }

  return result;
}

describe.skipIf(!connected)('syncModelIndexes', () => {
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Widget.collection.drop().catch(() => undefined);
    await Gadget.collection.drop().catch(() => undefined);
  });

  it('creates the indexes a model declares', async () => {
    const result = await reconcileWidget();

    expect(result.created.join()).toContain('code');

    const names = (await Widget.collection.indexes()).map(
      (index) => index.name,
    );

    expect(names).toContain('code_1');
  });

  /**
   * The whole reason this exists. Mongoose adds an index it has never seen and
   * removes none, so an index outliving the rule that created it goes on
   * enforcing it with nothing in the repository to say so - which is how a
   * unique index on the institution alone came to refuse a second degree from
   * one university.
   */
  it('drops an index the schema has stopped declaring', async () => {
    await Widget.createCollection();
    await Widget.collection.createIndex({ order: 1 }, { name: 'order_1' });

    const before = (await Widget.collection.indexes()).map(
      (index) => index.name,
    );

    expect(before).toContain('order_1');

    const result = await reconcileWidget();

    expect(result.dropped).toContain('order_1');

    const after = (await Widget.collection.indexes()).map(
      (index) => index.name,
    );

    expect(after).not.toContain('order_1');
    // The declared one survives: this reconciles, it does not clear.
    expect(after).toContain('code_1');
  });

  it('leaves a reconciled database alone on a second run', async () => {
    await syncModelIndexes();

    const result = await reconcileWidget();

    expect(result.dropped).toEqual([]);
    expect(result.created).toEqual([]);
  });

  /**
   * Not a list of models: whichever the caller has imported. The runner imports
   * the application, so every model a route can reach is reconciled without
   * anyone maintaining a list of them.
   */
  it('covers every model registered with mongoose', async () => {
    const reported = (await syncModelIndexes()).map((entry) => entry.model);

    expect(reported.sort()).toEqual(Object.keys(mongoose.models).sort());
  });
});
