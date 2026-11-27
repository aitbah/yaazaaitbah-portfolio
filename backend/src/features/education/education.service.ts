import { localizedPath } from '../../core/database/localized-text.js';
import { replacementUpdate } from '../../core/database/replace-fields.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { assertOptionExists } from '../option/option.lookup.js';
import {
  EducationModel,
  EDUCATION_SORT,
  type EducationDocument,
} from './education.model.js';
import { educationShape, type EducationInput } from './education.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, raised by the compound unique index. */
const DUPLICATE_KEY = 11000;

type LocalizedText = Record<string, string>;

export type EducationResponse = {
  id: string;
  institution: LocalizedText;
  qualification: LocalizedText;
  fieldOfStudy?: LocalizedText;
  level: string;
  location?: LocalizedText;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: LocalizedText;
  updatedAt: string;
};

/** A `Map` on the document, an object on the wire; absent stays absent. */
function localized(value: Map<string, string> | undefined | null) {
  return value && value.size > 0 ? Object.fromEntries(value) : undefined;
}

export function toEducationResponse(row: EducationDocument): EducationResponse {
  return {
    id: row._id.toString(),
    institution: Object.fromEntries(row.institution),
    qualification: Object.fromEntries(row.qualification),
    fieldOfStudy: localized(row.fieldOfStudy),
    level: row.level,
    location: localized(row.location),
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    current: row.current,
    description: localized(row.description),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The unique index is the real guard against a duplicate; checking first would
 * leave a race between the check and the write.
 *
 * Reported at `institution.en`, the first field of the compound key and one the
 * client renders an input for. The other two are on screen beside it, so the
 * message lands where the admin is looking.
 */
function asConflict(error: unknown): never {
  if ((error as { code?: number }).code === DUPLICATE_KEY) {
    throw new ApiError(ResponseCode.CONFLICT, {
      [localizedPath('institution')]: 'ALREADY_EXISTS',
    });
  }

  throw error;
}

/** Every entry, most recent first. No pagination: a CV has a handful at most. */
export async function listEducation(): Promise<EducationDocument[]> {
  return EducationModel.find().sort(EDUCATION_SORT);
}

export async function createEducation(
  input: EducationInput,
): Promise<EducationDocument> {
  await assertOptionExists('education-level', input.level, 'level');

  try {
    return await EducationModel.create(input);
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Sets every field the schema defines, which is a replacement in effect, and
 * clears the optional ones the input omits - `endDate` above all, since a
 * course that becomes current must lose the end date it had.
 */
export async function updateEducation(
  id: string,
  input: EducationInput,
): Promise<EducationDocument> {
  await assertOptionExists('education-level', input.level, 'level');

  let updated: EducationDocument | null;

  try {
    updated = await EducationModel.findOneAndUpdate(
      { _id: toObjectId(id) },
      replacementUpdate(educationShape, input),
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

export async function removeEducation(id: string): Promise<void> {
  const deleted = await EducationModel.findOneAndDelete({
    _id: toObjectId(id),
  });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }
}
