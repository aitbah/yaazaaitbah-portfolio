import mongoose from 'mongoose';

export type IndexSyncResult = {
  model: string;
  /** Indexes the database had and the schema no longer declares. */
  dropped: string[];
  /** Indexes the schema declares and the database did not have. */
  created: string[];
};

/**
 * Reconciles the database's indexes with the models'. Mongoose never drops an
 * index it stopped declaring, so a changed rule would keep enforcing the old
 * one. Covers every registered model, and is idempotent.
 */
export async function syncModelIndexes(): Promise<IndexSyncResult[]> {
  const results: IndexSyncResult[] = [];

  for (const [name, model] of Object.entries(mongoose.models)) {
    // Asked before the sync, because afterwards there is nothing left to
    // report: `syncIndexes` returns what it dropped and not what it added.
    const { toCreate } = await model.diffIndexes();
    const dropped = await model.syncIndexes();

    results.push({
      model: name,
      dropped,
      created: toCreate.map((spec) => JSON.stringify(spec)),
    });
  }

  return results;
}
