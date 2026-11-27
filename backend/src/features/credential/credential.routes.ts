import { Router } from 'express';

import type { CredentialKind } from '@portfolio/shared';

import { requireAuth } from '../auth/auth.middleware.js';
import { credentialHandlers } from './credential.controller.js';

/**
 * One router per kind, from one factory.
 *
 * Two resources rather than one with a `?kind=` filter: they are two separate
 * lists to everyone who reads them, and a filter that can be omitted is a mixed
 * list waiting to be returned by accident. Mounted in `app.ts` at
 * `/api/certifications` and `/api/courses`.
 */
export function createCredentialRouter(kind: CredentialKind): Router {
  const router = Router();
  const { get, post, put, remove } = credentialHandlers(kind);

  // Public on purpose: the portfolio's own pages display both.
  router.get('/', get);

  router.post('/', requireAuth, post);
  router.put('/:id', requireAuth, put);
  router.delete('/:id', requireAuth, remove);

  // No reorder endpoint: the issue date is the order.
  return router;
}
