import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { toValidationDetails } from '@portfolio/shared';

import { logger } from '../logging/logger.js';
import { ApiError } from '../http/api-error.js';
import { HTTP_STATUS_BY_CODE, ResponseCode } from '../http/response-codes.js';

type ErrorResponse = {
  code: ResponseCode;
  details: Record<string, unknown>;
  status: number;
};

/**
 * A body `express.json()` refused before any route ran - malformed or over the
 * limit. The client's error, answered as a validation error rather than a 500.
 */
function bodyParserDetail(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { type, status } = error as { type?: unknown; status?: unknown };

  if (
    typeof type !== 'string' ||
    typeof status !== 'number' ||
    status < 400 ||
    status >= 500
  ) {
    return null;
  }

  return type === 'entity.too.large' ? 'TOO_BIG' : 'INVALID_VALUE';
}

/**
 * A path the router could not percent-decode (`/api/projects/%E0`). It throws a
 * 400 `URIError` while matching, before any handler runs. Such a path names no
 * resource, so it is answered as one that names nothing - not as a 500.
 */
function isUndecodablePath(error: unknown): boolean {
  return (
    error instanceof URIError &&
    (error as URIError & { status?: unknown }).status === 400
  );
}

function resolve(error: unknown): ErrorResponse {
  if (isUndecodablePath(error)) {
    return {
      code: ResponseCode.NOT_FOUND,
      details: {},
      status: HTTP_STATUS_BY_CODE.NOT_FOUND,
    };
  }

  const bodyDetail = bodyParserDetail(error);

  if (bodyDetail) {
    return {
      code: ResponseCode.VALIDATION_ERROR,
      details: { body: bodyDetail },
      status: HTTP_STATUS_BY_CODE.VALIDATION_ERROR,
    };
  }

  if (error instanceof ApiError) {
    return { code: error.code, details: error.details, status: error.status };
  }

  if (error instanceof ZodError) {
    return {
      code: ResponseCode.VALIDATION_ERROR,
      details: toValidationDetails(error),
      status: HTTP_STATUS_BY_CODE.VALIDATION_ERROR,
    };
  }

  // Unknown failure: nothing about it is exposed to the client.
  return {
    code: ResponseCode.SERVER_ERROR,
    details: {},
    status: HTTP_STATUS_BY_CODE.SERVER_ERROR,
  };
}

/**
 * The single exit point for every failed request.
 * Controllers and services must throw, never build responses themselves.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(error);
  }

  const { code, details, status } = resolve(error);
  const context = { method: req.method, path: req.originalUrl, code };

  if (status >= 500) {
    logger.error({ ...context, err: error }, 'Unhandled request failure');
  } else {
    logger.warn(context, 'Request rejected');
  }

  res.status(status).json({ code, details });
}
