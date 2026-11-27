import {
  OPTION_LIST_SHAPES,
  type OptionListKey,
  type OptionListShape,
} from '@portfolio/shared';

import { localizedPath } from '../../core/database/localized-text.js';
import { applyOrder } from '../../core/database/reorder.js';
import { replacementUpdate } from '../../core/database/replace-fields.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { assertOptionExists } from './option.lookup.js';
import {
  OptionModel,
  OPTION_SORT,
  type OptionDocument,
} from './option.model.js';
import { OPTION_USAGE } from './option.usage.js';
import {
  optionSchema,
  type OptionEditInput,
  type OptionInput,
} from './option.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, raised by the unique indexes on this list. */
const DUPLICATE_KEY = 11000;

type LocalizedText = Record<string, string>;

export type OptionResponse = {
  id: string;
  list: OptionListKey;
  code: string;
  name: LocalizedText;
  group?: string;
  icon?: string;
  order: number;
  updatedAt: string;
};

export function toOptionResponse(row: OptionDocument): OptionResponse {
  return {
    id: row._id.toString(),
    list: row.list,
    code: row.code,
    name: Object.fromEntries(row.name),
    group: row.group ?? undefined,
    icon: row.icon ?? undefined,
    order: row.order,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Two unique indexes cover this collection, and a client can only fix what it
 * can see. The duplicate-key message names the index, so the conflict is
 * reported at the field the admin actually typed in rather than at whichever
 * one is checked first.
 */
function asConflict(error: unknown): never {
  const failure = error as { code?: number; message?: string };

  if (failure.code === DUPLICATE_KEY) {
    const onCode = failure.message?.includes('code_1') ?? false;

    throw new ApiError(
      ResponseCode.CONFLICT,
      onCode
        ? { code: 'CODE_TAKEN' }
        : { [localizedPath('name')]: 'ALREADY_EXISTS' },
    );
  }

  throw error;
}

/**
 * The fields an edit may write - all but the code. Not the edit schema:
 * `replacementUpdate` would unset the code, which that schema only declares in
 * order to refuse it.
 */
function editableFields(list: OptionListKey) {
  return optionSchema(list).omit({ code: true });
}

/**
 * A heading must be a heading that exists.
 *
 * The list's own shape says which list its groups come from, so a platform
 * cannot be filed under an education level by sending the wrong code.
 */
async function assertGroup(
  list: OptionListKey,
  group: string | undefined,
): Promise<void> {
  const shape: OptionListShape = OPTION_LIST_SHAPES[list];

  if (group === undefined || !shape.groupedBy) {
    return;
  }

  await assertOptionExists(shape.groupedBy, group, 'group');
}

/**
 * Every option, or every option in one list, in the order the owner chose.
 *
 * The unfiltered form is what the admin's forms use: a hundred-odd rows is one
 * small request, and one cached answer is simpler than a query per dropdown on
 * every screen that has one.
 */
export async function listOptions(
  list?: OptionListKey,
): Promise<OptionDocument[]> {
  const filter = list ? { list } : {};

  return OptionModel.find(filter).sort({ list: 1, ...OPTION_SORT });
}

export async function createOption(
  list: OptionListKey,
  input: OptionInput,
): Promise<OptionDocument> {
  await assertGroup(list, input.group);

  try {
    return await OptionModel.create({ ...input, list });
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Replaces everything an edit may touch. The list is in the filter, not the
 * update, so an id from another list is "no such option" rather than a move
 * that strands rows.
 */
export async function updateOption(
  list: OptionListKey,
  id: string,
  input: OptionEditInput,
): Promise<OptionDocument> {
  await assertGroup(list, input.group);

  let updated: OptionDocument | null;

  try {
    updated = await OptionModel.findOneAndUpdate(
      { _id: toObjectId(id), list },
      replacementUpdate(editableFields(list), input),
      { returnDocument: 'after', runValidators: true },
    );
  } catch (error) {
    return asConflict(error);
  }

  if (!updated) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  return updated;
}

/**
 * Refuses to delete an option a stored row still holds, rather than silently
 * changing that row. The count and the delete are not atomic, but the race can
 * only refuse a safe delete.
 */
export async function removeOption(id: string): Promise<void> {
  const objectId = toObjectId(id);
  const existing = await OptionModel.findById(objectId);

  if (!existing) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  const list = existing.list;
  const inUse = await OPTION_USAGE[list](existing.code);

  if (inUse > 0) {
    throw new ApiError(ResponseCode.CONFLICT, {
      option: 'IN_USE',
      rows: inUse,
    });
  }

  await OptionModel.deleteOne({ _id: objectId });
}

/**
 * Writes a whole ordering, within one list.
 *
 * Scoping the read to the list is what makes the helper's completeness rule
 * mean the right thing: without it, an ordering of one list would look like an
 * incomplete ordering of all nine and be refused as stale.
 */
export async function reorderOptions(
  list: OptionListKey,
  ids: string[],
): Promise<void> {
  await applyOrder(OptionModel, ids, { list });
}
