import { Types } from 'mongoose';

import { ApiError } from '../http/api-error.js';
import { ResponseCode } from '../http/response-codes.js';

/**
 * A malformed id is a request for something that cannot exist, so it answers
 * NOT_FOUND rather than a cast error surfacing as SERVER_ERROR.
 *
 * Every service that takes an id from a route needs exactly this, and nine of
 * them had a byte-identical private copy - nine places for the answer to drift
 * to 500 one at a time.
 */
export function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  return new Types.ObjectId(id);
}
