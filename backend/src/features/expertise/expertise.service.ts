import { OPTION_LIST_BY_KIND, type ExpertiseKind } from '@portfolio/shared';

import { localizedPath } from '../../core/database/localized-text.js';
import { replacementUpdate } from '../../core/database/replace-fields.js';
import { applyOrder } from '../../core/database/reorder.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { deleteManagedFile } from '../../core/storage/storage.service.js';
import { assertOptionExists } from '../option/option.lookup.js';
import { countProjectsUsingExpertise } from '../project/project.service.js';
import {
  ExpertiseModel,
  EXPERTISE_SORT,
  type ExpertiseDocument,
} from './expertise.model.js';
import {
  expertiseSchema,
  type ExpertiseInput,
} from './expertise.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, raised by the unique index on the name. */
const DUPLICATE_KEY = 11000;

type LocalizedText = Record<string, string>;

export type ExpertiseIconResponse = {
  kind: 'preset' | 'upload';
  value: string;
};

export type ExpertiseResponse = {
  id: string;
  kind: ExpertiseKind;
  name: LocalizedText;
  category: string;
  level: number;
  icon?: ExpertiseIconResponse;
  order: number;
  updatedAt: string;
};

/**
 * An upload's file is ours to delete once nothing points at it; a preset names
 * a vendored drawing and owns no file at all. Anything else - a document
 * written before the field existed - is treated as owning nothing, because
 * guessing would mean deleting on a guess.
 */
function uploadedFile(icon: ExpertiseDocument['icon']): string | null {
  return icon?.kind === 'upload' ? icon.value : null;
}

export function toExpertiseResponse(row: ExpertiseDocument): ExpertiseResponse {
  return {
    id: row._id.toString(),
    // Carried even though the resource already says it: the project picker
    // offers technologies and tools in one list and groups them by this.
    kind: row.kind,
    name: Object.fromEntries(row.name),
    category: row.category,
    level: row.level,
    icon: row.icon ? { kind: row.icon.kind, value: row.icon.value } : undefined,
    order: row.order,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The unique index is the real guard against a duplicate name; checking first
 * would leave a race between the check and the write.
 *
 * Reported at `name.en` rather than `name`, because that is the path the index
 * covers and the path a client actually renders an input for - the same dotted
 * form every validation error already uses.
 */
function asConflict(error: unknown): never {
  if ((error as { code?: number }).code === DUPLICATE_KEY) {
    throw new ApiError(ResponseCode.CONFLICT, {
      [localizedPath('name')]: 'ALREADY_EXISTS',
    });
  }

  throw error;
}

/**
 * Every row of one kind, in display order. No pagination: a portfolio has tens.
 *
 * The kind is a filter on every read, never a thing the caller may omit - a
 * mixed list is not something any of the three resources should be able to
 * return by accident.
 */
export async function listExpertise(
  kind: ExpertiseKind,
): Promise<ExpertiseDocument[]> {
  return ExpertiseModel.find({ kind }).sort(EXPERTISE_SORT);
}

/**
 * The category is checked against this kind's option list, which is the check
 * the per-kind `z.enum` used to make. It cannot be made by a schema any more:
 * the categories are rows, so what a kind offers is only knowable here.
 */
async function assertCategory(
  kind: ExpertiseKind,
  category: string,
): Promise<void> {
  await assertOptionExists(OPTION_LIST_BY_KIND[kind], category, 'category');
}

export async function createExpertise(
  kind: ExpertiseKind,
  input: ExpertiseInput,
): Promise<ExpertiseDocument> {
  await assertCategory(kind, input.category);

  try {
    return await ExpertiseModel.create({ ...input, kind });
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Sets every field the schema defines, which is a replacement in effect - the
 * validated input always carries all of them, `order` through its default.
 *
 * The kind is part of the filter, not of the update: it is what the row *is*,
 * so an id belonging to another kind must read as "no such technology" rather
 * than quietly turning a tool into one.
 */
export async function updateExpertise(
  kind: ExpertiseKind,
  id: string,
  input: ExpertiseInput,
): Promise<ExpertiseDocument> {
  await assertCategory(kind, input.category);

  let previous: ExpertiseDocument | null;

  try {
    // Answering with the document *before* the write is what makes the cleanup
    // decision part of the same operation: reading it separately first leaves a
    // window in which another write lands and the wrong file is deleted.
    previous = await ExpertiseModel.findOneAndUpdate(
      { _id: toObjectId(id), kind },
      replacementUpdate(expertiseSchema(kind), input),
      { returnDocument: 'before', runValidators: true },
    );
  } catch (error) {
    return asConflict(error);
  }

  if (!previous) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  const row = await ExpertiseModel.findById(previous._id);

  if (!row) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  const abandoned = uploadedFile(previous.icon);

  // Swapping an uploaded logo for a preset, or for another upload, leaves the
  // old file behind. Deleting it here rather than at upload time, because the
  // document is the only thing that says whether a file is still in use.
  if (abandoned && abandoned !== uploadedFile(row.icon)) {
    await deleteManagedFile(abandoned);
  }

  return row;
}

/**
 * Refuses to delete a row a project still uses, rather than silently editing
 * those projects. The check and the delete are not atomic, but the race can
 * only refuse a safe delete. `Project` owns the question.
 */
export async function removeExpertise(
  kind: ExpertiseKind,
  id: string,
): Promise<void> {
  const objectId = toObjectId(id);
  const inUse = await countProjectsUsingExpertise(objectId);

  if (inUse > 0) {
    throw new ApiError(ResponseCode.CONFLICT, {
      // Named for what the client asked to delete, which is one of the three.
      [kind]: 'IN_USE',
      projects: inUse,
    });
  }

  const deleted = await ExpertiseModel.findOneAndDelete({
    _id: objectId,
    kind,
  });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  const file = uploadedFile(deleted.icon);

  if (file) {
    await deleteManagedFile(file);
  }
}

/**
 * Writes a whole ordering, within one kind.
 *
 * Scoping the read to the kind is what makes the helper's completeness rule
 * mean the right thing: without it, a list of every technology would look like
 * an incomplete ordering of all three and be refused as stale - and a list
 * mixing kinds would be accepted.
 */
export async function reorderExpertise(
  kind: ExpertiseKind,
  ids: string[],
): Promise<void> {
  await applyOrder(ExpertiseModel, ids, { kind });
}
