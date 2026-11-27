import { ApiRequestError, apiFetch } from '@/lib/api-client';

import type { LocalizedValues, ProfileInput } from './profile-schema';

/**
 * How to reach the person, as the API returns it. Every value is optional
 * because an unpublished one is absent; the signed-in admin receives all of it.
 */
export type ContactDetails = {
  email?: string;
  emailPublic: boolean;
  location?: LocalizedValues;
  locationPublic: boolean;
  availability?: string;
  availabilityPublic: boolean;
};

/** The profile as the API returns it - see docs/api-endpoints/profile-api.md. */
export type Profile = {
  firstName: LocalizedValues;
  lastName: LocalizedValues;
  headline: LocalizedValues;
  bio?: LocalizedValues;
  photoUrl?: string;
  photoAlt?: LocalizedValues;
  /** The CV, one stored path per locale, or absent when there is none. */
  resume?: LocalizedValues;
  contact?: ContactDetails;
  updatedAt: string;
};

/** `null` means "nothing saved yet" - an answer, not an error. */
export async function fetchProfile(): Promise<Profile | null> {
  try {
    const { profile } = await apiFetch<{ profile: Profile }>('/api/profile');

    return profile;
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') {
      return null;
    }

    // Any other failure must surface: PUT replaces the whole document, so an
    // empty form after a failed read would offer to overwrite a real profile.
    throw error;
  }
}

/** One idempotent write covers both creating and replacing the profile. */
export async function saveProfile(input: ProfileInput): Promise<Profile> {
  const { profile } = await apiFetch<{ profile: Profile }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  return profile;
}

/**
 * The CV. A PDF, sent as the whole request body like every other upload, and
 * decided from its own bytes by the server.
 */
export async function uploadResume(file: File): Promise<string> {
  const { resumeUrl } = await apiFetch<{ resumeUrl: string }>(
    '/api/profile/resume',
    {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    },
  );

  return resumeUrl;
}

/**
 * The file is the whole request body: no multipart, so no filename is ever sent
 * and the server names what it stores. Returns the managed path to persist.
 */
export async function uploadPhoto(file: File): Promise<string> {
  const { photoUrl } = await apiFetch<{ photoUrl: string }>(
    '/api/profile/photo',
    {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    },
  );

  return photoUrl;
}
