import { Router } from 'express';

import { isDatabaseConnected } from '../database/connection.js';
import { ApiError } from '../http/api-error.js';
import { ResponseCode } from '../http/response-codes.js';
import { sendSuccess } from '../http/respond.js';

/**
 * Whether this instance can serve. Public, because health checks have no
 * session; about the instance, never the content, so an empty database still
 * answers; and it discloses nothing about the host.
 */
export const healthRouter = Router();

healthRouter.get('/', (_req, res, next) => {
  if (!isDatabaseConnected()) {
    // 503, not 500: the instance is running and the answer may differ in a
    // second. `curl -sf` treats it as a failure, so a waiting gate keeps
    // waiting rather than proceeding to seed a database that is not there.
    return next(new ApiError(ResponseCode.SERVICE_UNAVAILABLE));
  }

  return sendSuccess(res);
});
