import { API_ORIGIN } from './api-client';

/**
 * Reading the API from the server. **Server only.** `apiFetch` addresses the
 * browser's view of the backend; inside the container that is the wrong host,
 * so the server has its own address.
 */
const API_URL =
  process.env.INTERNAL_API_URL || API_ORIGIN || 'http://localhost:5000';

/**
 * How long a public read is cached. Zero outside production, so an edit made in
 * the admin shows on the next reload, and end-to-end runs never race the cache.
 */
export const PUBLIC_REVALIDATE_SECONDS =
  process.env.NODE_ENV === 'production' ? 300 : 0;

/**
 * Reads from the API, or answers `null`. It never throws: a public page renders
 * what it can rather than a 500 while the API restarts.
 */
export async function readFromApi<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { details?: T };

    return body.details ?? null;
  } catch {
    return null;
  }
}

/** A public collection, or an empty one when the API cannot be read. */
export async function readList<T>(path: string, key: string): Promise<T[]> {
  const details = await readFromApi<Record<string, T[]>>(path);

  return details?.[key] ?? [];
}

/**
 * Whether a stored file answers. A reference can outlive its file - a restore
 * without the uploads volume - and a link to a missing file is worse than none.
 */
export async function storedFileExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'HEAD',
      next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
    });

    return response.ok;
  } catch {
    return false;
  }
}
