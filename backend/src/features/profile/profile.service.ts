import {
  publicContactDetails,
  type ContactVisibility,
} from '@portfolio/shared';

import { replacementUpdate } from '../../core/database/replace-fields.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { assertOptionalOptionExists } from '../option/option.lookup.js';
import { deleteManagedFile } from '../../core/storage/storage.service.js';
import {
  PROFILE_DOCUMENT_FIELD,
  PROFILE_IMAGE_FIELDS,
} from './profile.images.js';
import {
  ProfileModel,
  SINGLETON_KEY,
  type ProfileDocument,
} from './profile.model.js';
import { profileSchema, type ProfileInput } from './profile.validation.js';

type LocalizedText = Record<string, string>;

/**
 * The contact block as a client receives it: the same shape the rule is written
 * against, with the location as the response's own looser localized type.
 */
export type ContactResponse = ContactVisibility<LocalizedText>;

export type ProfileResponse = {
  firstName: LocalizedText;
  lastName: LocalizedText;
  headline: LocalizedText;
  bio?: LocalizedText;
  photoUrl?: string;
  photoAlt?: LocalizedText;
  /** The CV, one stored path per locale, or absent when there is none. */
  resume?: LocalizedText;
  /**
   * How to reach the person - filtered by its own flags unless the reader owns
   * the profile. An unpublished detail is *absent*, not `null`: a key that is
   * present and empty still says the field exists.
   */
  contact?: ContactResponse;
  /** ISO date, so the public site can show when the profile last changed. */
  updatedAt: string;
};

function localesOf(value: Map<string, string>): LocalizedText {
  return Object.fromEntries(value);
}

/**
 * The contact block as the document holds it, with its Map turned into an
 * object like every other localized field.
 */
function contactOf(profile: ProfileDocument): ContactResponse | undefined {
  const contact = profile.contact;

  if (!contact) {
    return undefined;
  }

  return {
    email: contact.email ?? undefined,
    emailPublic: contact.emailPublic ?? false,
    location: contact.location ? localesOf(contact.location) : undefined,
    locationPublic: contact.locationPublic ?? false,
    availability: contact.availability ?? undefined,
    availabilityPublic: contact.availabilityPublic ?? true,
  };
}

/**
 * What a client may read. `audience` has no default, so a caller that has not
 * decided who is asking does not compile.
 */
export function toProfileResponse(
  profile: ProfileDocument,
  audience: 'public' | 'owner',
): ProfileResponse {
  const contact = contactOf(profile);

  return {
    firstName: localesOf(profile.firstName),
    lastName: localesOf(profile.lastName),
    headline: localesOf(profile.headline),
    bio: profile.bio ? localesOf(profile.bio) : undefined,
    photoUrl: profile.photoUrl ?? undefined,
    photoAlt: profile.photoAlt ? localesOf(profile.photoAlt) : undefined,
    // A separate field list from the schema's, and one the gallery bug taught
    // to keep in step: stored and validated but never mapped is stored for
    // nobody.
    resume:
      profile.resume && profile.resume.size > 0
        ? localesOf(profile.resume)
        : undefined,
    // Filtered here rather than by whatever renders it: a client cannot be
    // trusted to withhold what it was sent, and by the time there is a public
    // page the decision has already been made.
    contact: audience === 'owner' ? contact : publicContactDetails(contact),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/** Addresses the one profile by its constant key, never by position. */
const SINGLETON = { key: SINGLETON_KEY } as const;

export async function readProfile(): Promise<ProfileDocument> {
  const profile = await ProfileModel.findOne(SINGLETON);

  // Nothing has been written yet; the client decides what to show.
  if (!profile) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  return profile;
}

/**
 * Upserts on the singleton key, whose unique index is what actually keeps a
 * second document from appearing.
 *
 * The photo the profile stops pointing at is deleted here rather than at upload
 * or removal time, because what the document holds is the only thing that says
 * whether a file is still in use. An external URL is never touched.
 */
export async function saveProfile(
  input: ProfileInput,
): Promise<ProfileDocument> {
  // The one option on the profile, and the only optional one anywhere: a status
  // exists to be displayed, and not displaying one is a real answer.
  await assertOptionalOptionExists(
    'availability-status',
    input.contact?.availability,
    'contact.availability',
  );

  // Asking for the document being replaced makes the cleanup decision part of
  // the same atomic operation: reading it separately first left a window where
  // another write could slip in and the wrong file be deleted. Null here means
  // the upsert inserted, so there was nothing to clean up.
  const previous = await ProfileModel.findOneAndUpdate(
    SINGLETON,
    replacementUpdate(profileSchema, input),
    {
      upsert: true,
      returnDocument: 'before',
      runValidators: true,
    },
  );

  const profile = await readProfile();

  // Every image, by the same rule: a file the profile has stopped pointing at
  // is ours to delete. The list lives in the model, so the pruner and this
  // cannot disagree about which fields hold files.
  for (const field of PROFILE_IMAGE_FIELDS) {
    const before = previous?.[field];

    if (before && before !== profile[field]) {
      await deleteManagedFile(before);
    }
  }

  // The CVs, by the same rule but read per locale: replacing the English one
  // must not touch the French one, and clearing the field must delete both.
  const storedNow = new Set(profile[PROFILE_DOCUMENT_FIELD]?.values() ?? []);

  for (const before of previous?.[PROFILE_DOCUMENT_FIELD]?.values() ?? []) {
    if (!storedNow.has(before)) {
      await deleteManagedFile(before);
    }
  }

  return profile;
}
