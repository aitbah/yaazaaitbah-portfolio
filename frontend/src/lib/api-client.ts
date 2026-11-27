import { UPLOAD_PATH_PREFIX } from '@portfolio/shared';

/**
 * The value that means "the API is on this page's own origin, address it by
 * path". Production sets it: one edge proxy serves the site and `/api` under
 * the public name, and the admin under a second name, and the same bundle has
 * to be right on both. A word rather than an empty string, because an empty
 * environment variable and a missing one are the same thing by the time the
 * bundle is built, and the missing one falls back to a development address.
 */
const SAME_ORIGIN = 'same-origin';

/** Where the browser reaches the API. Empty means: this origin. */
export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL === SAME_ORIGIN
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000');

/** Long enough for a 2 MB upload on a slow link, short enough to give up. */
const REQUEST_TIMEOUT_MS = 30_000;

type Envelope = {
  code: string;
  details: Record<string, unknown>;
};

/**
 * Whether a reference is a file this application stores, as opposed to an
 * external URL the contract also permits.
 *
 * The distinction decides how an image is delivered: a stored file is
 * same-origin and can be optimized, and somebody else's host can be neither.
 */
export function isStoredUpload(reference: string): boolean {
  return reference.startsWith(`${UPLOAD_PATH_PREFIX}/`);
}

/**
 * Where to address a stored file from. Managed uploads are stored as a path,
 * which is right in every environment because the frontend serves `/uploads/*`
 * itself - and same-origin is what lets `next/image` optimize them. External
 * URLs pass through; any other path gets the API host.
 */
export function assetUrl(reference: string): string {
  if (isStoredUpload(reference)) {
    return reference;
  }

  return reference.startsWith('/') ? `${API_ORIGIN}${reference}` : reference;
}

/** Carries the backend's response code so callers can map it to a message. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, details: Record<string, unknown> = {}) {
    super(code);
    this.name = 'ApiRequestError';
    this.code = code;
    this.details = details;
  }
}

/** `null` when the body is not the envelope - a gateway error page, or nothing. */
async function readEnvelope(response: Response): Promise<Envelope | null> {
  try {
    return (await response.json()) as Envelope;
  } catch {
    return null;
  }
}

/**
 * Single entry point for backend calls. Every response follows the
 * `{ code, details }` envelope, and the session rides along as an HttpOnly
 * cookie - hence `credentials: 'include'` on every request.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    // Without this a stalled connection leaves the caller waiting forever, and
    // the UI showing a spinner with no way out.
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  const body = await readEnvelope(response);

  // An unreadable body breaks the contract even on a 2xx, so it fails too.
  if (!response.ok || !body) {
    throw new ApiRequestError(body?.code ?? 'UNKNOWN', body?.details);
  }

  return body.details as T;
}
