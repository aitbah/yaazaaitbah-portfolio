import { HTTP_STATUS_BY_CODE, type ResponseCode } from './response-codes.js';

type ErrorDetails = Record<string, unknown>;

/**
 * The only error type controllers/services should throw.
 * The global error handler turns it into the centralized response format.
 */
export class ApiError extends Error {
  readonly code: ResponseCode;
  readonly status: number;
  readonly details: ErrorDetails;

  constructor(code: ResponseCode, details: ErrorDetails = {}) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = HTTP_STATUS_BY_CODE[code];
    this.details = details;
  }
}
