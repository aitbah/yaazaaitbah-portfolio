import { localizedPath } from '../../core/database/localized-text.js';
import { replacementUpdate } from '../../core/database/replace-fields.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { assertOptionExists } from '../option/option.lookup.js';
import {
  ExperienceModel,
  EXPERIENCE_SORT,
  type ExperienceDocument,
} from './experience.model.js';
import {
  experienceShape,
  type ExperienceInput,
} from './experience.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, raised by the compound unique index. */
const DUPLICATE_KEY = 11000;

type LocalizedText = Record<string, string>;

export type ExperienceResponse = {
  id: string;
  role: LocalizedText;
  organisation: LocalizedText;
  location?: LocalizedText;
  employmentType: string;
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

export function toExperienceResponse(
  row: ExperienceDocument,
): ExperienceResponse {
  return {
    id: row._id.toString(),
    role: Object.fromEntries(row.role),
    organisation: Object.fromEntries(row.organisation),
    location: localized(row.location),
    employmentType: row.employmentType,
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
 * Reported at `role.en`, the first field of the compound key and the one a
 * client renders an input for. The other two are on screen beside it, so the
 * message lands where the admin is looking.
 */
function asConflict(error: unknown): never {
  if ((error as { code?: number }).code === DUPLICATE_KEY) {
    throw new ApiError(ResponseCode.CONFLICT, {
      [localizedPath('role')]: 'ALREADY_EXISTS',
    });
  }

  throw error;
}

/** Every position, most recent first. No pagination: a career has tens at most. */
export async function listExperience(): Promise<ExperienceDocument[]> {
  return ExperienceModel.find().sort(EXPERIENCE_SORT);
}

export async function createExperience(
  input: ExperienceInput,
): Promise<ExperienceDocument> {
  await assertOptionExists(
    'employment-type',
    input.employmentType,
    'employmentType',
  );

  try {
    return await ExperienceModel.create(input);
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Sets every field the schema defines, which is a replacement in effect, and
 * clears the optional ones the input omits - `endDate` above all, since a
 * position that becomes current must lose the end date it had.
 */
export async function updateExperience(
  id: string,
  input: ExperienceInput,
): Promise<ExperienceDocument> {
  await assertOptionExists(
    'employment-type',
    input.employmentType,
    'employmentType',
  );

  let updated: ExperienceDocument | null;

  try {
    updated = await ExperienceModel.findOneAndUpdate(
      { _id: toObjectId(id) },
      replacementUpdate(experienceShape, input),
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

export async function removeExperience(id: string): Promise<void> {
  const deleted = await ExperienceModel.findOneAndDelete({
    _id: toObjectId(id),
  });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }
}
