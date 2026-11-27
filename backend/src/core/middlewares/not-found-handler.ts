import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../http/api-error.js';
import { ResponseCode } from '../http/response-codes.js';

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(new ApiError(ResponseCode.NOT_FOUND));
}
