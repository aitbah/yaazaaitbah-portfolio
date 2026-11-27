import { applyOrder } from '../../core/database/reorder.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { assertOptionExists } from '../option/option.lookup.js';
import {
  SocialLinkModel,
  SOCIAL_LINK_SORT,
  type SocialLinkDocument,
} from './social-link.model.js';
import type { SocialLinkInput } from './social-link.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, raised by the unique index on `url`. */
const DUPLICATE_KEY = 11000;

export type SocialLinkResponse = {
  id: string;
  platform: string;
  url: string;
  order: number;
  updatedAt: string;
};

export function toSocialLinkResponse(
  link: SocialLinkDocument,
): SocialLinkResponse {
  return {
    id: link._id.toString(),
    platform: link.platform,
    url: link.url,
    order: link.order,
    updatedAt: link.updatedAt.toISOString(),
  };
}

/** The unique index is the real guard; checking first would leave a race. */
function asConflict(error: unknown): never {
  if ((error as { code?: number }).code === DUPLICATE_KEY) {
    // Reported on the URL, which is what the index covers - and with its own
    // code, because "that name is already taken" under a field labelled Link
    // contradicts the label directly above it.
    throw new ApiError(ResponseCode.CONFLICT, { url: 'URL_TAKEN' });
  }

  throw error;
}

/** Every link, in display order. No pagination: there are a handful. */
export async function listSocialLinks(): Promise<SocialLinkDocument[]> {
  return SocialLinkModel.find().sort(SOCIAL_LINK_SORT);
}

export async function createSocialLink(
  input: SocialLinkInput,
): Promise<SocialLinkDocument> {
  await assertOptionExists('social-platform', input.platform, 'platform');

  try {
    return await SocialLinkModel.create(input);
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Sets every field the schema defines, which is a replacement in effect: the
 * validated input always carries all of them.
 */
export async function updateSocialLink(
  id: string,
  input: SocialLinkInput,
): Promise<SocialLinkDocument> {
  await assertOptionExists('social-platform', input.platform, 'platform');

  let link: SocialLinkDocument | null;

  try {
    link = await SocialLinkModel.findOneAndUpdate(
      { _id: toObjectId(id) },
      { $set: input },
      { returnDocument: 'after', runValidators: true },
    );
  } catch (error) {
    return asConflict(error);
  }

  if (!link) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  return link;
}

export async function removeSocialLink(id: string): Promise<void> {
  const deleted = await SocialLinkModel.findOneAndDelete({
    _id: toObjectId(id),
  });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }
}

/**
 * Writes a whole ordering. The shared helper owns the rules; this only names
 * the model they apply to.
 */
export async function reorderSocialLinks(ids: string[]): Promise<void> {
  await applyOrder(SocialLinkModel, ids);
}
