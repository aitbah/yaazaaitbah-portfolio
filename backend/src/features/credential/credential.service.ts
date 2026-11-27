import type { CredentialKind } from '@portfolio/shared';

import { localizedPath } from '../../core/database/localized-text.js';
import { replacementUpdate } from '../../core/database/replace-fields.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import {
  CredentialModel,
  CREDENTIAL_SORT,
  type CredentialDocument,
} from './credential.model.js';
import {
  credentialShape,
  type CredentialInput,
} from './credential.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, raised by the compound unique index. */
const DUPLICATE_KEY = 11000;

type LocalizedText = Record<string, string>;

export type CredentialResponse = {
  id: string;
  kind: CredentialKind;
  name: LocalizedText;
  issuer: LocalizedText;
  issuedAt: string;
  expiresAt?: string;
  credentialId?: string;
  credentialUrl?: string;
  description?: LocalizedText;
  updatedAt: string;
};

/** A `Map` on the document, an object on the wire; absent stays absent. */
function localized(value: Map<string, string> | undefined | null) {
  return value && value.size > 0 ? Object.fromEntries(value) : undefined;
}

export function toCredentialResponse(
  row: CredentialDocument,
): CredentialResponse {
  return {
    id: row._id.toString(),
    kind: row.kind,
    name: Object.fromEntries(row.name),
    issuer: Object.fromEntries(row.issuer),
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt ?? undefined,
    credentialId: row.credentialId || undefined,
    credentialUrl: row.credentialUrl || undefined,
    description: localized(row.description),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The unique index is the real guard against a duplicate; checking first would
 * leave a race between the check and the write.
 *
 * Reported at `name.en`, the first named field of the compound key and one a
 * client renders an input for.
 */
function asConflict(error: unknown): never {
  if ((error as { code?: number }).code === DUPLICATE_KEY) {
    throw new ApiError(ResponseCode.CONFLICT, {
      [localizedPath('name')]: 'ALREADY_EXISTS',
    });
  }

  throw error;
}

/** One kind's credentials, most recent first. No pagination: a CV has a few. */
export async function listCredentials(
  kind: CredentialKind,
): Promise<CredentialDocument[]> {
  return CredentialModel.find({ kind }).sort(CREDENTIAL_SORT);
}

export async function createCredential(
  kind: CredentialKind,
  input: CredentialInput,
): Promise<CredentialDocument> {
  try {
    // The kind comes from the route, never the body, so a request cannot name
    // one kind and land in the other list.
    return await CredentialModel.create({ ...input, kind });
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Sets every schema field and unsets the omitted optional ones - `expiresAt`
 * above all. The kind is in the filter, so `/api/courses` can never change a
 * certification.
 */
export async function updateCredential(
  kind: CredentialKind,
  id: string,
  input: CredentialInput,
): Promise<CredentialDocument> {
  let updated: CredentialDocument | null;

  try {
    updated = await CredentialModel.findOneAndUpdate(
      { _id: toObjectId(id), kind },
      replacementUpdate(credentialShape, input),
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

export async function removeCredential(
  kind: CredentialKind,
  id: string,
): Promise<void> {
  const deleted = await CredentialModel.findOneAndDelete({
    _id: toObjectId(id),
    kind,
  });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }
}
