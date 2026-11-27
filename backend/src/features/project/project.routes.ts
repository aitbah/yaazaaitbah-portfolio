import { Router } from 'express';

import {
  imageUploadRateLimit,
  parseImageUpload,
} from '../../core/storage/upload.middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  deleteProject,
  getProjects,
  postProject,
  putProject,
  uploadCover,
  uploadGalleryImage,
  reorderProjects,
} from './project.controller.js';

export const projectRouter = Router();

// Public on purpose: the portfolio's own pages display the projects.
projectRouter.get('/', getProjects);

// Authenticated first, then rate limited, then parsed.
//
// The order is the one `auth.routes.ts` argues for and this file had backwards:
// a limiter ahead of `requireAuth` spends its budget on requests that were
// never going to be allowed, so an anonymous flood can lock the owner out of
// their own upload form - a denial of service handed over by the thing meant to
// prevent one. Rejecting an unsigned token is cheaper than counting it, and no
// unauthenticated request is buffered either way.
projectRouter.post(
  '/image',
  requireAuth,
  imageUploadRateLimit(),
  parseImageUpload('image'),
  uploadCover,
);

projectRouter.post(
  '/gallery',
  requireAuth,
  imageUploadRateLimit(),
  parseImageUpload('gallery'),
  uploadGalleryImage,
);

// Before the ':id' routes, so 'reorder' is never read as an identifier.
projectRouter.put('/reorder', requireAuth, reorderProjects);

projectRouter.post('/', requireAuth, postProject);
projectRouter.put('/:id', requireAuth, putProject);
projectRouter.delete('/:id', requireAuth, deleteProject);
