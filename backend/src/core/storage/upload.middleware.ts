import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import rateLimit from 'express-rate-limit';

import { ApiError } from '../http/api-error.js';
import { ResponseCode } from '../http/response-codes.js';
import {
  detectDocumentExtension,
  detectImageExtension,
} from './image-signature.js';
import { saveDocument, saveImage } from './storage.service.js';
import {
  ACCEPTED_DOCUMENT_MIME,
  ACCEPTED_IMAGE_MIME,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  type StorageCategory,
} from './storage.types.js';

/**
 * What every image upload route needs, in one place.
 *
 * Profile and project each grew their own verbatim copy of this. Between the
 * photograph, the CV, the cover, the gallery and the skill icon, a copy of the
 * rate limit and the body parser per endpoint is how the limits quietly drift
 * apart.
 */

const UPLOAD_WINDOW_MS = 15 * 60 * 1000;
const UPLOAD_MAX_ATTEMPTS = 20;

/**
 * Uploads are cheap to attempt and expensive to keep, so they are capped.
 *
 * A factory rather than a shared instance: one instance would pool every
 * endpoint's attempts into a single counter, so uploading a project gallery
 * would spend the profile's budget.
 */
export function imageUploadRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: UPLOAD_WINDOW_MS,
    limit: UPLOAD_MAX_ATTEMPTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new ApiError(ResponseCode.TOO_MANY_REQUESTS));
    },
  });
}

// The file is the whole body: no multipart, so no client filename ever exists.
const readImage = express.raw({
  type: ACCEPTED_IMAGE_MIME,
  limit: MAX_IMAGE_BYTES,
});

// Its own parser and its own limit: a document is not a large image, and one
// list would mean every image endpoint accepting a PDF by omission.
const readDocument = express.raw({
  type: ACCEPTED_DOCUMENT_MIME,
  limit: MAX_DOCUMENT_BYTES,
});

/**
 * Parses the body as raw image bytes, turning the parser's own failures into
 * the project's response vocabulary.
 *
 * `field` names the key the error is reported under, so each route keeps
 * answering about the field the admin was actually filling in.
 */
export function parseImageUpload(field: string): RequestHandler {
  return parse(readImage, field, 'IMAGE_TOO_LARGE', 'INVALID_IMAGE');
}

/** The same for a document, answering in its own vocabulary. */
export function parseDocumentUpload(field: string): RequestHandler {
  return parse(readDocument, field, 'DOCUMENT_TOO_LARGE', 'INVALID_DOCUMENT');
}

function parse(
  reader: RequestHandler,
  field: string,
  tooLargeCode: string,
  invalidCode: string,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    reader(req, res, (error: unknown) => {
      if (!error) {
        return next();
      }

      const tooLarge = (error as { type?: string }).type === 'entity.too.large';

      next(
        new ApiError(ResponseCode.VALIDATION_ERROR, {
          [field]: tooLarge ? tooLargeCode : invalidCode,
        }),
      );
    });
  };
}

/**
 * Turns a parsed body into a stored file, or refuses it. The bytes decide the
 * type, and the stored name is generated, so a client filename never reaches
 * the disk. Written once, so no endpoint can skip the check.
 */
export async function receiveImage(
  req: Request,
  {
    category,
    name,
    field,
  }: { category: StorageCategory; name: string; field: string },
): Promise<string> {
  const bytes: unknown = req.body;

  const extension =
    Buffer.isBuffer(bytes) && bytes.length > 0
      ? detectImageExtension(bytes)
      : null;

  if (!Buffer.isBuffer(bytes) || !extension) {
    throw new ApiError(ResponseCode.VALIDATION_ERROR, {
      [field]: 'INVALID_IMAGE',
    });
  }

  return saveImage(category, name, bytes, extension);
}

/**
 * The same, for a document.
 *
 * A separate function rather than a parameter on `receiveImage`, for the reason
 * the two detectors are separate: an endpoint accepts documents only if it says
 * so, never by omission.
 */
export async function receiveDocument(
  req: Request,
  {
    category,
    name,
    field,
  }: { category: StorageCategory; name: string; field: string },
): Promise<string> {
  const bytes: unknown = req.body;

  const extension =
    Buffer.isBuffer(bytes) && bytes.length > 0
      ? detectDocumentExtension(bytes)
      : null;

  if (!Buffer.isBuffer(bytes) || !extension) {
    throw new ApiError(ResponseCode.VALIDATION_ERROR, {
      [field]: 'INVALID_DOCUMENT',
    });
  }

  return saveDocument(category, name, bytes, extension);
}
