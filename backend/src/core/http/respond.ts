import type { Response } from 'express';

import { ResponseCode } from './response-codes.js';

/** Single place where a success payload is shaped. */
export function sendSuccess(
  res: Response,
  details: Record<string, unknown> = {},
) {
  return res.status(200).json({ code: ResponseCode.SUCCESS, details });
}
