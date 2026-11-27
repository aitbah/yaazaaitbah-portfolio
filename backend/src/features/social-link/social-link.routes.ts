import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import { socialLinkController } from './social-link.controller.js';

export const socialLinkRouter = Router();

// Public on purpose: the portfolio's own pages display the links.
socialLinkRouter.get('/', socialLinkController.list);

// Before the ':id' routes, so 'reorder' is never read as an identifier.
socialLinkRouter.put('/reorder', requireAuth, socialLinkController.reorder);

socialLinkRouter.post('/', requireAuth, socialLinkController.create);
socialLinkRouter.put('/:id', requireAuth, socialLinkController.update);
socialLinkRouter.delete('/:id', requireAuth, socialLinkController.remove);
