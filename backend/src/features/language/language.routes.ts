import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import { languageController } from './language.controller.js';

export const languageRouter = Router();

// Public on purpose: the portfolio's own pages display the languages.
languageRouter.get('/', languageController.list);

// Before the ':id' routes, so 'reorder' is never read as an identifier.
languageRouter.put('/reorder', requireAuth, languageController.reorder);

languageRouter.post('/', requireAuth, languageController.create);
languageRouter.put('/:id', requireAuth, languageController.update);
languageRouter.delete('/:id', requireAuth, languageController.remove);
