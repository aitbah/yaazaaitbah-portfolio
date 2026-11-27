import type { Request, Response } from 'express';

import { sendSuccess } from '../../core/http/respond.js';
import { logger } from '../../core/logging/logger.js';
import {
  receiveDocument,
  receiveImage,
} from '../../core/storage/upload.middleware.js';
import {
  readProfile,
  saveProfile,
  toProfileResponse,
} from './profile.service.js';
import { profileSchema } from './profile.validation.js';

/**
 * Public, because the site displays the profile - hence the contact block is
 * filtered by audience. The session is optional: the signed-in owner sees
 * unpublished details, anyone else what the flags allow.
 */
export async function getProfile(req: Request, res: Response) {
  const profile = await readProfile();

  return sendSuccess(res, {
    profile: toProfileResponse(profile, req.user ? 'owner' : 'public'),
  });
}

export async function putProfile(req: Request, res: Response) {
  const input = profileSchema.parse(req.body);
  const profile = await saveProfile(input);

  logger.info({ userId: req.user?.id }, 'Profile saved');

  // The owner wrote it, so the owner reads it back whole: answering a save with
  // a filtered document would make the admin's own form drop the address it
  // just stored the moment it re-rendered from the response.
  return sendSuccess(res, { profile: toProfileResponse(profile, 'owner') });
}

/**
 * Saved into the profile only when the admin saves the form, so an upload that
 * is never saved leaves a file nothing points at. `uploads:prune` collects it.
 */
export async function uploadPhoto(req: Request, res: Response) {
  const photoUrl = await receiveImage(req, {
    category: 'profile',
    name: 'avatar',
    field: 'photo',
  });

  logger.info({ userId: req.user?.id }, 'Profile photo uploaded');

  return sendSuccess(res, { photoUrl });
}

/**
 * The CV.
 *
 * A PDF, decided from the bytes like every other upload - the declared
 * Content-Type only chose the parser. Nothing here reads inside it: the file is
 * served as an attachment rather than rendered, which is what makes storing it
 * without inspecting it safe.
 */
export async function uploadResume(req: Request, res: Response) {
  const resumeUrl = await receiveDocument(req, {
    category: 'resume',
    name: 'cv',
    field: 'resume',
  });

  logger.info({ userId: req.user?.id }, 'Resume uploaded');

  return sendSuccess(res, { resumeUrl });
}
