import { Router } from 'express';

import { KIND_HAS_ICON, type ExpertiseKind } from '@portfolio/shared';

import {
  imageUploadRateLimit,
  parseImageUpload,
} from '../../core/storage/upload.middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { expertiseHandlers, uploadIcon } from './expertise.controller.js';

/**
 * One router per kind, from one factory.
 *
 * Three resources rather than one with a `?kind=` filter: they are three
 * separate lists to everyone who reads them, and a filter that can be omitted
 * is a mixed list waiting to be returned by accident. Mounted in `app.ts` at
 * `/api/skills`, `/api/technologies` and `/api/tools`.
 */
export function createExpertiseRouter(kind: ExpertiseKind): Router {
  const router = Router();
  const { get, post, put, remove, reorder } = expertiseHandlers(kind);

  // Public on purpose: the portfolio's own pages display all three.
  router.get('/', get);

  // Only where there is a logo to upload. A skill has none, so this route does
  // not exist for it rather than storing a file nothing could point at.
  if (KIND_HAS_ICON[kind]) {
    // Authenticated first, then rate limited, then parsed.
    //
    // The order is the one `auth.routes.ts` argues for and this file had backwards:
    // a limiter ahead of `requireAuth` spends its budget on requests that were
    // never going to be allowed, so an anonymous flood can lock the owner out of
    // their own upload form - a denial of service handed over by the thing meant to
    // prevent one. Rejecting an unsigned token is cheaper than counting it, and no
    // unauthenticated request is buffered either way.
    router.post(
      '/icon',
      requireAuth,
      imageUploadRateLimit(),
      parseImageUpload('icon'),
      uploadIcon(kind),
    );
  }

  // Before the ':id' routes, so 'reorder' is never read as an identifier.
  router.put('/reorder', requireAuth, reorder);

  router.post('/', requireAuth, post);
  router.put('/:id', requireAuth, put);
  router.delete('/:id', requireAuth, remove);

  return router;
}
