import { applyOrder } from '../../core/database/reorder.js';
import { replacementUpdate } from '../../core/database/replace-fields.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { assertOptionExists } from '../option/option.lookup.js';
import {
  LanguageModel,
  LANGUAGE_SORT,
  type LanguageDocument,
} from './language.model.js';
import { languageSchema, type LanguageInput } from './language.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, raised by the unique index on the code. */
const DUPLICATE_KEY = 11000;

export type LanguageResponse = {
  id: string;
  /** A BCP-47 subtag. The name is the client's to render, not ours to store. */
  code: string;
  level: string;
  order: number;
  updatedAt: string;
};

export function toLanguageResponse(row: LanguageDocument): LanguageResponse {
  return {
    id: row._id.toString(),
    code: row.code,
    level: row.level,
    order: row.order,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The unique index is the real guard; checking first would leave a race between
 * the check and the write. Reported at `code`, the field the form renders.
 */
function asConflict(error: unknown): never {
  if ((error as { code?: number }).code === DUPLICATE_KEY) {
    throw new ApiError(ResponseCode.CONFLICT, { code: 'CODE_TAKEN' });
  }

  throw error;
}

/** Every language, in the order the owner chose. */
export async function listLanguages(): Promise<LanguageDocument[]> {
  return LanguageModel.find().sort(LANGUAGE_SORT);
}

export async function createLanguage(
  input: LanguageInput,
): Promise<LanguageDocument> {
  await assertOptionExists('language-level', input.level, 'level');

  try {
    return await LanguageModel.create(input);
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Sets every field the schema defines, which is a replacement in effect.
 */
export async function updateLanguage(
  id: string,
  input: LanguageInput,
): Promise<LanguageDocument> {
  await assertOptionExists('language-level', input.level, 'level');

  let updated: LanguageDocument | null;

  try {
    updated = await LanguageModel.findOneAndUpdate(
      { _id: toObjectId(id) },
      replacementUpdate(languageSchema, input),
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

export async function removeLanguage(id: string): Promise<void> {
  const deleted = await LanguageModel.findOneAndDelete({ _id: toObjectId(id) });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }
}

/**
 * Writes a whole ordering. The shared helper owns the rules; this only names
 * the model they apply to.
 */
export async function reorderLanguages(ids: string[]): Promise<void> {
  await applyOrder(LanguageModel, ids);
}
