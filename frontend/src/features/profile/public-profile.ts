import { localizedValue } from '@/i18n/localized-value';
import { readFromApi } from '@/lib/server-api';
import { siteUrl } from '@/lib/site';

import type { Profile } from './profile-api';

/**
 * The profile as a public page reads it: the admin's type, from the same
 * endpoint. The server drops unpublished contact details, so they are absent
 * here and no page has to decide what a stranger may see.
 */
export type PublicProfile = Profile;

export async function readProfile(): Promise<PublicProfile | null> {
  const details = await readFromApi<{ profile: PublicProfile }>('/api/profile');

  return details?.profile ?? null;
}

/** The owner's name, as one string, in the reader's language. */
export function displayName(
  profile: PublicProfile | null,
  locale: string,
): string {
  if (!profile) {
    return '';
  }

  return [
    localizedValue(profile.firstName, locale),
    localizedValue(profile.lastName, locale),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * An absolute URL for a stored image, or `undefined`.
 *
 * Metadata and JSON-LD both refuse a relative path - a crawler has no page to
 * resolve it against. Uploads are served from this origin, so the site's own
 * base is the right one; an external URL is already absolute and passes
 * through.
 */
export function absoluteImage(reference: string | undefined) {
  if (!reference) {
    return undefined;
  }

  return reference.startsWith('http') ? reference : `${siteUrl()}${reference}`;
}
