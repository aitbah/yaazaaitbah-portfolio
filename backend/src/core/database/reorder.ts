import { Types } from 'mongoose';

import { ApiError } from '../http/api-error.js';
import { ResponseCode } from '../http/response-codes.js';

type ReorderWrite = {
  updateOne: {
    filter: { _id: Types.ObjectId } & Record<string, unknown>;
    update: { $set: { order: number; updatedAt: Date } };
  };
};

/**
 * What this needs of a model, rather than the model itself: `Model<T>` is
 * invariant in `T`, so one written against `Model<Orderable>` would refuse
 * every real model that has any other field - which is all of them.
 */
type OrderableModel = {
  find(filter: Record<string, unknown>): {
    select(fields: string): PromiseLike<{ _id: Types.ObjectId }[]>;
  };
  collection: { bulkWrite(operations: ReorderWrite[]): PromiseLike<unknown> };
};

/**
 * Writes a whole ordering at once, so the result is exactly what the admin saw
 * and the last save wins whole. The ids must be exactly the stored ones;
 * `scope` narrows that for a collection holding several lists.
 */
export async function applyOrder(
  model: OrderableModel,
  ids: string[],
  scope: Record<string, unknown> = {},
): Promise<void> {
  const stored = await model.find(scope).select('_id');
  const known = new Set(stored.map((document) => document._id.toString()));

  const sent = new Set(ids);

  if (sent.size !== ids.length) {
    throw new ApiError(ResponseCode.VALIDATION_ERROR, { order: 'DUPLICATE' });
  }

  if (sent.size !== known.size || [...sent].some((id) => !known.has(id))) {
    // Whoever sent it is working from a list that no longer matches the
    // database - a row added or removed in another tab, most likely.
    throw new ApiError(ResponseCode.CONFLICT, { order: 'STALE' });
  }

  const now = new Date();

  // The driver's own bulkWrite: one round trip, and the whole ordering lands
  // together rather than as a row-by-row sequence another reader could observe
  // halfway through. `updatedAt` is set by hand because this bypasses the
  // Mongoose layer that would otherwise do it.
  await model.collection.bulkWrite(
    ids.map((id, index) => ({
      updateOne: {
        // Scoped too: the ids were checked against this list, and repeating the
        // filter means a write can never land outside it.
        filter: { _id: new Types.ObjectId(id), ...scope },
        // Only the position: a reorder must not touch anything else.
        update: { $set: { order: index, updatedAt: now } },
      },
    })),
  );
}
