import { Router } from 'express';

import {
  imageUploadRateLimit,
  parseDocumentUpload,
  parseImageUpload,
} from '../../core/storage/upload.middleware.js';
import { attachUser, requireAuth } from '../auth/auth.middleware.js';
import {
  getProfile,
  putProfile,
  uploadPhoto,
  uploadResume,
} from './profile.controller.js';

export const profileRouter = Router();

// Public on purpose: the portfolio's own pages display the profile. The reader
// is identified anyway, because the contact block answers the owner more fully
// than it answers a stranger - see `attachUser`.
profileRouter.get('/', attachUser, getProfile);

// One idempotent write covers creating and updating the single profile.
profileRouter.put('/', requireAuth, putProfile);

// Authenticated first, then rate limited, then parsed.
//
// The order is the one `auth.routes.ts` argues for and this file had backwards:
// a limiter ahead of `requireAuth` spends its budget on requests that were
// never going to be allowed, so an anonymous flood can lock the owner out of
// their own upload form - a denial of service handed over by the thing meant to
// prevent one. Rejecting an unsigned token is cheaper than counting it, and no
// unauthenticated request is buffered either way.
profileRouter.post(
  '/photo',
  requireAuth,
  imageUploadRateLimit(),
  parseImageUpload('photo'),
  uploadPhoto,
);

// The same shape as the image uploads, with the document parser and its own
// rate-limit budget: uploading a CV must not spend the photo's.
profileRouter.post(
  '/resume',
  requireAuth,
  imageUploadRateLimit(),
  parseDocumentUpload('resume'),
  uploadResume,
);
